import re
import time
from collections import defaultdict
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import APIRouter, Query, HTTPException, Request
from fastapi.responses import StreamingResponse

router = APIRouter()

# Headers to strip from proxied responses
STRIPPED_RESPONSE_HEADERS = {
    "x-frame-options",
    "content-security-policy",
    "content-security-policy-report-only",
}

# Rate limiting: max requests per IP per window
RATE_LIMIT_MAX_REQUESTS = 30
RATE_LIMIT_WINDOW_SECONDS = 60
_rate_limit_store: dict[str, list[float]] = defaultdict(list)

REQUEST_TIMEOUT_SECONDS = 15


def _is_url_allowed(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    hostname = parsed.hostname or ""
    # Block private/internal IPs to prevent SSRF
    if hostname in ("localhost", "127.0.0.1", "0.0.0.0") or hostname.startswith("169.254."):
        return False
    return True


def _check_rate_limit(client_ip: str) -> None:
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW_SECONDS
    # Prune old entries
    _rate_limit_store[client_ip] = [
        t for t in _rate_limit_store[client_ip] if t > window_start
    ]
    if len(_rate_limit_store[client_ip]) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Try again later.",
        )
    _rate_limit_store[client_ip].append(now)


def _rewrite_relative_urls(html: str, base_url: str) -> str:
    """Rewrite relative src/href attributes to absolute URLs."""

    def replace_attr(match: re.Match) -> str:
        attr = match.group(1)
        quote = match.group(2)
        path = match.group(3)
        # Skip already-absolute URLs, data URIs, and anchors
        if path.startswith(("http://", "https://", "data:", "//", "#", "javascript:")):
            return match.group(0)
        absolute = urljoin(base_url, path)
        return f'{attr}={quote}{absolute}{quote}'

    pattern = r'(src|href|action)\s*=\s*(["\'])([^"\']*?)\2'
    return re.sub(pattern, replace_attr, html, flags=re.IGNORECASE)


def _filter_response_headers(headers: httpx.Headers) -> dict[str, str]:
    """Remove headers that block iframe embedding."""
    filtered = {}
    for key, value in headers.items():
        if key.lower() in STRIPPED_RESPONSE_HEADERS:
            continue
        # Also strip transfer-encoding since we handle streaming ourselves
        if key.lower() in ("transfer-encoding", "content-encoding", "content-length"):
            continue
        filtered[key] = value
    return filtered


@router.get("/proxy")
async def proxy_page(
    request: Request,
    url: str = Query(..., description="The URL to proxy"),
):
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    if not _is_url_allowed(url):
        raise HTTPException(
            status_code=403,
            detail="URL is not in the allowed domain whitelist.",
        )

    async def stream_response():
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=REQUEST_TIMEOUT_SECONDS,
            verify=False,
        ) as client:
            async with client.stream("GET", url) as resp:
                content_type = resp.headers.get("content-type", "")
                is_html = "text/html" in content_type

                if is_html:
                    # For HTML, collect full body to rewrite URLs
                    body = b""
                    async for chunk in resp.aiter_bytes():
                        body += chunk
                    text = body.decode("utf-8", errors="replace")
                    text = _rewrite_relative_urls(text, url)
                    yield text.encode("utf-8")
                else:
                    # For non-HTML, stream directly
                    async for chunk in resp.aiter_bytes():
                        yield chunk

    # We need to make a preflight request to get response headers
    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=REQUEST_TIMEOUT_SECONDS,
            verify=False,
        ) as client:
            head_resp = await client.head(url)
            response_headers = _filter_response_headers(head_resp.headers)
            content_type = head_resp.headers.get("content-type", "text/html")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Upstream request timed out.")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Failed to reach upstream: {e}")

    response_headers["Access-Control-Allow-Origin"] = "*"
    response_headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response_headers["Access-Control-Allow-Headers"] = "*"

    return StreamingResponse(
        stream_response(),
        media_type=content_type,
        headers=response_headers,
    )

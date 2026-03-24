import httpx
from fastapi import APIRouter, Query
from fastapi.responses import Response

router = APIRouter()

# Headers to strip for iframe embedding
STRIP_HEADERS = {
    "x-frame-options",
    "content-security-policy",
    "content-security-policy-report-only",
}

# Keywords that indicate an auth/login redirect
LOGIN_KEYWORDS = {"login", "auth", "sso", "signin", "sign-in", "cas", "oauth"}


def _is_login_redirect(response: httpx.Response) -> bool:
    if response.status_code in (301, 302, 303, 307, 308):
        location = response.headers.get("location", "").lower()
        return any(kw in location for kw in LOGIN_KEYWORDS)
    return False


@router.get("/proxy")
def proxy_page(url: str = Query(..., description="The URL to proxy")):
    try:
        with httpx.Client(timeout=15, verify=False, follow_redirects=False) as client:
            resp = client.get(url)
    except httpx.TimeoutException:
        return {"data": None, "message": "Upstream request timed out", "success": False}
    except httpx.RequestError as e:
        return {"data": None, "message": f"Failed to reach upstream: {e}", "success": False}

    # Detect login/auth redirect
    if _is_login_redirect(resp):
        return {
            "data": {"requires_login": True, "redirect_url": resp.headers.get("location", "")},
            "message": "This page requires login. Open in a new window to authenticate.",
            "success": False,
        }

    # Build filtered headers
    headers = {}
    content_type = "text/html"
    for key, value in resp.headers.items():
        k = key.lower()
        if k in STRIP_HEADERS:
            continue
        if k in ("transfer-encoding", "content-encoding", "content-length"):
            continue
        if k == "content-type":
            content_type = value
        headers[key] = value

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=headers,
        media_type=content_type,
    )

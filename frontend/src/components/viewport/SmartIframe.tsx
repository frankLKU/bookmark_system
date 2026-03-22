import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';

interface Props {
  url: string;
}

type LoadState = 'loading' | 'loaded' | 'error';

export function SmartIframe({ url }: Props) {
  const [state, setState] = useState<LoadState>('loading');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Always proxy to strip X-Frame-Options / CSP headers
  const iframeSrc = `/api/v1/proxy?url=${encodeURIComponent(url)}`;

  useEffect(() => {
    setState('loading');

    timerRef.current = setTimeout(() => {
      setState('error');
    }, 15000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [url]);

  const handleLoad = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState('loaded');
  };

  const handleError = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState('error');
  };

  const reload = useCallback(() => {
    setState('loading');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setState('error'), 15000);
    if (iframeRef.current) {
      iframeRef.current.src = iframeSrc + '&_t=' + Date.now();
    }
  }, [iframeSrc]);

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700 shrink-0">
        <span className="text-xs text-gray-500 truncate max-w-md">{url}</span>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button
            onClick={reload}
            title="Reload"
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => window.open(url, '_blank')}
            title="Open in browser"
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in Browser
          </button>
        </div>
      </div>

      <div className="relative flex-1">
        {state === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          </div>
        )}

        {state === 'error' ? (
          <div className="flex items-center justify-center h-full">
            <div className="max-w-md rounded-lg p-8 shadow-lg bg-gray-800 text-center">
              <h3 className="text-lg font-medium text-gray-200 mb-2">
                Unable to load this page
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                The page could not be loaded through the proxy. It may require authentication or be unavailable.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={reload}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-md text-sm hover:bg-gray-600 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
                <button
                  onClick={() => window.open(url, '_blank')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in Browser
                </button>
              </div>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            className="w-full h-full border-none"
            onLoad={handleLoad}
            onError={handleError}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        )}
      </div>
    </div>
  );
}

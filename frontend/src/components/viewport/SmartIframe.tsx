import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ExternalLink, Loader2, Shield, ShieldOff } from 'lucide-react';
import { useUIStore } from '../../stores/ui-store';

interface Props {
  url: string;
}

export function SmartIframe({ url }: Props) {
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const useProxy = useUIStore((s) => s.useProxy);
  const setUseProxy = useUIStore((s) => s.setUseProxy);

  const iframeSrc = useProxy
    ? `/api/v1/proxy?url=${encodeURIComponent(url)}`
    : url;

  useEffect(() => {
    setLoading(true);
    setBlocked(false);

    // Fallback: if iframe doesn't become interactive within 8s, assume blocked
    timerRef.current = setTimeout(() => {
      setLoading(false);
      setBlocked(true);
    }, 8000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [iframeSrc]);

  const handleLoad = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLoading(false);

    // X-Frame-Options / CSP blocks don't fire onError — they fire onLoad with
    // a blocked empty document. Detect by trying to read contentDocument.
    try {
      const doc = iframeRef.current?.contentDocument;
      if (doc === null) {
        setBlocked(true);
        return;
      }
      if (doc && doc.body && doc.body.childElementCount === 0 && doc.title === '') {
        setBlocked(true);
      }
    } catch {
      // SecurityError = cross-origin frame loaded successfully — this is fine
    }
  };

  const handleError = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLoading(false);
    setBlocked(true);
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Always-visible toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700 shrink-0">
        <span className="text-xs text-gray-500 truncate max-w-xs">{url}</span>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <button
            onClick={() => setUseProxy(!useProxy)}
            title={useProxy ? 'Proxy Mode (click to switch to Direct)' : 'Direct Mode (click to switch to Proxy)'}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
              useProxy
                ? 'text-green-400 bg-green-900/30 hover:bg-green-900/50'
                : 'text-gray-400 bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {useProxy ? <Shield className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
            {useProxy ? 'Proxy' : 'Direct'}
          </button>
          <button
            onClick={() => window.open(url, '_blank')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in New Window
          </button>
        </div>
      </div>

      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          </div>
        )}

        {blocked ? (
          <div className="flex items-center justify-center h-full">
            <div className="max-w-md rounded-lg p-8 shadow-lg bg-gray-800 text-center">
              <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-200 mb-2">
                This page cannot be embedded
              </h3>
              <p className="text-sm text-gray-400 mb-2">
                {useProxy
                  ? 'The proxy could not load this page. Try opening it in a new window.'
                  : (
                    <>
                      The site blocks iframe embedding via{' '}
                      <code className="bg-gray-700 px-1 rounded text-xs">X-Frame-Options</code> or{' '}
                      <code className="bg-gray-700 px-1 rounded text-xs">Content-Security-Policy</code>.
                    </>
                  )}
              </p>
              {!useProxy && (
                <p className="text-xs text-gray-500 mb-4">
                  Try switching to Proxy Mode using the toolbar button above.
                </p>
              )}
              <div className="flex items-center justify-center gap-3 mt-4">
                {!useProxy && (
                  <button
                    onClick={() => setUseProxy(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-md text-sm hover:bg-green-600 transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    Try Proxy Mode
                  </button>
                )}
                <button
                  onClick={() => window.open(url, '_blank')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in New Window
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
            referrerPolicy="no-referrer"
          />
        )}
      </div>
    </div>
  );
}

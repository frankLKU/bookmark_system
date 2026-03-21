import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface Props {
  url: string;
}

export function SmartIframe({ url }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <div className="relative w-full h-full">
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      )}

      {error ? (
        <div className="flex items-center justify-center h-full">
          <div className="max-w-md rounded-lg p-8 shadow-lg bg-gray-800 text-center">
            <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-200 mb-2">
              This page cannot be embedded
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              The target site blocks iframe embedding due to security restrictions.
            </p>
            <button
              onClick={() => window.open(url, '_blank')}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
            >
              Open in New Window
            </button>
          </div>
        </div>
      ) : (
        <iframe
          src={url}
          className="w-full h-full border-none"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      )}
    </div>
  );
}

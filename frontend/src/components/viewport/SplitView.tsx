import { ExternalLink, RefreshCw, X } from 'lucide-react';
import { SmartIframe } from './SmartIframe';
import { useTabStore } from '../../stores/tab-store';

interface Props {
  tabId: string;
  urls: string[];
  titles: string[];
}

export function SplitView({ tabId, urls, titles }: Props) {
  const exitCombinedView = useTabStore((s) => s.exitCombinedView);

  return (
    <div className="flex h-full">
      {urls.map((url, i) => (
        <div key={i} className={`flex-1 flex flex-col ${i === 0 ? 'border-r-2 border-gray-700' : ''}`}>
          <div className="h-7 bg-gray-800 flex items-center px-2 gap-1 shrink-0">
            <span className="text-xs text-gray-400 truncate flex-1">{titles[i]}</span>
            <button
              onClick={() => {
                const iframe = document.querySelector(
                  `iframe[src="${CSS.escape(url)}"]`
                ) as HTMLIFrameElement | null;
                if (iframe) iframe.src = url;
              }}
              className="p-0.5 text-gray-500 hover:text-gray-300"
              title="Refresh"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
            <button
              onClick={() => window.open(url, '_blank')}
              className="p-0.5 text-gray-500 hover:text-gray-300"
              title="Open in new window"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
            <button
              onClick={() => exitCombinedView(tabId)}
              className="p-0.5 text-gray-500 hover:text-gray-300"
              title="Exit split view"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex-1">
            <SmartIframe url={url} />
          </div>
        </div>
      ))}
    </div>
  );
}

import { ModalWrapper } from './ModalWrapper';
import { useUIStore } from '../../stores/ui-store';
import { useBookmarkStore } from '../../stores/bookmark-store';
import { useRef } from 'react';

interface Props {
  onClose: () => void;
  onManageCategories: () => void;
}

export function SettingsModal({ onClose, onManageCategories }: Props) {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const useProxy = useUIStore((s) => s.useProxy);
  const setUseProxy = useUIStore((s) => s.setUseProxy);
  const proxyBaseUrl = useUIStore((s) => s.proxyBaseUrl);
  const setProxyBaseUrl = useUIStore((s) => s.setProxyBaseUrl);
  const importFromJSON = useBookmarkStore((s) => s.importFromJSON);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      importFromJSON(text);
      onClose();
    };
    reader.readAsText(file);
  };

  return (
    <ModalWrapper title="Settings" onClose={onClose} maxWidth="max-w-sm">
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Theme</label>
          <div className="flex gap-2">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  theme === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Categories</label>
          <button
            onClick={() => {
              onClose();
              onManageCategories();
            }}
            className="px-4 py-2 bg-gray-700 text-gray-200 rounded-md text-sm hover:bg-gray-600 transition-colors"
          >
            Manage Categories
          </button>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">Proxy Settings</label>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-300">Enable Proxy Mode</span>
              <button
                onClick={() => setUseProxy(!useProxy)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  useProxy ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    useProxy ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Proxy Server URL</label>
              <input
                type="text"
                value={proxyBaseUrl}
                onChange={(e) => setProxyBaseUrl(e.target.value)}
                className="w-full px-3 py-1.5 bg-gray-700 text-gray-200 rounded-md text-sm border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder="http://localhost:8000"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Restore from JSON backup
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportJSON}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-gray-700 text-gray-200 rounded-md text-sm hover:bg-gray-600 transition-colors"
          >
            Import from JSON
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

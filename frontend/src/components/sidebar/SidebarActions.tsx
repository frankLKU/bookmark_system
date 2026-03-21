import { Plus, Upload, Download, Settings } from 'lucide-react';

interface Props {
  onAddBookmark: () => void;
  onImport: () => void;
  onExport: () => void;
  onSettings: () => void;
}

export function SidebarActions({ onAddBookmark, onImport, onExport, onSettings }: Props) {
  return (
    <div className="sticky bottom-0 px-3 py-2 border-t border-gray-800 bg-gray-950 flex items-center gap-2 flex-wrap">
      <button
        onClick={onAddBookmark}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Bookmark
      </button>
      <button
        onClick={onImport}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <Upload className="w-4 h-4" />
        Import
      </button>
      <button
        onClick={onExport}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <Download className="w-4 h-4" />
        Export
      </button>
      <button
        onClick={onSettings}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors ml-auto"
      >
        <Settings className="w-4 h-4" />
      </button>
    </div>
  );
}

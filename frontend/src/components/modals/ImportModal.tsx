import { useState } from 'react';
import { ModalWrapper } from './ModalWrapper';
import { useBookmarkStore } from '../../stores/bookmark-store';
import { parseOneTabText } from '../../lib/onetab-parser';
import type { ParsedBookmark, FactoryTag } from '../../lib/types';

interface Props {
  onClose: () => void;
}

export function ImportModal({ onClose }: Props) {
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedBookmark[] | null>(null);
  const importBookmarks = useBookmarkStore((s) => s.importBookmarks);
  const addCategory = useBookmarkStore((s) => s.addCategory);
  const categories = useBookmarkStore((s) => s.categories);

  const handleParse = () => {
    const results = parseOneTabText(rawText);
    setParsed(results);
  };

  const handleImport = () => {
    if (!parsed) return;

    // Ensure categories exist
    const existingNames = new Set(categories.map((c) => c.name));
    const newCats = new Set(parsed.map((p) => p.category).filter((c) => !existingNames.has(c)));
    for (const cat of newCats) {
      addCategory(cat);
    }

    importBookmarks(
      parsed.map((p) => ({
        title: p.title,
        url: p.url,
        category: p.category,
        tags: p.tags,
      }))
    );
    onClose();
  };

  const updateParsed = (index: number, field: keyof ParsedBookmark, value: string | FactoryTag[]) => {
    if (!parsed) return;
    setParsed(
      parsed.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  return (
    <ModalWrapper title="Import Bookmarks" onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Paste your OneTab export below:
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={"https://spark-f18.tsmc.com | Spark F18\nhttps://airflow-f18.tsmc.com | Airflow F18"}
            className="w-full min-h-[120px] px-3 py-2 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
          />
        </div>

        <button
          onClick={handleParse}
          disabled={!rawText.trim()}
          className="px-4 py-2 bg-gray-700 text-gray-200 rounded-md text-sm hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Parse & Preview
        </button>

        {parsed && (
          <div>
            <p className="text-sm text-gray-400 mb-2">
              Preview ({parsed.length} bookmarks found):
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-400">
                    <th className="text-left py-2 px-2">Title</th>
                    <th className="text-left py-2 px-2">URL</th>
                    <th className="text-left py-2 px-2">Tags</th>
                    <th className="text-left py-2 px-2">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((item, i) => (
                    <tr key={i} className="border-b border-gray-800">
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => updateParsed(i, 'title', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 text-xs"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <span className="text-xs text-gray-400 truncate block max-w-[200px]">
                          {item.url}
                        </span>
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={item.tags.join(', ')}
                          onChange={(e) =>
                            updateParsed(
                              i,
                              'tags',
                              e.target.value.split(',').map((s) => s.trim()).filter(Boolean) as FactoryTag[]
                            )
                          }
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 text-xs"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={item.category}
                          onChange={(e) => updateParsed(i, 'category', e.target.value)}
                          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 text-xs"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!parsed || parsed.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {parsed ? `Import ${parsed.length} Bookmarks` : 'Import'}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

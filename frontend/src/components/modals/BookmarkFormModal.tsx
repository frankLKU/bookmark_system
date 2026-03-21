import { useState } from 'react';
import { ModalWrapper } from './ModalWrapper';
import { useBookmarkStore } from '../../stores/bookmark-store';
import { FACTORY_TAGS, type Bookmark, type FactoryTag } from '../../lib/types';

interface Props {
  bookmark?: Bookmark | null;
  onClose: () => void;
}

export function BookmarkFormModal({ bookmark, onClose }: Props) {
  const [title, setTitle] = useState(bookmark?.title ?? '');
  const [url, setUrl] = useState(bookmark?.url ?? '');
  const [category, setCategory] = useState(bookmark?.category ?? '');
  const [tags, setTags] = useState<FactoryTag[]>(bookmark?.tags ?? []);
  const [isCombined, setIsCombined] = useState(bookmark?.isCombined ?? false);
  const [newCategory, setNewCategory] = useState('');

  const categories = useBookmarkStore((s) => s.categories);
  const addBookmark = useBookmarkStore((s) => s.addBookmark);
  const updateBookmark = useBookmarkStore((s) => s.updateBookmark);
  const addCategory = useBookmarkStore((s) => s.addCategory);

  const toggleTag = (tag: FactoryTag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = newCategory || category || 'Uncategorized';

    if (newCategory && !categories.find((c) => c.name === newCategory)) {
      addCategory(newCategory);
    }

    if (bookmark) {
      updateBookmark(bookmark.id, {
        title,
        url,
        category: finalCategory,
        tags,
        isCombined,
      });
    } else {
      addBookmark({ title, url, category: finalCategory, tags, isCombined });
    }
    onClose();
  };

  return (
    <ModalWrapper
      title={bookmark ? 'Edit Bookmark' : 'Add Bookmark'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={100}
            className="w-full h-9 px-3 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            className="w-full h-9 px-3 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setNewCategory('');
            }}
            className="w-full h-9 px-3 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select category...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newCategory}
            onChange={(e) => {
              setNewCategory(e.target.value);
              setCategory('');
            }}
            placeholder="Or type a new category..."
            className="w-full h-9 px-3 mt-2 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Factory Tags</label>
          <div className="flex flex-wrap gap-1.5">
            {FACTORY_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  tags.includes(tag)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {tag.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="combined"
            checked={isCombined}
            onChange={(e) => setIsCombined(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="combined" className="text-sm text-gray-400">
            Mark as combined view pair
          </label>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors"
          >
            {bookmark ? 'Save Changes' : 'Save Bookmark'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

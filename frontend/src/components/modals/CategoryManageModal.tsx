import { useState } from 'react';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { ModalWrapper } from './ModalWrapper';
import { useBookmarkStore } from '../../stores/bookmark-store';

interface Props {
  onClose: () => void;
}

export function CategoryManageModal({ onClose }: Props) {
  const categories = useBookmarkStore((s) => s.categories);
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const addCategory = useBookmarkStore((s) => s.addCategory);
  const updateCategory = useBookmarkStore((s) => s.updateCategory);
  const deleteCategory = useBookmarkStore((s) => s.deleteCategory);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const sorted = [...categories].sort((a, b) => a.order - b.order);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      addCategory(newName.trim());
      setNewName('');
    }
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) {
      updateCategory(id, editName.trim());
    }
    setEditingId(null);
  };

  const countBookmarks = (catName: string) =>
    bookmarks.filter((b) => b.category === catName).length;

  return (
    <ModalWrapper title="Manage Categories" onClose={onClose}>
      <div className="space-y-3">
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New category name..."
            className="flex-1 h-9 px-3 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </form>

        <div className="space-y-1">
          {sorted.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-2 h-9 px-2 rounded-md bg-gray-800"
            >
              <GripVertical className="w-4 h-4 text-gray-500 cursor-grab shrink-0" />
              {editingId === cat.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => handleSaveEdit(cat.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(cat.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-sm text-gray-200 focus:outline-none"
                />
              ) : (
                <span className="flex-1 text-sm text-gray-200">{cat.name}</span>
              )}
              <span className="text-xs text-gray-500">
                ({countBookmarks(cat.name)})
              </span>
              <button
                onClick={() => {
                  setEditingId(cat.id);
                  setEditName(cat.name);
                }}
                className="p-1 text-gray-500 hover:text-gray-300"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => deleteCategory(cat.id)}
                className="p-1 text-gray-500 hover:text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {sorted.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            No categories yet. Add one above.
          </p>
        )}
      </div>
    </ModalWrapper>
  );
}

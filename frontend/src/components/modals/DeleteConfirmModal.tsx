import { ModalWrapper } from './ModalWrapper';

interface Props {
  title: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteConfirmModal({ title, onConfirm, onClose }: Props) {
  return (
    <ModalWrapper title="Delete Bookmark?" onClose={onClose} maxWidth="max-w-sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-300">
          Are you sure you want to delete{' '}
          <span className="font-medium text-gray-200">"{title}"</span>?
        </p>
        <p className="text-sm text-gray-500">This action cannot be undone.</p>
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}

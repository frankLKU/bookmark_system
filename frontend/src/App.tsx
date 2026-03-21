import { useState } from 'react';
import { ThemeProvider } from './components/layout/ThemeProvider';
import { WorkspaceBar } from './components/layout/WorkspaceBar';
import { Sidebar } from './components/sidebar/Sidebar';
import { MainViewport } from './components/viewport/MainViewport';
import { BookmarkFormModal } from './components/modals/BookmarkFormModal';
import { ImportModal } from './components/modals/ImportModal';
import { DeleteConfirmModal } from './components/modals/DeleteConfirmModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { CategoryManageModal } from './components/modals/CategoryManageModal';
import { useBookmarkStore } from './stores/bookmark-store';
import { useHealthCheck } from './lib/use-health-check';
import type { Bookmark } from './lib/types';

type ModalState =
  | { type: 'none' }
  | { type: 'addBookmark' }
  | { type: 'editBookmark'; bookmark: Bookmark }
  | { type: 'deleteBookmark'; bookmark: Bookmark }
  | { type: 'import' }
  | { type: 'settings' }
  | { type: 'categories' };

function App() {
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const deleteBookmark = useBookmarkStore((s) => s.deleteBookmark);

  useHealthCheck();

  const closeModal = () => setModal({ type: 'none' });

  return (
    <ThemeProvider>
      <div className="h-full flex flex-col bg-gray-950 text-gray-200">
        <WorkspaceBar />
        <div className="flex flex-1 min-h-0">
          <Sidebar
            onAddBookmark={() => setModal({ type: 'addBookmark' })}
            onImport={() => setModal({ type: 'import' })}
            onSettings={() => setModal({ type: 'settings' })}
            onEditBookmark={(bookmark) =>
              setModal({ type: 'editBookmark', bookmark })
            }
            onDeleteBookmark={(bookmark) =>
              setModal({ type: 'deleteBookmark', bookmark })
            }
          />
          <MainViewport />
        </div>
      </div>

      {modal.type === 'addBookmark' && (
        <BookmarkFormModal onClose={closeModal} />
      )}
      {modal.type === 'editBookmark' && (
        <BookmarkFormModal bookmark={modal.bookmark} onClose={closeModal} />
      )}
      {modal.type === 'deleteBookmark' && (
        <DeleteConfirmModal
          title={modal.bookmark.title}
          onConfirm={() => deleteBookmark(modal.bookmark.id)}
          onClose={closeModal}
        />
      )}
      {modal.type === 'import' && <ImportModal onClose={closeModal} />}
      {modal.type === 'settings' && (
        <SettingsModal
          onClose={closeModal}
          onManageCategories={() => setModal({ type: 'categories' })}
        />
      )}
      {modal.type === 'categories' && (
        <CategoryManageModal onClose={closeModal} />
      )}
    </ThemeProvider>
  );
}

export default App;

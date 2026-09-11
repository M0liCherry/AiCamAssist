import './App.css'
import { NotesProvider, useNotes } from './context/NotesContext'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { Toast } from './components/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AudioUploadModal } from './components/modals/AudioUploadModal'
import { DocUploadModal } from './components/modals/DocUploadModal'
import { WebImportModal } from './components/modals/WebImportModal'
import { NewItemModal } from './components/modals/NewItemModal'
import { SearchModal } from './components/modals/SearchModal'
import { UserProfileModal } from './components/modals/UserProfileModal'

import { NotesHubView } from './views/NotesHubView'
import { DocumentEditorView } from './views/DocumentEditorView'
import { PodcastsView } from './views/PodcastsView'
import { FlashcardsView } from './views/FlashcardsView'
import { QuizzesView } from './views/QuizzesView'
import { SettingsView } from './views/SettingsView'

function AppContent() {
  const { activeView } = useNotes()

  return (
    <div className="app-shell">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Dynamic Viewport */}
      <main className="main-viewport">
        <Header />

        {activeView === 'hub' && <NotesHubView />}
        {activeView === 'editor' && <DocumentEditorView />}
        {activeView === 'podcasts' && <PodcastsView />}
        {activeView === 'flashcards' && <FlashcardsView />}
        {activeView === 'quizzes' && <QuizzesView />}
        {activeView === 'settings' && <SettingsView />}
      </main>

      {/* Global Modals */}
      <AudioUploadModal />
      <DocUploadModal />
      <WebImportModal />
      <NewItemModal />
      <SearchModal />
      <UserProfileModal />

      {/* Interactive Toast Notifications */}
      <Toast />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <NotesProvider>
        <AppContent />
      </NotesProvider>
    </ErrorBoundary>
  )
}

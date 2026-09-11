import React from 'react'
import { useNotes } from '../context/NotesContext'
import { IconSearch, IconX } from './icons'

export const Header: React.FC = () => {
  const {
    activeView,
    subjects,
    chapters,
    notes,
    searchQuery,
    setSearchQuery,
    setIsSearchOpen
  } = useNotes()

  const getHeaderInfo = () => {
    switch (activeView) {
      case 'hub':
        return {
          title: 'Notes Hub',
          subtitle: `${subjects.length} ${subjects.length === 1 ? 'subject' : 'subjects'} • ${chapters.length} ${chapters.length === 1 ? 'chapter' : 'chapters'} • ${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`
        }
      case 'editor':
        return {
          title: 'Document Editor',
          subtitle: 'Markdown note drafting & split preview'
        }
      case 'podcasts':
        return {
          title: 'Audio Studio',
          subtitle: 'Conversational audio dialogues'
        }
      case 'flashcards':
        return {
          title: 'Flashcards',
          subtitle: 'Active recall & memory retention'
        }
      case 'quizzes':
        return {
          title: 'Quizzes',
          subtitle: 'Assess knowledge and test comprehension'
        }
      case 'settings':
        return {
          title: 'Settings',
          subtitle: 'Themes, typography, and local storage'
        }
      default:
        return {
          title: 'Notes Hub',
          subtitle: `${subjects.length} subjects • ${chapters.length} chapters • ${notes.length} notes`
        }
    }
  }

  const { title, subtitle } = getHeaderInfo()

  return (
    <header className="top-header">
      <div className="hero-title" style={{ marginBottom: 0 }}>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      <div className="search-container">
        <span className="search-icon">
          <IconSearch size={14} />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            if (activeView !== 'hub') {
              setIsSearchOpen(true)
            }
          }}
          placeholder="Search notes and collections... (Ctrl + K)"
        />
        {searchQuery ? (
          <button
            className="clear-search-btn"
            onClick={() => setSearchQuery('')}
            title="Clear search"
          >
            <IconX size={12} />
          </button>
        ) : (
          <button
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 11,
              color: 'var(--text-muted)',
              backgroundColor: 'var(--ctp-surface0)',
              padding: '2px 5px',
              borderRadius: 4
            }}
            onClick={() => setIsSearchOpen(true)}
            title="Open search"
          >
            Ctrl+K
          </button>
        )}
      </div>
    </header>
  )
}

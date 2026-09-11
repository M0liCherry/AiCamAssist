import React, { useState } from 'react'
import { useNotes } from '../../context/NotesContext'
import {
  IconSearch,
  IconFile,
  IconFolder,
  IconZap,
  IconFolderOpen,
  IconEdit,
  IconHeadphones,
  IconCards,
  IconHelpCircle
} from '../icons'

export const SearchModal: React.FC = () => {
  const {
    isSearchOpen,
    setIsSearchOpen,
    notes,
    subjects,
    chapters,
    flashcards,
    openNoteInEditor,
    setActiveSubjectId,
    setActiveChapterId,
    setActiveView
  } = useNotes()

  const [query, setQuery] = useState('')

  if (!isSearchOpen) return null

  const trimmed = query.toLowerCase().trim()

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(trimmed) ||
      n.content.toLowerCase().includes(trimmed) ||
      n.badge.toLowerCase().includes(trimmed)
  )

  const filteredSubjects = subjects.filter((s) => s.name.toLowerCase().includes(trimmed))

  const filteredCards = flashcards.filter(
    (f) => f.question.toLowerCase().includes(trimmed) || f.answer.toLowerCase().includes(trimmed)
  )

  const handleSelectNote = (id: string) => {
    openNoteInEditor(id)
    setIsSearchOpen(false)
  }

  const handleSelectSubject = (id: string) => {
    setActiveSubjectId(id)
    const chap = chapters.find((c) => c.subjectId === id)
    if (chap) setActiveChapterId(chap.id)
    setActiveView('hub')
    setIsSearchOpen(false)
  }

  const handleSelectCard = () => {
    setActiveView('flashcards')
    setIsSearchOpen(false)
  }

  return (
    <div className="modal-overlay" onClick={() => setIsSearchOpen(false)}>
      <div
        className="modal-content"
        style={{ maxWidth: 620, padding: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <IconSearch size={16} />
          </span>
          <input
            className="form-input"
            style={{ paddingLeft: 42, fontSize: 14, borderRadius: 8 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all notes, subjects, chapters, flashcards..."
            autoFocus
          />
        </div>

        <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {trimmed && (
            <>
              {filteredNotes.length > 0 && (
                <div>
                  <div className="nav-label" style={{ marginTop: 4 }}>
                    Notes ({filteredNotes.length})
                  </div>
                  {filteredNotes.map((note) => {
                    const sub = subjects.find((s) => s.id === note.subjectId)
                    return (
                      <div
                        key={note.id}
                        className="menu-item"
                        style={{ padding: '8px 12px', borderRadius: 6 }}
                        onClick={() => handleSelectNote(note.id)}
                      >
                        <span style={{ color: 'var(--ctp-blue)', display: 'flex', alignItems: 'center' }}>
                          <IconFile size={16} />
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{note.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {sub?.name || 'General'} • {note.wordCount} words • {note.updatedAt}
                          </div>
                        </div>
                        <span className="badge">{note.badge}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {filteredSubjects.length > 0 && (
                <div>
                  <div className="nav-label" style={{ marginTop: 8 }}>
                    Subjects ({filteredSubjects.length})
                  </div>
                  {filteredSubjects.map((sub) => (
                    <div
                      key={sub.id}
                      className="menu-item"
                      style={{ padding: '8px 12px', borderRadius: 6 }}
                      onClick={() => handleSelectSubject(sub.id)}
                    >
                      <span style={{ color: 'var(--ctp-yellow)', display: 'flex', alignItems: 'center' }}>
                        <IconFolder size={16} />
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{sub.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Subject Collection</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {filteredCards.length > 0 && (
                <div>
                  <div className="nav-label" style={{ marginTop: 8 }}>
                    Flashcards ({filteredCards.length})
                  </div>
                  {filteredCards.slice(0, 3).map((card) => (
                    <div
                      key={card.id}
                      className="menu-item"
                      style={{ padding: '8px 12px', borderRadius: 6 }}
                      onClick={handleSelectCard}
                    >
                      <span style={{ color: 'var(--ctp-green)', display: 'flex', alignItems: 'center' }}>
                        <IconZap size={16} />
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{card.question}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Mastery: {card.mastery}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {filteredNotes.length === 0 &&
                filteredSubjects.length === 0 &&
                filteredCards.length === 0 && (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    No matching results found for "{query}"
                  </div>
                )}
            </>
          )}

          {!trimmed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 2px' }}>
              <div className="nav-label">Quick Jump</div>
              <div
                className="menu-item"
                onClick={() => {
                  setActiveView('hub')
                  setIsSearchOpen(false)
                }}
              >
                <IconFolderOpen size={16} style={{ color: 'var(--ctp-blue)' }} />
                <span>Go to Notes Hub</span>
              </div>
              <div
                className="menu-item"
                onClick={() => {
                  setActiveView('editor')
                  setIsSearchOpen(false)
                }}
              >
                <IconEdit size={16} style={{ color: 'var(--ctp-lavender)' }} />
                <span>Open Document Editor</span>
              </div>
              <div
                className="menu-item"
                onClick={() => {
                  setActiveView('podcasts')
                  setIsSearchOpen(false)
                }}
              >
                <IconHeadphones size={16} style={{ color: 'var(--ctp-yellow)' }} />
                <span>AI Podcasts Studio</span>
              </div>
              <div
                className="menu-item"
                onClick={() => {
                  setActiveView('flashcards')
                  setIsSearchOpen(false)
                }}
              >
                <IconCards size={16} style={{ color: 'var(--ctp-green)' }} />
                <span>Flashcards Practice</span>
              </div>
              <div
                className="menu-item"
                onClick={() => {
                  setActiveView('quizzes')
                  setIsSearchOpen(false)
                }}
              >
                <IconHelpCircle size={16} style={{ color: 'var(--ctp-red)' }} />
                <span>Interactive Quizzes</span>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            color: 'var(--text-muted)',
            borderTop: '1px solid var(--border-color)',
            paddingTop: 12,
            marginTop: 8
          }}
        >
          <span>Press ESC or click outside to dismiss</span>
          <span>Verity Local Vector & Semantic Index</span>
        </div>
      </div>
    </div>
  )
}

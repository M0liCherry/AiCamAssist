import React, { useState } from 'react'
import { useNotes } from '../../context/NotesContext'

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
              color: 'var(--text-muted)'
            }}
          >
            🔍
          </span>
          <input
            className="form-input"
            style={{ paddingLeft: 42, fontSize: 15, borderRadius: 10 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all notes, subjects, chapters, flashcards..."
            autoFocus
          />
        </div>

        <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {trimmed && (
            <>
              {filteredNotes.length > 0 && (
                <div>
                  <div className="nav-label" style={{ marginTop: 8 }}>
                    Notes ({filteredNotes.length})
                  </div>
                  {filteredNotes.map((note) => {
                    const sub = subjects.find((s) => s.id === note.subjectId)
                    return (
                      <div
                        key={note.id}
                        className="menu-item"
                        style={{ padding: '10px 12px' }}
                        onClick={() => handleSelectNote(note.id)}
                      >
                        <span style={{ fontSize: 16 }}>📄</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{note.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {sub?.name} • {note.wordCount} words • {note.updatedAt}
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
                      style={{ padding: '10px 12px' }}
                      onClick={() => handleSelectSubject(sub.id)}
                    >
                      <span style={{ fontSize: 16 }}>📂</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{sub.name}</div>
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
                      style={{ padding: '10px 12px' }}
                      onClick={handleSelectCard}
                    >
                      <span style={{ fontSize: 16 }}>⚡</span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{card.question}</div>
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
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No matching results found for "{query}"
                  </div>
                )}
            </>
          )}

          {!trimmed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 4px' }}>
              <div className="nav-label">Quick Jump</div>
              <div
                className="menu-item"
                onClick={() => {
                  setActiveView('hub')
                  setIsSearchOpen(false)
                }}
              >
                <span>📁</span>
                <span>Go to Notes Hub</span>
              </div>
              <div
                className="menu-item"
                onClick={() => {
                  setActiveView('editor')
                  setIsSearchOpen(false)
                }}
              >
                <span>📝</span>
                <span>Open Document Editor</span>
              </div>
              <div
                className="menu-item"
                onClick={() => {
                  setActiveView('podcasts')
                  setIsSearchOpen(false)
                }}
              >
                <span>🎙️</span>
                <span>AI Podcasts Studio</span>
              </div>
              <div
                className="menu-item"
                onClick={() => {
                  setActiveView('flashcards')
                  setIsSearchOpen(false)
                }}
              >
                <span>⚡</span>
                <span>Flashcards Practice</span>
              </div>
              <div
                className="menu-item"
                onClick={() => {
                  setActiveView('quizzes')
                  setIsSearchOpen(false)
                }}
              >
                <span>❓</span>
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
          <span>NitroAI Local Vector & Semantic Index</span>
        </div>
      </div>
    </div>
  )
}

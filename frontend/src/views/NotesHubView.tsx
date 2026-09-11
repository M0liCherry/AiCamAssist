import React, { useState, useRef, useEffect } from 'react'
import { useNotes } from '../context/NotesContext'
import {
  IconFile,
  IconMic,
  IconUpload,
  IconLink,
  IconFolder,
  IconPlus,
  IconMore,
  IconEdit,
  IconCards,
  IconHelpCircle,
  IconHeadphones,
  IconCopy,
  IconTrash
} from '../components/icons'

export const NotesHubView: React.FC = () => {
  const {
    subjects,
    chapters,
    notes,
    activeSubjectId,
    activeChapterId,
    filterMode,
    searchQuery,
    setActiveSubjectId,
    setActiveChapterId,
    setFilterMode,
    createBlankNote,
    openNoteInEditor,
    openNewItemModal,
    setIsAudioModalOpen,
    setIsDocModalOpen,
    setIsWebModalOpen,
    generateFlashcardsFromNote,
    generateQuizFromNote,
    generatePodcastFromNote,
    duplicateNote,
    deleteNote
  } = useNotes()

  const [openNewMenu, setOpenNewMenu] = useState(false)
  const [activeMenuNoteId, setActiveMenuNoteId] = useState<string | null>(null)
  const newMenuRef = useRef<HTMLDivElement>(null)
  const docMenuRef = useRef<HTMLDivElement>(null)

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as HTMLElement)) {
        setOpenNewMenu(false)
      }
      if (docMenuRef.current && !docMenuRef.current.contains(e.target as HTMLElement)) {
        setActiveMenuNoteId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentSubject = subjects.find((s) => s.id === activeSubjectId) || subjects[0]
  const currentChapter = chapters.find((c) => c.id === activeChapterId) || chapters[0]

  // Filter notes based on active subject/chapter & search query
  const displayedNotes = notes.filter((n) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.badge.toLowerCase().includes(q)
      )
    }

    if (filterMode === 'chapter') {
      return n.chapterId === activeChapterId
    } else {
      return n.subjectId === activeSubjectId
    }
  })

  const getChapterNoteCount = (chapId: string) => {
    return notes.filter((n) => n.chapterId === chapId).length
  }

  return (
    <div className="content-body">
      {/* Quick Action Cards */}
      <div className="grid-cards">
        <div className="action-card" onClick={createBlankNote} title="Create blank markdown note">
          <div className="card-icon">
            <IconFile size={17} />
          </div>
          <h3>Blank document</h3>
          <p>Write a Markdown note from scratch.</p>
        </div>

        <div
          className="action-card"
          onClick={() => setIsAudioModalOpen(true)}
          title="Transcribe audio"
        >
          <div className="card-icon">
            <IconMic size={17} />
          </div>
          <h3>Upload audio</h3>
          <p>Transcribe a lecture or recording locally.</p>
        </div>

        <div
          className="action-card"
          onClick={() => setIsDocModalOpen(true)}
          title="Import documents"
        >
          <div className="card-icon">
            <IconUpload size={17} />
          </div>
          <h3>Document upload</h3>
          <p>PDF, DOCX, PPTX, TXT, Markdown.</p>
        </div>

        <div
          className="action-card"
          onClick={() => setIsWebModalOpen(true)}
          title="Import web link"
        >
          <div className="card-icon">
            <IconLink size={17} />
          </div>
          <h3>Website / YouTube</h3>
          <p>Import article or video captions directly.</p>
        </div>
      </div>

      {/* Workspace Split */}
      <div className="workspace-split">
        {/* Library Tree Panel */}
        <div className="panel">
          <div className="panel-header" style={{ position: 'relative' }}>
            <span>Library Tree</span>
            <div ref={newMenuRef}>
              <span
                className="new-btn"
                onClick={() => setOpenNewMenu(!openNewMenu)}
                title="Create item"
              >
                + New
              </span>
              {openNewMenu && (
                <div className="context-menu" style={{ top: 28, left: 0 }}>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setOpenNewMenu(false)
                      openNewItemModal('subject')
                    }}
                  >
                    <IconFolder size={14} />
                    <span>New Subject</span>
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setOpenNewMenu(false)
                      openNewItemModal('chapter')
                    }}
                  >
                    <IconFile size={14} />
                    <span>New Chapter</span>
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      setOpenNewMenu(false)
                      openNewItemModal('note')
                    }}
                  >
                    <IconPlus size={14} />
                    <span>New Note</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="tree-container">
            {subjects.length > 0 ? (
              subjects.map((sub) => {
                const subChapters = chapters.filter((c) => c.subjectId === sub.id)
                const isSubActive = activeSubjectId === sub.id

                return (
                  <div key={sub.id} className="tree-subject-group">
                    <div
                      className={`tree-subject-header ${isSubActive ? 'active' : ''}`}
                      onClick={() => {
                        setActiveSubjectId(sub.id)
                        if (subChapters.length > 0) {
                          setActiveChapterId(subChapters[0].id)
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <IconFolder size={14} />
                        <span>{sub.name}</span>
                      </div>
                    </div>

                    <div className="tree-chapters">
                      {subChapters.map((chap) => {
                        const isChapActive = activeChapterId === chap.id
                        const count = getChapterNoteCount(chap.id)

                        return (
                          <div
                            key={chap.id}
                            className={`tree-item ${isChapActive ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveSubjectId(sub.id)
                              setActiveChapterId(chap.id)
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <IconFile size={13} />
                              <span>{chap.name}</span>
                            </div>
                            <span className="tree-item-count">({count})</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            ) : (
              <div
                style={{
                  padding: '24px 10px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 12.5,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <div>No subjects created yet</div>
                <button
                  className="btn-secondary"
                  style={{ fontSize: 12, padding: '4px 10px' }}
                  onClick={() => openNewItemModal('subject')}
                >
                  + Create Subject
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Active Subject Files View */}
        <div className="panel active-document-view">
          <div className="panel-header">
            <span>
              Active Subject: {currentSubject ? currentSubject.name : 'None selected'}{' '}
              {filterMode === 'chapter' && currentChapter ? `> ${currentChapter.name}` : ''}
            </span>
            <div className="filter-toggle">
              <button
                className={`filter-btn ${filterMode === 'chapter' ? 'active' : ''}`}
                onClick={() => setFilterMode('chapter')}
                title="Show chapter notes"
              >
                Chapter
              </button>
              <button
                className={`filter-btn ${filterMode === 'entire' ? 'active' : ''}`}
                onClick={() => setFilterMode('entire')}
                title="Show all subject notes"
              >
                Entire subject
              </button>
            </div>
          </div>

          <div className="doc-list" ref={docMenuRef}>
            {displayedNotes.map((note) => (
              <div
                key={note.id}
                className="doc-row"
                onClick={() => openNoteInEditor(note.id)}
                title="Open note in editor"
              >
                <div>
                  <div className="doc-info-title">
                    <span>{note.title}</span>
                  </div>
                  <div className="doc-info-meta">
                    {note.wordCount} words • updated {note.updatedAt}
                  </div>
                </div>

                <div
                  className="row-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className={`badge ${note.badge.includes('index') ? '' : 'badge-gold'}`}>
                    {note.badge}
                  </span>

                  <button
                    className="dots-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveMenuNoteId(activeMenuNoteId === note.id ? null : note.id)
                    }}
                    title="Options"
                  >
                    <IconMore size={15} />
                  </button>

                  {activeMenuNoteId === note.id && (
                    <div className="context-menu" style={{ right: 0, top: 28 }}>
                      <button
                        className="menu-item"
                        onClick={() => {
                          setActiveMenuNoteId(null)
                          openNoteInEditor(note.id)
                        }}
                      >
                        <IconEdit size={13} />
                        <span>Open in Editor</span>
                      </button>
                      <button
                        className="menu-item"
                        onClick={() => {
                          setActiveMenuNoteId(null)
                          generateFlashcardsFromNote(note.id)
                        }}
                      >
                        <IconCards size={13} />
                        <span>Generate Flashcards</span>
                      </button>
                      <button
                        className="menu-item"
                        onClick={() => {
                          setActiveMenuNoteId(null)
                          generateQuizFromNote(note.id)
                        }}
                      >
                        <IconHelpCircle size={13} />
                        <span>Generate Quiz</span>
                      </button>
                      <button
                        className="menu-item"
                        onClick={() => {
                          setActiveMenuNoteId(null)
                          generatePodcastFromNote(note.id)
                        }}
                      >
                        <IconHeadphones size={13} />
                        <span>Create Podcast</span>
                      </button>
                      <button
                        className="menu-item"
                        onClick={() => {
                          setActiveMenuNoteId(null)
                          duplicateNote(note.id)
                        }}
                      >
                        <IconCopy size={13} />
                        <span>Duplicate</span>
                      </button>
                      <button
                        className="menu-item danger"
                        onClick={() => {
                          setActiveMenuNoteId(null)
                          deleteNote(note.id)
                        }}
                      >
                        <IconTrash size={13} />
                        <span>Delete Note</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {displayedNotes.length === 0 && (
              <div className="empty-state-box">
                <div style={{ color: 'var(--text-muted)' }}>
                  <IconFile size={26} />
                </div>
                <div className="empty-state-title">
                  {searchQuery ? `No notes matching "${searchQuery}"` : 'No notes in this collection'}
                </div>
                <div className="empty-state-desc">
                  Start writing a new note or import existing documents.
                </div>
                <button
                  className="btn-primary"
                  style={{ marginTop: 6 }}
                  onClick={createBlankNote}
                >
                  + Add Note
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

import React, { useState, useRef, useEffect } from 'react'
import { useNotes } from '../context/NotesContext'
import {
  IconFile,
  IconMic,
  IconUpload,
  IconGlobe,
  IconFolder,
  IconFolderOpen,
  IconPlus,
  IconMore,
  IconEdit,
  IconCards,
  IconHelpCircle,
  IconHeadphones,
  IconCopy,
  IconTrash,
  IconClock,
  IconZap
} from '../components/icons'

export const NotesHubView: React.FC = () => {
  const {
    subjects,
    chapters,
    notes,
    flashcards,
    quizzes,
    podcasts,
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
  const [menuDirection, setMenuDirection] = useState<'down' | 'up'>('down')
  const newMenuRef = useRef<HTMLDivElement>(null)
  const docMenuRef = useRef<HTMLDivElement>(null)

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (newMenuRef.current && !newMenuRef.current.contains(target)) {
        setOpenNewMenu(false)
      }
      if (!target.closest('.context-menu') && !target.closest('.dots-btn')) {
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
        n.badge.toLowerCase().includes(q) ||
        (n.tags && n.tags.some((t) => t.toLowerCase().includes(q)))
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

  const totalWords = notes.reduce((acc, n) => acc + (n.wordCount || 0), 0)

  return (
    <div className="content-body">
      {/* Overview Stats Bar - Makes the UI feel filled and structured */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          padding: '14px 18px',
          borderRadius: 8,
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, transition: 'transform 0.18s ease' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              backgroundColor: 'rgba(137, 180, 250, 0.12)',
              color: 'var(--ctp-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.2s ease'
            }}
          >
            <IconFile size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Documents
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
              {notes.length} Notes ({totalWords.toLocaleString()} words)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, transition: 'transform 0.18s ease' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              backgroundColor: 'rgba(249, 226, 175, 0.12)',
              color: 'var(--ctp-yellow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.2s ease'
            }}
          >
            <IconFolder size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Knowledge Base
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
              {subjects.length} Subjects • {chapters.length} Chapters
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, transition: 'transform 0.18s ease' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              backgroundColor: 'rgba(166, 227, 161, 0.12)',
              color: 'var(--ctp-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.2s ease'
            }}
          >
            <IconZap size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Flashcards
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
              {flashcards.length} Cards in Deck
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, transition: 'transform 0.18s ease' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              backgroundColor: 'rgba(180, 190, 254, 0.12)',
              color: 'var(--ctp-lavender)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.2s ease'
            }}
          >
            <IconHeadphones size={18} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Synthesized Audio
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
              {podcasts.length} Podcasts • {quizzes.length} Quizzes
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid-cards">
        <div className="action-card" onClick={createBlankNote} title="Create blank markdown note">
          <div className="card-icon">
            <IconEdit size={17} />
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
            <IconGlobe size={17} />
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
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconFolder size={15} style={{ color: 'var(--ctp-blue)' }} />
              <span>Library Tree</span>
            </span>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                        {isSubActive ? (
                          <IconFolderOpen size={14} style={{ color: 'var(--ctp-blue)', flexShrink: 0 }} />
                        ) : (
                          <IconFolder size={14} style={{ flexShrink: 0 }} />
                        )}
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {sub.name}
                        </span>
                      </div>
                      <span className="tree-item-count">{subChapters.length}</span>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                              <IconFile size={13} style={{ flexShrink: 0 }} />
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {chap.name}
                              </span>
                            </div>
                            <span className="tree-item-count">{count}</span>
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
                  <IconPlus size={12} />
                  <span>Create Subject</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Active Subject Files View */}
        <div className="panel active-document-view">
          <div className="panel-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Collection:</span>
              <span style={{ color: 'var(--text-main)', fontWeight: 700 }}>
                {currentSubject ? currentSubject.name : 'All Notes'}
              </span>
              {filterMode === 'chapter' && currentChapter && (
                <span style={{ color: 'var(--ctp-blue)' }}>/ {currentChapter.name}</span>
              )}
            </span>
            <div className="filter-toggle">
              <button
                className={`filter-btn ${filterMode === 'chapter' ? 'active' : ''}`}
                onClick={() => setFilterMode('chapter')}
                title="Show active chapter notes only"
              >
                Active Chapter
              </button>
              <button
                className={`filter-btn ${filterMode === 'entire' ? 'active' : ''}`}
                onClick={() => setFilterMode('entire')}
                title="Show all subject notes"
              >
                All Subject Notes
              </button>
            </div>
          </div>

          <div className="doc-list" ref={docMenuRef}>
            {displayedNotes.map((note) => {
              const sub = subjects.find((s) => s.id === note.subjectId)
              const chap = chapters.find((c) => c.id === note.chapterId)
              const estReadMin = Math.max(1, Math.ceil((note.wordCount || 100) / 200))

              return (
                <div
                  key={note.id}
                  className={`doc-row ${activeMenuNoteId === note.id ? 'active-menu' : ''}`}
                  onClick={() => openNoteInEditor(note.id)}
                >
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                    <div className="doc-info-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {note.title}
                      </span>
                    </div>

                    <div className="doc-info-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--ctp-blue)' }}>{sub?.name || 'General'}</span>
                      {chap && (
                        <>
                          <span>•</span>
                          <span>{chap.name}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{note.wordCount} words (~{estReadMin} min)</span>
                      <span>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <IconClock size={11} />
                        {note.updatedAt}
                      </span>
                    </div>

                    {note.tags && note.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                        {note.tags.map((tag) => (
                          <span
                            key={tag}
                            style={{
                              fontSize: 10,
                              padding: '1px 6px',
                              borderRadius: 4,
                              backgroundColor: 'rgba(255, 255, 255, 0.04)',
                              color: 'var(--text-muted)'
                            }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
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
                        if (activeMenuNoteId === note.id) {
                          setActiveMenuNoteId(null)
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect()
                          const spaceBelow = window.innerHeight - rect.bottom
                          setMenuDirection(spaceBelow < 260 && rect.top > 260 ? 'up' : 'down')
                          setActiveMenuNoteId(note.id)
                        }
                      }}
                      title="More Actions"
                    >
                      <IconMore size={15} />
                    </button>

                    {activeMenuNoteId === note.id && (
                      <div
                        className={`context-menu ${menuDirection === 'up' ? 'menu-up' : ''}`}
                        style={{
                          right: 0,
                          ...(menuDirection === 'up' ? { bottom: 28, top: 'auto' } : { top: 28 })
                        }}
                      >
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
              )
            })}

            {displayedNotes.length === 0 && (
              <div className="empty-state-box">
                <div className="empty-state-icon">
                  <IconFile size={28} />
                </div>
                <div className="empty-state-title">
                  {searchQuery ? `No notes matching "${searchQuery}"` : 'No notes in this view'}
                </div>
                <div className="empty-state-desc">
                  Start drafting a new note, import documents, or switch chapters.
                </div>
                <button
                  className="btn-primary"
                  style={{ marginTop: 6 }}
                  onClick={createBlankNote}
                >
                  <IconPlus size={13} />
                  <span>Create Note</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

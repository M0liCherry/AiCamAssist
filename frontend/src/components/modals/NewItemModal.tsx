import React, { useState } from 'react'
import { useNotes } from '../../context/NotesContext'
import { IconFolderPlus, IconFilePlus, IconX } from '../icons'

export const NewItemModal: React.FC = () => {
  const {
    isNewItemModalOpen,
    closeNewItemModal,
    newItemType,
    subjects,
    chapters,
    activeSubjectId,
    activeChapterId,
    createSubject,
    createChapter,
    createNote
  } = useNotes()

  const [name, setName] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState(activeSubjectId || subjects[0]?.id || '')
  const [selectedChapterId, setSelectedChapterId] = useState(activeChapterId || chapters[0]?.id || '')

  if (!isNewItemModalOpen || !newItemType) return null

  const effectiveSubjectId = selectedSubjectId || subjects[0]?.id || ''
  const availableChapters = chapters.filter((c) => c.subjectId === effectiveSubjectId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    if (newItemType === 'subject') {
      createSubject(name)
    } else if (newItemType === 'chapter') {
      createChapter(effectiveSubjectId, name)
    } else if (newItemType === 'note') {
      createNote(name.trim(), effectiveSubjectId, selectedChapterId || availableChapters[0]?.id)
    }

    setName('')
    closeNewItemModal()
  }

  const getTitle = () => {
    switch (newItemType) {
      case 'subject':
        return 'Create New Subject'
      case 'chapter':
        return 'Create New Chapter'
      case 'note':
        return 'Create New Note'
    }
  }

  return (
    <div className="modal-overlay" onClick={closeNewItemModal}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {newItemType === 'subject' ? (
              <IconFolderPlus size={18} style={{ color: 'var(--ctp-blue)' }} />
            ) : (
              <IconFilePlus size={18} style={{ color: 'var(--ctp-blue)' }} />
            )}
            <span>{getTitle()}</span>
          </h2>
          <button className="modal-close-btn" onClick={closeNewItemModal} title="Close">
            <IconX size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {newItemType === 'chapter' && (
            subjects.length > 0 ? (
              <div className="form-group">
                <label className="form-label">Parent Subject</label>
                <select
                  className="form-select"
                  value={effectiveSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 6,
                  backgroundColor: 'var(--ctp-surface0)',
                  border: '1px solid var(--border-color)',
                  fontSize: 12.5,
                  color: 'var(--text-muted)'
                }}
              >
                No subjects created yet. Please create a subject first before adding chapters.
              </div>
            )
          )}

          {newItemType === 'note' && (
            subjects.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <select
                    className="form-select"
                    value={effectiveSubjectId}
                    onChange={(e) => {
                      setSelectedSubjectId(e.target.value)
                      const firstChap = chapters.find((c) => c.subjectId === e.target.value)
                      if (firstChap) setSelectedChapterId(firstChap.id)
                    }}
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Chapter</label>
                  <select
                    className="form-select"
                    value={selectedChapterId || availableChapters[0]?.id || ''}
                    onChange={(e) => setSelectedChapterId(e.target.value)}
                  >
                    {availableChapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 6,
                  backgroundColor: 'rgba(137, 180, 250, 0.08)',
                  border: '1px solid rgba(137, 180, 250, 0.2)',
                  fontSize: 12.5,
                  color: 'var(--ctp-blue)'
                }}
              >
                A default <strong>General / Notes</strong> category will be created automatically for this note.
              </div>
            )
          )}

          <div className="form-group">
            <label className="form-label">
              {newItemType === 'subject'
                ? 'Subject Name'
                : newItemType === 'chapter'
                ? 'Chapter Name'
                : 'Note Title'}
            </label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                newItemType === 'subject'
                  ? 'e.g. Distributed Systems'
                  : newItemType === 'chapter'
                  ? 'e.g. Consensus Protocols'
                  : 'e.g. Raft vs Paxos Tradeoffs'
              }
              autoFocus
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={closeNewItemModal}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!name.trim() || (newItemType === 'chapter' && subjects.length === 0)}
            >
              Create {newItemType.charAt(0).toUpperCase() + newItemType.slice(1)}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

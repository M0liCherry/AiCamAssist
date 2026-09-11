import React, { useState } from 'react'
import { useNotes } from '../../context/NotesContext'

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
    openNoteInEditor,
    updateNote
  } = useNotes()

  const [name, setName] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState(activeSubjectId)
  const [selectedChapterId, setSelectedChapterId] = useState(activeChapterId)

  if (!isNewItemModalOpen || !newItemType) return null

  const availableChapters = chapters.filter((c) => c.subjectId === selectedSubjectId)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    if (newItemType === 'subject') {
      createSubject(name)
    } else if (newItemType === 'chapter') {
      createChapter(selectedSubjectId, name)
    } else if (newItemType === 'note') {
      const newNoteId = `note-${Date.now()}`
      const newNote = {
        id: newNoteId,
        title: name,
        subjectId: selectedSubjectId,
        chapterId: selectedChapterId,
        badge: 'document',
        updatedAt: 'Just now',
        wordCount: 0,
        content: `# ${name}\n\nStart writing your note content...`
      }
      // Add note and open in editor
      updateNote(newNoteId, newNote)
      openNoteInEditor(newNoteId)
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
          <h2>{getTitle()}</h2>
          <button className="modal-close-btn" onClick={closeNewItemModal}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {newItemType === 'chapter' && (
            <div className="form-group">
              <label className="form-label">Parent Subject</label>
              <select
                className="form-select"
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {newItemType === 'note' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <select
                  className="form-select"
                  value={selectedSubjectId}
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
                  value={selectedChapterId}
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
                  ? 'e.g. Consensus Protocols (1)'
                  : 'e.g. Raft vs Paxos'
              }
              autoFocus
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={closeNewItemModal}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!name.trim()}>
              Create {newItemType}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

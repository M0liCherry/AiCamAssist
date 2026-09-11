import React, { useState } from 'react'
import { useNotes } from '../../context/NotesContext'

export const WebImportModal: React.FC = () => {
  const {
    isWebModalOpen,
    setIsWebModalOpen,
    subjects,
    chapters,
    activeSubjectId,
    activeChapterId,
    importWebNote
  } = useNotes()

  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState(activeSubjectId)
  const [chapterId, setChapterId] = useState(activeChapterId)
  const [isLoading, setIsLoading] = useState(false)

  if (!isWebModalOpen) return null

  const availableChapters = chapters.filter((c) => c.subjectId === subjectId)

  const handleImport = () => {
    if (!url.trim()) return

    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      const isYoutube = url.includes('youtube.com') || url.includes('youtu.be')
      const simulatedContent = isYoutube
        ? `## Video Summary\n\n- Source: ${url}\n- Timestamps and transcript imported.`
        : `## Article Content\n\n- Source: ${url}\n- Content imported into note.`

      importWebNote(title || 'Web Import', url, simulatedContent, subjectId, chapterId)
      setIsWebModalOpen(false)
    }, 400)
  }

  return (
    <div className="modal-overlay" onClick={() => setIsWebModalOpen(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔗 Import Website or YouTube Video</h2>
          <button className="modal-close-btn" onClick={() => setIsWebModalOpen(false)}>
            ✕
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Extract article text, documentation, or YouTube video transcripts directly into your workspace.
        </p>

        <div className="form-group">
          <label className="form-label">URL (Article or YouTube Link)</label>
          <input
            className="form-input"
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              if (e.target.value.includes('youtube')) {
                setTitle('YouTube Video Transcript & Breakdown')
              }
            }}
            placeholder="https://example.com/article or https://youtube.com/watch?v=..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">Note Title</label>
          <input
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Overview of Strategic Principles"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Subject</label>
            <select
              className="form-select"
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value)
                const firstChap = chapters.find((c) => c.subjectId === e.target.value)
                if (firstChap) setChapterId(firstChap.id)
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
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
            >
              {availableChapters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setIsWebModalOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!url || isLoading}
            onClick={handleImport}
          >
            {isLoading ? 'Fetching & Parsing...' : 'Import Content'}
          </button>
        </div>
      </div>
    </div>
  )
}

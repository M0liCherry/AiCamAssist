import React, { useState } from 'react'
import { useNotes } from '../../context/NotesContext'
import { IconGlobe, IconX } from '../icons'

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
  const [subjectId, setSubjectId] = useState(activeSubjectId || subjects[0]?.id || '')
  const [chapterId, setChapterId] = useState(activeChapterId || chapters[0]?.id || '')
  const [isLoading, setIsLoading] = useState(false)

  if (!isWebModalOpen) return null

  const effectiveSubjectId = subjectId || subjects[0]?.id || ''
  const availableChapters = chapters.filter((c) => c.subjectId === effectiveSubjectId)

  const handleImport = () => {
    if (!url.trim()) return

    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      const isYoutube = url.includes('youtube.com') || url.includes('youtu.be')
      const effectiveTitle = title.trim() || (isYoutube ? 'YouTube Video Breakdown' : 'Web Research Document')
      const simulatedContent = isYoutube
        ? `## Video Summary & Key Points\n\n- **Source**: ${url}\n- **Analysis**: Extracted structured lecture notes, conceptual outlines, and audio chapter timestamps.\n\n### Core Insights\n1. Primary theoretical principles established.\n2. Concrete architecture implementation walkthrough.\n3. Practical performance and scaling considerations.`
        : `## Article Content\n\n- **Source**: ${url}\n- **Imported**: ${new Date().toLocaleDateString()}\n\n### Executive Summary\nExtracted full text and converted to structured Markdown notes with key domain principles.`

      importWebNote(effectiveTitle, url.trim(), simulatedContent, effectiveSubjectId, chapterId || availableChapters[0]?.id)
      setIsWebModalOpen(false)
      setUrl('')
      setTitle('')
    }, 400)
  }

  return (
    <div className="modal-overlay" onClick={() => setIsWebModalOpen(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <IconGlobe size={18} style={{ color: 'var(--ctp-blue)' }} />
            <span>Import Website or Video</span>
          </h2>
          <button className="modal-close-btn" onClick={() => setIsWebModalOpen(false)} title="Close">
            <IconX size={16} />
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
              if (!title && (e.target.value.includes('youtube') || e.target.value.includes('youtu.be'))) {
                setTitle('Video Lecture Notes')
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

        {subjects.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Destination Subject</label>
              <select
                className="form-select"
                value={effectiveSubjectId}
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
              <label className="form-label">Destination Chapter</label>
              <select
                className="form-select"
                value={chapterId || availableChapters[0]?.id || ''}
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
            Web content will be saved into a new <strong>General / Web Imports</strong> collection.
          </div>
        )}

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

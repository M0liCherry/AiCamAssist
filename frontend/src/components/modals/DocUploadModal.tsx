import React, { useState } from 'react'
import { useNotes } from '../../context/NotesContext'

export const DocUploadModal: React.FC = () => {
  const {
    isDocModalOpen,
    setIsDocModalOpen,
    subjects,
    chapters,
    activeSubjectId,
    activeChapterId,
    importDocumentNote
  } = useNotes()

  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState(activeSubjectId)
  const [chapterId, setChapterId] = useState(activeChapterId)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [fileExt, setFileExt] = useState<string>('pdf')

  if (!isDocModalOpen) return null

  const availableChapters = chapters.filter((c) => c.subjectId === subjectId)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const baseName = file.name.replace(/\.[^/.]+$/, '')
      setTitle(baseName)
      const ext = file.name.split('.').pop()?.toLowerCase() || 'txt'
      setFileExt(ext)

      // If text/markdown, read contents
      if (ext === 'txt' || ext === 'md') {
        const reader = new FileReader()
        reader.onload = (event) => {
          setFileContent((event.target?.result as string) || '')
        }
        reader.readAsText(file)
      } else {
        // Mock parsed content for PDF/DOCX
        setFileContent(`# ${baseName}\n\n*Imported from ${file.name}*`)
      }
    }
  }

  const handleImport = () => {
    const finalTitle = title || selectedFile?.name || 'Uploaded Document'
    const finalContent =
      fileContent ||
      `# ${finalTitle}\n\n*Imported document*\n\nDocument contents parsed and converted to Markdown.`
    importDocumentNote(finalTitle, finalContent, fileExt, subjectId, chapterId)
    setIsDocModalOpen(false)
  }

  return (
    <div className="modal-overlay" onClick={() => setIsDocModalOpen(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📁 Document Upload</h2>
          <button className="modal-close-btn" onClick={() => setIsDocModalOpen(false)}>
            ✕
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Import PDFs, Word documents, PowerPoint slides, Markdown notes, or plain text into your library.
        </p>

        <div className="form-group">
          <label className="form-label">Note Title</label>
          <input
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Distributed Database Systems Chapter 3"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Destination Subject</label>
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
            <label className="form-label">Destination Chapter</label>
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

        <div
          style={{
            border: '2px dashed var(--border-color)',
            borderRadius: 10,
            padding: 24,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(13, 17, 26, 0.4)'
          }}
        >
          <div style={{ fontSize: 30 }}>📄</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {selectedFile ? `${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)` : 'Drag & drop your files or browse'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Supported formats: PDF, DOCX, PPTX, TXT, MD
          </div>

          <label className="btn-secondary" style={{ cursor: 'pointer', marginTop: 4 }}>
            Select File
            <input
              type="file"
              accept=".pdf,.docx,.pptx,.txt,.md"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setIsDocModalOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!selectedFile && !title}
            onClick={handleImport}
          >
            Import Document
          </button>
        </div>
      </div>
    </div>
  )
}

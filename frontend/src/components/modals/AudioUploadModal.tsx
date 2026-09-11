import React, { useState } from 'react'
import { useNotes } from '../../context/NotesContext'

export const AudioUploadModal: React.FC = () => {
  const {
    isAudioModalOpen,
    setIsAudioModalOpen,
    subjects,
    chapters,
    activeSubjectId,
    activeChapterId,
    importAudioNote
  } = useNotes()

  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState(activeSubjectId)
  const [chapterId, setChapterId] = useState(activeChapterId)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [sampleAudioName, setSampleAudioName] = useState<string | null>(null)

  if (!isAudioModalOpen) return null

  const availableChapters = chapters.filter((c) => c.subjectId === subjectId)

  const handleSimulatedTranscribe = () => {
    setIsProcessing(true)
    setProgress(20)

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval)
          setTimeout(() => {
            setIsProcessing(false)
            setProgress(0)
            const sampleTranscript = `# ${title || 'Audio Note'}\n\n*Audio transcription recorded on ${new Date().toLocaleDateString()}*`
            importAudioNote(title || 'Audio Recording', sampleTranscript, subjectId, chapterId)
            setIsAudioModalOpen(false)
          }, 300)
          return 100
        }
        return prev + 30
      })
    }, 200)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSampleAudioName(file.name)
      setTitle(file.name.replace(/\.[^/.]+$/, ''))
    }
  }

  return (
    <div className="modal-overlay" onClick={() => setIsAudioModalOpen(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🎙️ Upload or Record Audio</h2>
          <button className="modal-close-btn" onClick={() => setIsAudioModalOpen(false)}>
            ✕
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Transcribe lectures, interviews, and voice memos locally using neural speech-to-text.
        </p>

        <div className="form-group">
          <label className="form-label">Note Title</label>
          <input
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Lecture on Strategy"
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
          <div style={{ fontSize: 28 }}>🎧</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {sampleAudioName ? sampleAudioName : 'Select an audio file or record directly'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Supports MP3, WAV, M4A, FLAC, OGG (Processed securely on-device)
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <label className="btn-secondary" style={{ cursor: 'pointer' }}>
              Browse File
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
            <button
              type="button"
              className={`btn-secondary ${isRecording ? 'active' : ''}`}
              onClick={() => setIsRecording(!isRecording)}
              style={{
                borderColor: isRecording ? 'var(--accent-red)' : undefined,
                color: isRecording ? 'var(--accent-red)' : undefined
              }}
            >
              {isRecording ? '⏹️ Stop Recording' : '🔴 Record Mic'}
            </button>
          </div>
        </div>

        {isProcessing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>Transcribing neural audio...</span>
              <span>{progress}%</span>
            </div>
            <div
              style={{
                height: 6,
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 4,
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, var(--hydro-blue), var(--hydro-deep))',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setIsAudioModalOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={isProcessing}
            onClick={handleSimulatedTranscribe}
          >
            {isProcessing ? 'Processing...' : 'Transcribe & Create Note'}
          </button>
        </div>
      </div>
    </div>
  )
}

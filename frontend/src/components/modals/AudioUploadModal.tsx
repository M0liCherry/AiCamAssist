import React, { useState } from 'react'
import { useNotes } from '../../context/NotesContext'
import { IconMic, IconX, IconHeadphones, IconSquare, IconCircleDot, IconUpload } from '../icons'

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
  const [subjectId, setSubjectId] = useState(activeSubjectId || subjects[0]?.id || '')
  const [chapterId, setChapterId] = useState(activeChapterId || chapters[0]?.id || '')
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [sampleAudioName, setSampleAudioName] = useState<string | null>(null)

  if (!isAudioModalOpen) return null

  const effectiveSubjectId = subjectId || subjects[0]?.id || ''
  const availableChapters = chapters.filter((c) => c.subjectId === effectiveSubjectId)

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
            const noteTitle = title.trim() || (sampleAudioName ? sampleAudioName.replace(/\.[^/.]+$/, '') : 'Lecture Audio Note')
            const sampleTranscript = `# ${noteTitle}\n\n*Audio transcription captured on ${new Date().toLocaleDateString()}*\n\n## Key Audio Excerpts\n- Comprehensive explanation of core mechanisms and structural designs.\n- Emphasized architectural trade-offs, edge-case mitigation, and consistency boundaries.\n\n## Action Items\n- Review follow-up literature and verify benchmark assumptions.`
            importAudioNote(noteTitle, sampleTranscript, effectiveSubjectId, chapterId || availableChapters[0]?.id)
            setIsAudioModalOpen(false)
            setTitle('')
            setSampleAudioName(null)
          }, 350)
          return 100
        }
        return prev + 25
      })
    }, 180)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSampleAudioName(file.name)
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  return (
    <div className="modal-overlay" onClick={() => setIsAudioModalOpen(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <IconMic size={18} style={{ color: 'var(--ctp-blue)' }} />
            <span>Upload or Record Audio</span>
          </h2>
          <button
            className="modal-close-btn"
            onClick={() => setIsAudioModalOpen(false)}
            title="Close"
          >
            <IconX size={16} />
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
            placeholder="e.g. Distributed Consensus Lecture 4"
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
            Transcribed audio note will be saved into a new <strong>General / Audio</strong> collection.
          </div>
        )}

        <div
          style={{
            border: '1px dashed var(--border-color)',
            borderRadius: 8,
            padding: 24,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            background: 'var(--ctp-crust)'
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              backgroundColor: 'var(--ctp-surface0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ctp-blue)'
            }}
          >
            <IconHeadphones size={26} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {sampleAudioName ? sampleAudioName : 'Select an audio recording or speak into mic'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Supports MP3, WAV, M4A, FLAC, OGG • Local on-device transcription
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <label className="btn-secondary" style={{ cursor: 'pointer' }}>
              <IconUpload size={13} />
              <span>Browse Audio</span>
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
                borderColor: isRecording ? 'var(--ctp-red)' : undefined,
                color: isRecording ? 'var(--ctp-red)' : undefined
              }}
            >
              {isRecording ? (
                <>
                  <IconSquare size={13} />
                  <span>Stop Recording</span>
                </>
              ) : (
                <>
                  <IconCircleDot size={13} />
                  <span>Record Mic</span>
                </>
              )}
            </button>
          </div>
        </div>

        {isProcessing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ctp-blue)' }}>
              <span>Transcribing audio locally...</span>
              <span>{progress}%</span>
            </div>
            <div
              style={{
                height: 6,
                background: 'var(--ctp-surface0)',
                borderRadius: 4,
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'var(--ctp-blue)',
                  transition: 'width 0.25s ease'
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

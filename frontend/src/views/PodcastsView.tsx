import React, { useState, useEffect } from 'react'
import { useNotes } from '../context/NotesContext'

export const PodcastsView: React.FC = () => {
  const { podcasts, subjects, notes, generatePodcastFromNote } = useNotes()

  const [activeEpisodeId, setActiveEpisodeId] = useState<string>(podcasts[0]?.id || '')
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTimeSec, setCurrentTimeSec] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1)
  const [selectedNoteForGen, setSelectedNoteForGen] = useState<string>(notes[0]?.id || '')
  const [showGenModal, setShowGenModal] = useState(false)

  const activeEpisode = podcasts.find((p) => p.id === activeEpisodeId) || podcasts[0]

  // Playback timer simulation
  useEffect(() => {
    let interval: any
    if (isPlaying && activeEpisode) {
      interval = setInterval(() => {
        setCurrentTimeSec((prev) => {
          if (prev >= activeEpisode.durationSeconds) {
            setIsPlaying(false)
            return 0
          }
          return prev + 1
        })
      }, 1000 / playbackSpeed)
    }
    return () => clearInterval(interval)
  }, [isPlaying, playbackSpeed, activeEpisode])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleGenerate = () => {
    if (!selectedNoteForGen) return
    generatePodcastFromNote(selectedNoteForGen)
    setShowGenModal(false)
  }

  return (
    <div className="content-body">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)' }}>
            🎙️ AI Podcasts Studio
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
            Audio dialogues synthesized from your notes and study materials.
          </p>
        </div>

        {notes.length > 0 && (
          <button className="btn-primary" onClick={() => setShowGenModal(true)}>
            + Generate Episode
          </button>
        )}
      </div>

      {podcasts.length === 0 ? (
        <div className="empty-state-box" style={{ padding: '60px 20px' }}>
          <div style={{ fontSize: 32 }}>🎙️</div>
          <div className="empty-state-title">No Podcast Episodes Yet</div>
          <div className="empty-state-desc">
            Synthesize any note into a conversational audio dialogue.
          </div>
          {notes.length > 0 ? (
            <button
              className="btn-primary"
              style={{ marginTop: 8 }}
              onClick={() => setShowGenModal(true)}
            >
              + Generate Episode
            </button>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Add a note in the workspace first to generate podcast episodes.
            </div>
          )}
        </div>
      ) : (
        <>
          {activeEpisode && (
            <div className="audio-player-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="badge" style={{ marginBottom: 6 }}>
                    Dialogue Episode
                  </span>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>{activeEpisode.title}</h3>
                  <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                    {activeEpisode.summary}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {[1, 1.25, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      className={`filter-btn ${playbackSpeed === spd ? 'active' : ''}`}
                      onClick={() => setPlaybackSpeed(spd)}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Equalizer Visualizer */}
              <div className="audio-bars-container">
                {Array.from({ length: 36 }).map((_, i) => {
                  const height = isPlaying
                    ? Math.floor(6 + Math.sin(i + currentTimeSec * 2) * 12 + (i % 4) * 3)
                    : 4
                  return (
                    <div
                      key={i}
                      className="audio-bar"
                      style={{
                        height: `${height}px`,
                        opacity: isPlaying ? 0.9 : 0.4
                      }}
                    />
                  )
                })}
              </div>

              {/* Playback Controls & Progress Bar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    className="card-icon"
                    style={{
                      width: 38,
                      height: 38,
                      fontSize: 16,
                      cursor: 'pointer',
                      backgroundColor: 'var(--ctp-blue)',
                      color: 'var(--ctp-crust)'
                    }}
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? '⏸' : '▶'}
                  </button>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <input
                      type="range"
                      min={0}
                      max={activeEpisode.durationSeconds}
                      value={currentTimeSec}
                      onChange={(e) => setCurrentTimeSec(Number(e.target.value))}
                      style={{
                        accentColor: 'var(--ctp-blue)',
                        width: '100%',
                        cursor: 'pointer'
                      }}
                    />
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11,
                        color: 'var(--text-muted)'
                      }}
                    >
                      <span>{formatTime(currentTimeSec)}</span>
                      <span>{activeEpisode.duration}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Synced Transcript */}
              <div style={{ marginTop: 8 }}>
                <h4 style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
                  Transcript
                </h4>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    maxHeight: 200,
                    overflowY: 'auto'
                  }}
                >
                  {activeEpisode.transcript.map((line, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        backgroundColor: 'var(--ctp-crust)',
                        border: '1px solid var(--border-color)',
                        fontSize: 12.5,
                        lineHeight: 1.45,
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        const parts = line.time.split(':')
                        const jumpSec = parseInt(parts[0]) * 60 + parseInt(parts[1])
                        setCurrentTimeSec(jumpSec)
                        setIsPlaying(true)
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, color: 'var(--ctp-blue)' }}>
                          {line.speaker}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{line.time}</span>
                      </div>
                      <div style={{ color: 'var(--text-main)' }}>{line.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Episodes List */}
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Episodes ({podcasts.length})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {podcasts.map((ep) => {
                const isCur = ep.id === activeEpisodeId
                const sub = subjects.find((s) => s.id === ep.subjectId)

                return (
                  <div
                    key={ep.id}
                    className="panel"
                    style={{
                      cursor: 'pointer',
                      borderColor: isCur ? 'var(--ctp-blue)' : undefined,
                      backgroundColor: isCur ? 'var(--bg-surface-hover)' : undefined
                    }}
                    onClick={() => {
                      setActiveEpisodeId(ep.id)
                      setCurrentTimeSec(0)
                      setIsPlaying(true)
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span className="badge">{sub?.name || 'General'}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>⏱ {ep.duration}</span>
                    </div>
                    <h4 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                      {ep.title}
                    </h4>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {ep.summary}
                    </p>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 10,
                        paddingTop: 8,
                        borderTop: '1px solid var(--border-color)',
                        fontSize: 11.5,
                        color: 'var(--ctp-blue)'
                      }}
                    >
                      <span>{isCur && isPlaying ? 'Playing' : 'Play Episode'}</span>
                      <span>{ep.date}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Generate Episode Modal */}
      {showGenModal && (
        <div className="modal-overlay" onClick={() => setShowGenModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🎙️ Generate Podcast Episode</h2>
              <button className="modal-close-btn" onClick={() => setShowGenModal(false)}>
                ✕
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              Choose a note from your library to synthesize into an audio discussion.
            </p>

            <div className="form-group">
              <label className="form-label">Source Document</label>
              <select
                className="form-select"
                value={selectedNoteForGen}
                onChange={(e) => setSelectedNoteForGen(e.target.value)}
              >
                {notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowGenModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleGenerate}>
                Synthesize
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

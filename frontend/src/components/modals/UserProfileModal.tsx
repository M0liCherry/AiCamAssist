import React from 'react'
import { useNotes } from '../../context/NotesContext'
import { IconUser, IconX, IconSettings, IconDownload, IconShield } from '../icons'

export const UserProfileModal: React.FC = () => {
  const {
    isUserProfileOpen,
    setIsUserProfileOpen,
    notes,
    subjects,
    flashcards,
    quizzes,
    exportAllDataAsJson,
    setActiveView
  } = useNotes()

  if (!isUserProfileOpen) return null

  const totalWords = notes.reduce((acc, n) => acc + (n.wordCount || 0), 0)
  const masteredCards = flashcards.filter((f) => f.mastery === 'mastered').length

  return (
    <div className="modal-overlay" onClick={() => setIsUserProfileOpen(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <IconUser size={18} style={{ color: 'var(--ctp-blue)' }} />
            <span>User Profile & Workspace</span>
          </h2>
          <button className="modal-close-btn" onClick={() => setIsUserProfileOpen(false)} title="Close">
            <IconX size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 0' }}>
          <div
            className="avatar"
            style={{ width: 50, height: 50, fontSize: 20, backgroundColor: 'var(--ctp-surface0)', color: 'var(--ctp-blue)' }}
          >
            <IconUser size={24} />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Local User</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Verity Study Workspace • Client v1.0.0
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ctp-green)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconShield size={13} />
              <span>100% Offline-First (zero cloud exposure)</span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 10,
            marginTop: 4
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--ctp-crust)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              padding: 12
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Notes
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
              {notes.length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              across {subjects.length} subjects
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'var(--ctp-crust)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              padding: 12
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Words Drafted
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ctp-blue)', marginTop: 2 }}>
              {totalWords.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>stored locally</div>
          </div>

          <div
            style={{
              backgroundColor: 'var(--ctp-crust)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              padding: 12
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Flashcards
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ctp-yellow)', marginTop: 2 }}>
              {masteredCards} / {flashcards.length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>mastered</div>
          </div>

          <div
            style={{
              backgroundColor: 'var(--ctp-crust)',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              padding: 12
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Quizzes Available
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
              {quizzes.length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>evaluation modules</div>
          </div>
        </div>

        <div className="modal-footer" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setIsUserProfileOpen(false)
              setActiveView('settings')
            }}
          >
            <IconSettings size={14} />
            <span>App Settings</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              exportAllDataAsJson()
              setIsUserProfileOpen(false)
            }}
          >
            <IconDownload size={14} />
            <span>Export Backup</span>
          </button>
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import { useNotes } from '../context/NotesContext'
import type { ActiveView } from '../types'
import {
  IconFolder,
  IconEdit,
  IconHeadphones,
  IconCards,
  IconHelpCircle,
  IconSettings,
  IconUser
} from './icons'

export const Sidebar: React.FC = () => {
  const { activeView, setActiveView, setIsUserProfileOpen } = useNotes()

  const navItems: { view: ActiveView; label: string; icon: React.ReactNode }[] = [
    { view: 'hub', label: 'Notes Hub', icon: <IconFolder size={15} /> },
    { view: 'editor', label: 'Document Editor', icon: <IconEdit size={15} /> },
    { view: 'podcasts', label: 'Podcasts', icon: <IconHeadphones size={15} /> },
    { view: 'flashcards', label: 'Flashcards', icon: <IconCards size={15} /> },
    { view: 'quizzes', label: 'Quizzes', icon: <IconHelpCircle size={15} /> }
  ]

  return (
    <aside>
      <div>
        <div className="brand" onClick={() => setActiveView('hub')} title="Verity">
          <div className="brand-logo">V</div>
          <div className="brand-name">Verity</div>
        </div>

        <div className="nav-section">
          <span className="nav-label">Workspace</span>
          {navItems.map((item) => {
            const isActive = activeView === item.view
            return (
              <button
                key={item.view}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveView(item.view)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="nav-section" style={{ marginBottom: 16 }}>
          <button
            className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveView('settings')}
          >
            <span className="nav-icon">
              <IconSettings size={15} />
            </span>
            <span>Settings</span>
          </button>
        </div>

        <div
          className="user-profile"
          onClick={() => setIsUserProfileOpen(true)}
          title="User Workspace"
        >
          <div className="avatar">
            <IconUser size={15} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Local User</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>v1.0.0</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

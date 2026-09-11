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
  IconUser,
  IconShield
} from './icons'

export const Sidebar: React.FC = () => {
  const { activeView, setActiveView, setIsUserProfileOpen, notes, flashcards, quizzes, podcasts } = useNotes()

  const navItems: { view: ActiveView; label: string; icon: React.ReactNode; badge?: number }[] = [
    { view: 'hub', label: 'Notes Hub', icon: <IconFolder size={15} />, badge: notes.length },
    { view: 'editor', label: 'Document Editor', icon: <IconEdit size={15} /> },
    { view: 'podcasts', label: 'Podcasts', icon: <IconHeadphones size={15} />, badge: podcasts.length },
    { view: 'flashcards', label: 'Flashcards', icon: <IconCards size={15} />, badge: flashcards.length },
    { view: 'quizzes', label: 'Quizzes', icon: <IconHelpCircle size={15} />, badge: quizzes.length }
  ]

  return (
    <aside>
      <div>
        <div className="brand" onClick={() => setActiveView('hub')} title="Verity - Local Study Workspace">
          <div className="brand-logo">V</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="brand-name">Verity</div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.3 }}>STUDY WORKSPACE</span>
          </div>
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
                <span style={{ flex: 1 }}>{item.label}</span>
                {typeof item.badge === 'number' && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: 10,
                      backgroundColor: isActive ? 'var(--ctp-blue)' : 'var(--ctp-crust)',
                      color: isActive ? 'var(--ctp-crust)' : 'var(--text-muted)'
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <div className="nav-section" style={{ marginBottom: 12 }}>
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
          title="User Workspace & Offline Status"
        >
          <div className="avatar">
            <IconUser size={15} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>Local User</div>
            <div style={{ fontSize: 10.5, color: 'var(--ctp-green)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconShield size={11} /> 100% Offline
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

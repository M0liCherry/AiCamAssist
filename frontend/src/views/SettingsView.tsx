import React, { useRef } from 'react'
import { useNotes } from '../context/NotesContext'
import type { ThemeName, FontPreference } from '../types'
import { IconCheck, IconDownload, IconUpload, IconRotateCcw, IconSettings } from '../components/icons'

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    resetToDefaults,
    exportAllDataAsJson,
    importDataFromJson,
    notes,
    subjects,
    chapters,
    flashcards,
    quizzes
  } = useNotes()

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        if (text) importDataFromJson(text)
      }
      reader.readAsText(file)
    }
  }

  const themes: { id: ThemeName; name: string; accent: string; bg: string }[] = [
    { id: 'mocha', name: 'Mocha (Dark)', accent: '#89b4fa', bg: '#1e1e2e' },
    { id: 'macchiato', name: 'Macchiato', accent: '#8aadf4', bg: '#24273a' },
    { id: 'frappe', name: 'Frappé', accent: '#8caaee', bg: '#303446' },
    { id: 'latte', name: 'Latte (Light)', accent: '#1e66f5', bg: '#eff1f5' }
  ]

  return (
    <div className="content-body" style={{ maxWidth: 840 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconSettings size={20} style={{ color: 'var(--ctp-blue)' }} />
          <span>Settings</span>
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
          Appearance, themes, typography, and local data.
        </p>
      </div>

      {/* Theme Selection */}
      <div className="panel" style={{ gap: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Catppuccin Theme</h3>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          Select your flavor. Applied across the entire interface.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {themes.map((th) => {
            const isSelected = settings.theme === th.id
            const textColor = th.id === 'latte' ? '#4c4f69' : '#cdd6f4'
            return (
              <div
                key={th.id}
                onClick={() => updateSettings({ theme: th.id })}
                style={{
                  padding: 12,
                  borderRadius: 6,
                  border: isSelected ? `2px solid var(--ctp-blue)` : '1px solid var(--border-color)',
                  backgroundColor: th.bg,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  transition: 'border-color 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: th.accent
                      }}
                    />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: textColor }}>{th.name}</span>
                  </div>
                  {isSelected && (
                    <span style={{ color: 'var(--ctp-blue)' }}>
                      <IconCheck size={13} />
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: isSelected ? 'var(--ctp-blue)' : 'var(--text-muted)' }}>
                  {isSelected ? 'Active theme' : 'Select'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Typography */}
      <div className="panel" style={{ gap: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Typography Font</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { id: 'sans', label: 'System Sans', preview: 'Clean system typography' },
            { id: 'mono', label: 'Developer Monospace', preview: 'const verity = true;' },
            { id: 'dyslexic', label: 'High Legibility', preview: 'Clear reading typography' }
          ].map((f) => (
            <button
              key={f.id}
              className={`btn-secondary ${settings.font === f.id ? 'active' : ''}`}
              style={{
                flex: 1,
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '10px 14px',
                borderColor: settings.font === f.id ? 'var(--ctp-blue)' : undefined
              }}
              onClick={() => updateSettings({ font: f.id as FontPreference })}
            >
              <span style={{ fontWeight: 600, fontSize: 12.5 }}>{f.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {f.preview}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Storage & Backup */}
      <div className="panel" style={{ gap: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Data & Storage</h3>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
          Data is stored locally on this machine.
        </p>

        <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: 'var(--text-muted)' }}>
          <span>{subjects.length} Subjects</span>
          <span>•</span>
          <span>{chapters.length} Chapters</span>
          <span>•</span>
          <span>{notes.length} Notes</span>
          <span>•</span>
          <span>{flashcards.length} Cards</span>
          <span>•</span>
          <span>{quizzes.length} Quizzes</span>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button className="btn-primary" onClick={exportAllDataAsJson}>
            <IconDownload size={13} />
            <span>Export JSON</span>
          </button>

          <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
            <IconUpload size={13} />
            <span>Import JSON</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            style={{ display: 'none' }}
          />

          <button
            className="btn-secondary"
            style={{ color: 'var(--ctp-red)' }}
            onClick={() => {
              if (window.confirm('Clear all workspace data and reset?')) {
                resetToDefaults()
              }
            }}
          >
            <IconRotateCcw size={13} />
            <span>Reset Data</span>
          </button>
        </div>
      </div>

      {/* Legal */}
      <div className="panel" style={{ gap: 10 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Privacy & Open Source</h3>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          <p>
            <strong>Local-First Guarantee:</strong> Verity operates with an on-device data policy.
            Notes and study materials remain stored in local browser storage.
          </p>
          <p style={{ marginTop: 6 }}>
            Verity v1.0.0. Licensed under the MIT License.
          </p>
        </div>
      </div>
    </div>
  )
}

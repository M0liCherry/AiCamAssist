import React from 'react'
import { useNotes } from '../context/NotesContext'
import { IconCheckCircle, IconAlertTriangle, IconInfo } from './icons'

export const Toast: React.FC = () => {
  const { toast } = useNotes()
  if (!toast) return null

  const getIcon = () => {
    if (toast.type === 'success') return <IconCheckCircle size={15} style={{ color: 'var(--ctp-green)' }} />
    if (toast.type === 'warn') return <IconAlertTriangle size={15} style={{ color: 'var(--ctp-red)' }} />
    return <IconInfo size={15} style={{ color: 'var(--ctp-blue)' }} />
  }

  return (
    <div className="toast-container">
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{getIcon()}</span>
      <span>{toast.message}</span>
    </div>
  )
}

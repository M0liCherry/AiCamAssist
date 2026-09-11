import React from 'react'
import { useNotes } from '../context/NotesContext'

export const Toast: React.FC = () => {
  const { toast } = useNotes()
  if (!toast) return null

  const getIcon = () => {
    if (toast.type === 'success') return '✨'
    if (toast.type === 'warn') return '⚠️'
    return 'ℹ️'
  }

  return (
    <div className="toast-container">
      <span>{getIcon()}</span>
      <span>{toast.message}</span>
    </div>
  )
}

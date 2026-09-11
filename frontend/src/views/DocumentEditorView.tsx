import React, { useState } from 'react'
import { useNotes } from '../context/NotesContext'
import type { Note } from '../types'
import {
  IconFile,
  IconSparkles,
  IconDownload,
  IconTrash,
  IconCards,
  IconHelpCircle,
  IconHeadphones,
  IconCheck
} from '../components/icons'

interface EditorFormProps {
  note: Note
}

const EditorForm: React.FC<EditorFormProps> = ({ note }) => {
  const {
    subjects,
    chapters,
    updateNote,
    saveCurrentNote,
    deleteNote,
    generateFlashcardsFromNote,
    generateQuizFromNote,
    generatePodcastFromNote,
    showToast
  } = useNotes()

  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [subjectId, setSubjectId] = useState(note.subjectId || subjects[0]?.id || '')
  const [chapterId, setChapterId] = useState(note.chapterId || chapters[0]?.id || '')
  const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>('split')
  const [showAiMenu, setShowAiMenu] = useState(false)

  const availableChapters = chapters.filter((c) => c.subjectId === subjectId)
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
  const readingTime = Math.max(1, Math.ceil(wordCount / 200))

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    updateNote(note.id, { title: newTitle })
  }

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    updateNote(note.id, { content: newContent })
  }

  const handleSave = () => {
    saveCurrentNote({
      ...note,
      title,
      content,
      subjectId,
      chapterId
    })
  }

  const handleExportMarkdown = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(title || 'untitled').toLowerCase().replace(/[^a-z0-9]/gi, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`Downloaded ${a.download}`, 'success')
  }

  const insertMarkdownSyntax = (prefix: string, suffix = '') => {
    const textarea = document.getElementById('note-editor-textarea') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = content.substring(start, end)
    const replacement = `${prefix}${selected || 'text'}${suffix}`

    const newContent = content.substring(0, start) + replacement + content.substring(end)
    handleContentChange(newContent)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, end + prefix.length)
    }, 10)
  }

  const handleAiSummarize = () => {
    const summary = `\n\n## Summary\n- Key points summarized from ${note.title || 'document'}.`
    handleContentChange(content + summary)
    setShowAiMenu(false)
    showToast('Appended note summary', 'success')
  }

  const renderMarkdown = (text: string) => {
    const lines = text.split('\n')
    const elements: React.ReactNode[] = []
    let inCodeBlock = false
    let codeContent: string[] = []

    lines.forEach((line, idx) => {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code-${idx}`}>
              <code>{codeContent.join('\n')}</code>
            </pre>
          )
          codeContent = []
          inCodeBlock = false
        } else {
          inCodeBlock = true
        }
        return
      }

      if (inCodeBlock) {
        codeContent.push(line)
        return
      }

      if (line.startsWith('# ')) {
        elements.push(<h1 key={idx}>{line.substring(2)}</h1>)
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={idx}>{line.substring(3)}</h2>)
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={idx} style={{ color: 'var(--text-main)', marginTop: 14, marginBottom: 6 }}>
            {line.substring(4)}
          </h3>
        )
      } else if (line.startsWith('> ')) {
        elements.push(<blockquote key={idx}>{line.substring(2)}</blockquote>)
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(<li key={idx}>{line.substring(2)}</li>)
      } else if (/^\d+\.\s/.test(line)) {
        elements.push(<li key={idx}>{line.replace(/^\d+\.\s/, '')}</li>)
      } else if (line.trim() === '---') {
        elements.push(
          <hr
            key={idx}
            style={{ borderColor: 'var(--border-color)', margin: '18px 0', borderWidth: 0.5 }}
          />
        )
      } else if (line.trim() !== '') {
        elements.push(<p key={idx}>{line}</p>)
      }
    })

    return elements
  }

  return (
    <div className="editor-container">
      {/* Top Bar */}
      <div className="editor-top-bar">
        <input
          className="editor-title-input"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled Note"
        />

        <div className="editor-actions">
          {subjects.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select
                className="form-select"
                style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value)
                  const first = chapters.find((c) => c.subjectId === e.target.value)
                  if (first) {
                    setChapterId(first.id)
                    updateNote(note.id, { subjectId: e.target.value, chapterId: first.id })
                  }
                }}
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {availableChapters.length > 0 && (
                <select
                  className="form-select"
                  style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}
                  value={chapterId}
                  onChange={(e) => {
                    setChapterId(e.target.value)
                    updateNote(note.id, { chapterId: e.target.value })
                  }}
                >
                  {availableChapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div style={{ position: 'relative' }}>
            <button
              className="btn-secondary"
              onClick={() => setShowAiMenu(!showAiMenu)}
              title="Assistant Tools"
            >
              <IconSparkles size={13} />
              <span>Tools ▾</span>
            </button>

            {showAiMenu && (
              <div className="context-menu" style={{ right: 0, top: 32, width: 200 }}>
                <button className="menu-item" onClick={handleAiSummarize}>
                  <IconSparkles size={13} />
                  <span>Summarize Points</span>
                </button>
                <button
                  className="menu-item"
                  onClick={() => {
                    setShowAiMenu(false)
                    generateFlashcardsFromNote(note.id)
                  }}
                >
                  <IconCards size={13} />
                  <span>Create Flashcards</span>
                </button>
                <button
                  className="menu-item"
                  onClick={() => {
                    setShowAiMenu(false)
                    generateQuizFromNote(note.id)
                  }}
                >
                  <IconHelpCircle size={13} />
                  <span>Generate Quiz</span>
                </button>
                <button
                  className="menu-item"
                  onClick={() => {
                    setShowAiMenu(false)
                    generatePodcastFromNote(note.id)
                  }}
                >
                  <IconHeadphones size={13} />
                  <span>Audio Studio</span>
                </button>
              </div>
            )}
          </div>

          <button className="btn-secondary" onClick={handleExportMarkdown} title="Export Markdown">
            <IconDownload size={13} />
            <span>Export .md</span>
          </button>

          <button className="btn-primary" onClick={handleSave} title="Save Note">
            <IconCheck size={13} />
            <span>Save</span>
          </button>

          <button
            className="dots-btn"
            style={{ color: 'var(--ctp-red)' }}
            onClick={() => deleteNote(note.id)}
            title="Delete Note"
          >
            <IconTrash size={14} />
          </button>
        </div>
      </div>

      {/* Editor Sub-toolbar & stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="editor-toolbar">
          <button className="tool-btn" onClick={() => insertMarkdownSyntax('**', '**')} title="Bold">
            <b>B</b>
          </button>
          <button className="tool-btn" onClick={() => insertMarkdownSyntax('*', '*')} title="Italic">
            <i>I</i>
          </button>
          <button className="tool-btn" onClick={() => insertMarkdownSyntax('# ')} title="Heading 1">
            H1
          </button>
          <button className="tool-btn" onClick={() => insertMarkdownSyntax('## ')} title="Heading 2">
            H2
          </button>
          <div className="tool-divider" />
          <button className="tool-btn" onClick={() => insertMarkdownSyntax('> ')} title="Quote">
            ❝
          </button>
          <button
            className="tool-btn"
            onClick={() => insertMarkdownSyntax('```\n', '\n```')}
            title="Code Block"
          >
            &lt;/&gt;
          </button>
          <button className="tool-btn" onClick={() => insertMarkdownSyntax('- ')} title="List">
            • List
          </button>
          <button
            className="tool-btn"
            onClick={() => insertMarkdownSyntax('| Col 1 | Col 2 |\n|---|---|\n| val 1 | val 2 |\n')}
            title="Table"
          >
            ▦ Table
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {wordCount} words • ~{readingTime} min
          </span>
          <div className="filter-toggle">
            <button
              className={`filter-btn ${viewMode === 'edit' ? 'active' : ''}`}
              onClick={() => setViewMode('edit')}
            >
              Edit
            </button>
            <button
              className={`filter-btn ${viewMode === 'split' ? 'active' : ''}`}
              onClick={() => setViewMode('split')}
            >
              Split
            </button>
            <button
              className={`filter-btn ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => setViewMode('preview')}
            >
              Preview
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="editor-workspace">
        {(viewMode === 'edit' || viewMode === 'split') && (
          <textarea
            id="note-editor-textarea"
            className="editor-textarea"
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Write markdown note..."
          />
        )}

        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="editor-preview">
            {content.trim() ? (
              renderMarkdown(content)
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                Preview will appear here as you type...
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export const DocumentEditorView: React.FC = () => {
  const { notes, activeNoteId, createBlankNote } = useNotes()
  const currentNote = notes.find((n) => n.id === activeNoteId) || notes[0]

  if (!currentNote) {
    return (
      <div
        className="content-body"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '65vh'
        }}
      >
        <div className="empty-state-box" style={{ padding: '60px 40px' }}>
          <div style={{ color: 'var(--text-muted)' }}>
            <IconFile size={32} />
          </div>
          <div className="empty-state-title">No Document Selected</div>
          <div className="empty-state-desc">
            Create a new document or select one from the library.
          </div>
          <button className="btn-primary" style={{ marginTop: 6 }} onClick={createBlankNote}>
            + Create Note
          </button>
        </div>
      </div>
    )
  }

  return <EditorForm key={currentNote.id} note={currentNote} />
}

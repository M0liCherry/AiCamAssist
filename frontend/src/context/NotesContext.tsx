import React, { createContext, useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import type {
  ActiveView,
  FilterMode,
  Subject,
  Chapter,
  Note,
  Flashcard,
  QuizQuestion,
  PodcastEpisode,
  UserSettings
} from '../types'
import {
  initialSubjects,
  initialChapters,
  initialNotes,
  initialFlashcards,
  initialQuizzes,
  initialPodcasts,
  defaultSettings
} from '../data/initialData'

interface NotesContextType {
  // State
  subjects: Subject[]
  chapters: Chapter[]
  notes: Note[]
  flashcards: Flashcard[]
  quizzes: QuizQuestion[]
  podcasts: PodcastEpisode[]
  settings: UserSettings
  activeView: ActiveView
  activeSubjectId: string
  activeChapterId: string
  activeNoteId: string | null
  filterMode: FilterMode
  searchQuery: string
  toast: { message: string; type?: 'info' | 'success' | 'warn' } | null

  // Modals
  isSearchOpen: boolean
  isAudioModalOpen: boolean
  isDocModalOpen: boolean
  isWebModalOpen: boolean
  isNewItemModalOpen: boolean
  newItemType: 'subject' | 'chapter' | 'note' | null
  isUserProfileOpen: boolean

  // Setters & Nav
  setActiveView: (view: ActiveView) => void
  setActiveSubjectId: (id: string) => void
  setActiveChapterId: (id: string) => void
  setActiveNoteId: (id: string | null) => void
  setFilterMode: (mode: FilterMode) => void
  setSearchQuery: (q: string) => void
  showToast: (message: string, type?: 'info' | 'success' | 'warn') => void

  // Modal controls
  setIsSearchOpen: (open: boolean) => void
  setIsAudioModalOpen: (open: boolean) => void
  setIsDocModalOpen: (open: boolean) => void
  setIsWebModalOpen: (open: boolean) => void
  openNewItemModal: (type: 'subject' | 'chapter' | 'note') => void
  closeNewItemModal: () => void
  setIsUserProfileOpen: (open: boolean) => void

  // Note CRUD
  createBlankNote: () => void
  createNote: (title: string, subjectId?: string, chapterId?: string) => string
  openNoteInEditor: (id: string) => void
  updateNote: (id: string, updates: Partial<Note>) => void
  saveCurrentNote: (note: Note) => void
  deleteNote: (id: string) => void
  duplicateNote: (id: string) => void

  // Hierarchy CRUD
  createSubject: (name: string) => string
  createChapter: (subjectId: string, name: string) => string
  deleteSubject: (id: string) => void
  deleteChapter: (id: string) => void

  // Imports
  importAudioNote: (title: string, transcript: string, subjectId?: string, chapterId?: string) => void
  importDocumentNote: (title: string, content: string, format: string, subjectId?: string, chapterId?: string) => void
  importWebNote: (title: string, url: string, content: string, subjectId?: string, chapterId?: string) => void

  // Study Tools
  generateFlashcardsFromNote: (noteId: string) => void
  generateQuizFromNote: (noteId: string) => void
  generatePodcastFromNote: (noteId: string) => void
  updateFlashcardMastery: (cardId: string, mastery: 'new' | 'learning' | 'mastered') => void
  addFlashcard: (card: Omit<Flashcard, 'id'>) => void
  addQuizQuestion: (quiz: Omit<QuizQuestion, 'id'>) => void

  // Settings & Storage
  updateSettings: (updates: Partial<UserSettings>) => void
  resetToDefaults: () => void
  exportAllDataAsJson: () => void
  importDataFromJson: (jsonStr: string) => boolean
}

const NotesContext = createContext<NotesContextType | undefined>(undefined)

const STORAGE_KEY = 'verity_notes_v4'

export const NotesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load initial from localStorage or defaults
  const loadSavedData = () => {
    try {
      // Clear legacy storage key containing pre-made mock data
      localStorage.removeItem('verity_notes_v3')
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed === 'object') {
          return {
            subjects: Array.isArray(parsed.subjects) ? parsed.subjects : initialSubjects,
            chapters: Array.isArray(parsed.chapters) ? parsed.chapters : initialChapters,
            notes: Array.isArray(parsed.notes) ? parsed.notes : initialNotes,
            flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : initialFlashcards,
            quizzes: Array.isArray(parsed.quizzes) ? parsed.quizzes : initialQuizzes,
            podcasts: Array.isArray(parsed.podcasts) ? parsed.podcasts : initialPodcasts,
            settings: parsed.settings || defaultSettings,
            activeSubjectId: parsed.activeSubjectId || '',
            activeChapterId: parsed.activeChapterId || '',
            activeNoteId: parsed.activeNoteId || null
          }
        }
      }
    } catch (e) {
      console.warn('Could not read from localStorage', e)
    }
    return null
  }

  const savedData = loadSavedData()

  const [subjects, setSubjects] = useState<Subject[]>(savedData?.subjects || initialSubjects)
  const [chapters, setChapters] = useState<Chapter[]>(savedData?.chapters || initialChapters)
  const [notes, setNotes] = useState<Note[]>(savedData?.notes || initialNotes)
  const [flashcards, setFlashcards] = useState<Flashcard[]>(savedData?.flashcards || initialFlashcards)
  const [quizzes, setQuizzes] = useState<QuizQuestion[]>(savedData?.quizzes || initialQuizzes)
  const [podcasts, setPodcasts] = useState<PodcastEpisode[]>(savedData?.podcasts || initialPodcasts)
  const [settings, setSettings] = useState<UserSettings>(savedData?.settings || defaultSettings)

  const [activeView, setActiveView] = useState<ActiveView>('hub')
  const [activeSubjectId, setActiveSubjectId] = useState<string>(
    savedData?.activeSubjectId || (subjects[0]?.id ?? '')
  )
  const [activeChapterId, setActiveChapterId] = useState<string>(
    savedData?.activeChapterId || (chapters[0]?.id ?? '')
  )
  const [activeNoteId, setActiveNoteId] = useState<string | null>(
    savedData?.activeNoteId || (notes[0]?.id ?? null)
  )
  const [filterMode, setFilterMode] = useState<FilterMode>('chapter')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [toast, setToast] = useState<{ message: string; type?: 'info' | 'success' | 'warn' } | null>(null)

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false)
  const [isDocModalOpen, setIsDocModalOpen] = useState(false)
  const [isWebModalOpen, setIsWebModalOpen] = useState(false)
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false)
  const [newItemType, setNewItemType] = useState<'subject' | 'chapter' | 'note' | null>(null)
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false)

  // Toast auto-clear
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3200)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'warn' = 'info') => {
    setToast({ message, type })
  }, [])

  // Save changes to localStorage
  useEffect(() => {
    try {
      const data = {
        subjects,
        chapters,
        notes,
        flashcards,
        quizzes,
        podcasts,
        settings,
        activeSubjectId,
        activeChapterId,
        activeNoteId
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('Failed to save to localStorage', e)
    }
  }, [subjects, chapters, notes, flashcards, quizzes, podcasts, settings, activeSubjectId, activeChapterId, activeNoteId])

  // Global Ctrl+K shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Apply font and theme CSS variables to both documentElement and body
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
    document.body.setAttribute('data-theme', settings.theme)
    document.documentElement.setAttribute('data-font', settings.font)
    document.body.setAttribute('data-font', settings.font)
  }, [settings.theme, settings.font])

  const openNewItemModal = (type: 'subject' | 'chapter' | 'note') => {
    setNewItemType(type)
    setIsNewItemModalOpen(true)
  }

  const closeNewItemModal = () => {
    setIsNewItemModalOpen(false)
    setNewItemType(null)
  }

  const ensureSubjectAndChapter = (
    subjectId?: string,
    chapterId?: string,
    defaultChapName = 'Notes'
  ): { subId: string; chapId: string } => {
    let targetSubject = subjectId || activeSubjectId
    let targetChapter = chapterId || activeChapterId

    if (!targetSubject || !subjects.some((s) => s.id === targetSubject)) {
      if (subjects.length === 0) {
        const subId = `sub-${Date.now()}`
        const chapId = `chap-${Date.now()}`
        const newSub: Subject = { id: subId, name: 'General', icon: 'Folder' }
        const newChap: Chapter = { id: chapId, subjectId: subId, name: defaultChapName }
        setSubjects([newSub])
        setChapters([newChap])
        setActiveSubjectId(subId)
        setActiveChapterId(chapId)
        return { subId, chapId }
      } else {
        targetSubject = subjects[0].id
        const chap = chapters.find((c) => c.subjectId === targetSubject)
        targetChapter = chap ? chap.id : ''
        setActiveSubjectId(targetSubject)
        if (targetChapter) setActiveChapterId(targetChapter)
        return { subId: targetSubject, chapId: targetChapter }
      }
    }

    if (!targetChapter || !chapters.some((c) => c.id === targetChapter && c.subjectId === targetSubject)) {
      const foundChap = chapters.find((c) => c.subjectId === targetSubject)
      if (foundChap) {
        targetChapter = foundChap.id
      } else {
        const newChapId = `chap-${Date.now()}`
        const newChap: Chapter = { id: newChapId, subjectId: targetSubject, name: defaultChapName }
        setChapters((prev) => [...prev, newChap])
        targetChapter = newChapId
      }
    }

    return { subId: targetSubject, chapId: targetChapter }
  }

  const createBlankNote = () => {
    const { subId, chapId } = ensureSubjectAndChapter(activeSubjectId, activeChapterId, 'Notes')

    const newNote: Note = {
      id: `note-${Date.now()}`,
      title: 'Untitled Note',
      subjectId: subId,
      chapterId: chapId,
      badge: 'draft',
      updatedAt: 'Just now',
      wordCount: 0,
      tags: [],
      content: ''
    }

    setNotes((prev) => [newNote, ...prev])
    setActiveNoteId(newNote.id)
    setActiveView('editor')
    showToast('Created new note', 'success')
  }

  const createNote = (title: string, subjectId?: string, chapterId?: string): string => {
    const { subId, chapId } = ensureSubjectAndChapter(subjectId, chapterId, 'Notes')

    const noteId = `note-${Date.now()}`
    const newNote: Note = {
      id: noteId,
      title: title.trim() || 'Untitled Note',
      subjectId: subId,
      chapterId: chapId,
      badge: 'document',
      updatedAt: 'Just now',
      wordCount: 0,
      tags: [],
      content: `# ${title.trim() || 'Untitled Note'}\n\nStart writing your note content...`
    }

    setNotes((prev) => [newNote, ...prev])
    setActiveNoteId(noteId)
    setActiveSubjectId(subId)
    setActiveChapterId(chapId)
    setActiveView('editor')
    showToast(`Created note "${newNote.title}"`, 'success')
    return noteId
  }

  const openNoteInEditor = (id: string) => {
    const found = notes.find((n) => n.id === id)
    if (found) {
      setActiveNoteId(found.id)
      setActiveSubjectId(found.subjectId)
      setActiveChapterId(found.chapterId)
      setActiveView('editor')
    }
  }

  const updateNote = (id: string, updates: Partial<Note>) => {
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          const content = updates.content !== undefined ? updates.content : n.content
          const words = content.trim() ? content.trim().split(/\s+/).length : 0
          return {
            ...n,
            ...updates,
            wordCount: updates.wordCount !== undefined ? updates.wordCount : words,
            updatedAt: 'Just now'
          }
        }
        return n
      })
    )
  }

  const saveCurrentNote = (note: Note) => {
    updateNote(note.id, note)
    showToast(`Saved "${note.title}"`, 'success')
  }

  const deleteNote = (id: string) => {
    const target = notes.find((n) => n.id === id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
    if (activeNoteId === id) {
      const remaining = notes.filter((n) => n.id !== id)
      setActiveNoteId(remaining[0]?.id || null)
    }
    showToast(`Deleted "${target?.title || 'note'}"`, 'info')
  }

  const duplicateNote = (id: string) => {
    const orig = notes.find((n) => n.id === id)
    if (!orig) return

    const copy: Note = {
      ...orig,
      id: `note-${Date.now()}`,
      title: `${orig.title} (Copy)`,
      updatedAt: 'Just now'
    }

    setNotes((prev) => [copy, ...prev])
    showToast(`Duplicated "${orig.title}"`, 'success')
  }

  const createSubject = (name: string): string => {
    const trimmed = name.trim()
    if (!trimmed) return ''
    const newId = `sub-${Date.now()}`
    const newSub: Subject = {
      id: newId,
      name: trimmed,
      icon: 'Folder'
    }
    const defaultChap: Chapter = {
      id: `chap-${Date.now()}`,
      subjectId: newId,
      name: 'General'
    }
    setSubjects((prev) => [...prev, newSub])
    setChapters((prev) => [...prev, defaultChap])
    setActiveSubjectId(newId)
    setActiveChapterId(defaultChap.id)
    showToast(`Created subject "${trimmed}"`, 'success')
    return newId
  }

  const createChapter = (subjectId: string, name: string): string => {
    const trimmed = name.trim()
    if (!trimmed) return ''
    const newId = `chap-${Date.now()}`
    const newChap: Chapter = {
      id: newId,
      subjectId,
      name: trimmed
    }
    setChapters((prev) => [...prev, newChap])
    setActiveSubjectId(subjectId)
    setActiveChapterId(newId)
    showToast(`Created chapter "${trimmed}"`, 'success')
    return newId
  }

  const deleteSubject = (id: string) => {
    const subject = subjects.find((s) => s.id === id)
    setSubjects((prev) => prev.filter((s) => s.id !== id))
    setChapters((prev) => prev.filter((c) => c.subjectId !== id))
    setNotes((prev) => prev.filter((n) => n.subjectId !== id))
    const remaining = subjects.filter((s) => s.id !== id)
    if (remaining.length > 0) {
      setActiveSubjectId(remaining[0].id)
      const childChap = chapters.find((c) => c.subjectId === remaining[0].id)
      if (childChap) setActiveChapterId(childChap.id)
    }
    showToast(`Deleted subject "${subject?.name || ''}"`, 'info')
  }

  const deleteChapter = (id: string) => {
    const chap = chapters.find((c) => c.id === id)
    setChapters((prev) => prev.filter((c) => c.id !== id))
    setNotes((prev) => prev.filter((n) => n.chapterId !== id))
    showToast(`Deleted chapter "${chap?.name || ''}"`, 'info')
  }

  const importAudioNote = (
    title: string,
    transcript: string,
    subjectId = activeSubjectId,
    chapterId = activeChapterId
  ) => {
    const { subId, chapId } = ensureSubjectAndChapter(subjectId, chapterId, 'Audio')
    const noteId = `note-${Date.now()}`
    const words = transcript.trim() ? transcript.trim().split(/\s+/).length : 0
    const newNote: Note = {
      id: noteId,
      title: title || 'Audio Transcription',
      subjectId: subId,
      chapterId: chapId,
      badge: 'Audio transcript',
      updatedAt: 'Just now',
      wordCount: words,
      tags: ['audio', 'transcript'],
      content: `# ${title}\n\n*Transcribed on ${new Date().toLocaleDateString()}*\n\n---\n\n${transcript}`
    }
    setNotes((prev) => [newNote, ...prev])
    setActiveNoteId(newNote.id)
    setActiveView('editor')
    showToast('Audio transcribed and imported successfully!', 'success')
  }

  const importDocumentNote = (
    title: string,
    content: string,
    format: string,
    subjectId = activeSubjectId,
    chapterId = activeChapterId
  ) => {
    const { subId, chapId } = ensureSubjectAndChapter(subjectId, chapterId, 'Documents')
    const noteId = `note-${Date.now()}`
    const words = content.trim() ? content.trim().split(/\s+/).length : 0
    const newNote: Note = {
      id: noteId,
      title: title || 'Imported Document',
      subjectId: subId,
      chapterId: chapId,
      badge: format.toUpperCase(),
      updatedAt: 'Just now',
      wordCount: words,
      tags: ['import', format.toLowerCase()],
      content
    }
    setNotes((prev) => [newNote, ...prev])
    setActiveNoteId(newNote.id)
    setActiveView('editor')
    showToast(`Imported ${title}`, 'success')
  }

  const importWebNote = (
    title: string,
    url: string,
    content: string,
    subjectId = activeSubjectId,
    chapterId = activeChapterId
  ) => {
    const { subId, chapId } = ensureSubjectAndChapter(subjectId, chapterId, 'Web Imports')
    const noteId = `note-${Date.now()}`
    const words = content.trim() ? content.trim().split(/\s+/).length : 0
    const newNote: Note = {
      id: noteId,
      title: title || 'Imported Web Content',
      subjectId: subId,
      chapterId: chapId,
      badge: url.includes('youtube') ? 'YouTube' : 'Web article',
      updatedAt: 'Just now',
      wordCount: words,
      tags: ['web', 'research'],
      content: `# ${title}\n\n**Source URL**: [${url}](${url})\n\n---\n\n${content}`
    }
    setNotes((prev) => [newNote, ...prev])
    setActiveNoteId(newNote.id)
    setActiveView('editor')
    let domain = url
    try {
      domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname
    } catch {
      // fallback
    }
    showToast(`Imported content from ${domain}`, 'success')
  }

  const generateFlashcardsFromNote = (noteId: string) => {
    const note = notes.find((n) => n.id === noteId)
    if (!note) return

    const newCards: Flashcard[] = [
      {
        id: `fc-${Date.now()}-1`,
        subjectId: note.subjectId,
        chapterId: note.chapterId,
        question: `What is the core strategic principle outlined in "${note.title}"?`,
        answer: `The primary emphasis centers on fluid adaptation, minimizing unnecessary friction, and leveraging local asymmetry.`,
        mastery: 'new'
      },
      {
        id: `fc-${Date.now()}-2`,
        subjectId: note.subjectId,
        chapterId: note.chapterId,
        question: `How does "${note.title}" classify operational readiness?`,
        answer: `Preparation must precede engagement. Formations should remain flexible while internal logistics and communication redundancy are secured.`,
        mastery: 'new'
      }
    ]

    setFlashcards((prev) => [...newCards, ...prev])
    setActiveView('flashcards')
    showToast(`Generated 2 flashcards from "${note.title}"!`, 'success')
  }

  const generateQuizFromNote = (noteId: string) => {
    const note = notes.find((n) => n.id === noteId)
    if (!note) return

    const newQuestion: QuizQuestion = {
      id: `q-${Date.now()}`,
      subjectId: note.subjectId,
      chapterId: note.chapterId,
      question: `Which fundamental principle is highlighted in the study of "${note.title}"?`,
      options: [
        'Complete reliance on static fortifications',
        'Dynamic adaptability and assessment of terrain/voids',
        'Ignoring resource and logistics friction',
        'Symmetrical brute-force confrontation'
      ],
      correctAnswerIndex: 1,
      explanation: `According to "${note.title}", strategic success requires assessing voids and remaining adaptable rather than committing to rigid symmetry.`
    }

    setQuizzes((prev) => [newQuestion, ...prev])
    setActiveView('quizzes')
    showToast(`Generated quiz question from "${note.title}"!`, 'success')
  }

  const generatePodcastFromNote = (noteId: string) => {
    const note = notes.find((n) => n.id === noteId)
    if (!note) return

    const newPodcast: PodcastEpisode = {
      id: `pod-${Date.now()}`,
      title: `AI Discussion: ${note.title}`,
      subjectId: note.subjectId,
      chapterId: note.chapterId,
      duration: '05:12',
      durationSeconds: 312,
      date: 'Just now',
      summary: `Conversational synthesis analyzing ${note.title} with key practical takeaways.`,
      transcript: [
        {
          speaker: 'Host A (Furina)',
          time: '00:00',
          text: `Welcome! Today we are discussing "${note.title}", exploring how these principles translate into actionable outcomes.`
        },
        {
          speaker: 'Host B (Neuvillette)',
          time: '00:25',
          text: `The depth of analysis in this note is commendable. Notice how the core thesis avoids dogmatic assumptions.`
        },
        {
          speaker: 'Host A (Furina)',
          time: '00:58',
          text: `Precisely. It shows that strategic clarity is achieved through disciplined iteration.`
        }
      ]
    }

    setPodcasts((prev) => [newPodcast, ...prev])
    setActiveView('podcasts')
    showToast(`Generated audio podcast for "${note.title}"!`, 'success')
  }

  const updateFlashcardMastery = (cardId: string, mastery: 'new' | 'learning' | 'mastered') => {
    setFlashcards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, mastery, lastReviewed: new Date().toLocaleDateString() } : c))
    )
  }

  const addFlashcard = (card: Omit<Flashcard, 'id'>) => {
    const newCard: Flashcard = {
      ...card,
      id: `fc-${Date.now()}`
    }
    setFlashcards((prev) => [newCard, ...prev])
    showToast('New flashcard added!', 'success')
  }

  const addQuizQuestion = (quiz: Omit<QuizQuestion, 'id'>) => {
    const newQ: QuizQuestion = {
      ...quiz,
      id: `q-${Date.now()}`
    }
    setQuizzes((prev) => [newQ, ...prev])
    showToast('New quiz question created!', 'success')
  }

  const updateSettings = (updates: Partial<UserSettings>) => {
    setSettings((prev) => ({ ...prev, ...updates }))
    showToast('Settings updated', 'info')
  }

  const resetToDefaults = () => {
    setSubjects([])
    setChapters([])
    setNotes([])
    setFlashcards([])
    setQuizzes([])
    setPodcasts([])
    setSettings(defaultSettings)
    setActiveSubjectId('')
    setActiveChapterId('')
    setActiveNoteId(null)
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem('verity_notes_v3')
    showToast('Workspace data cleared', 'info')
  }

  const exportAllDataAsJson = () => {
    const data = {
      verity_version: '1.0.0',
      exported_at: new Date().toISOString(),
      subjects,
      chapters,
      notes,
      flashcards,
      quizzes,
      podcasts,
      settings
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `verity-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Exported library backup JSON', 'success')
  }

  const importDataFromJson = (jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr)
      if (parsed.subjects && parsed.notes) {
        setSubjects(parsed.subjects)
        if (parsed.chapters) setChapters(parsed.chapters)
        if (parsed.notes) setNotes(parsed.notes)
        if (parsed.flashcards) setFlashcards(parsed.flashcards)
        if (parsed.quizzes) setQuizzes(parsed.quizzes)
        if (parsed.podcasts) setPodcasts(parsed.podcasts)
        if (parsed.settings) setSettings(parsed.settings)
        showToast('Successfully restored backup!', 'success')
        return true
      }
    } catch (e) {
      console.error(e)
    }
    showToast('Invalid backup JSON format', 'warn')
    return false
  }

  return (
    <NotesContext.Provider
      value={{
        subjects,
        chapters,
        notes,
        flashcards,
        quizzes,
        podcasts,
        settings,
        activeView,
        activeSubjectId,
        activeChapterId,
        activeNoteId,
        filterMode,
        searchQuery,
        toast,
        isSearchOpen,
        isAudioModalOpen,
        isDocModalOpen,
        isWebModalOpen,
        isNewItemModalOpen,
        newItemType,
        isUserProfileOpen,
        setActiveView,
        setActiveSubjectId,
        setActiveChapterId,
        setActiveNoteId,
        setFilterMode,
        setSearchQuery,
        showToast,
        setIsSearchOpen,
        setIsAudioModalOpen,
        setIsDocModalOpen,
        setIsWebModalOpen,
        openNewItemModal,
        closeNewItemModal,
        setIsUserProfileOpen,
        createBlankNote,
        createNote,
        openNoteInEditor,
        updateNote,
        saveCurrentNote,
        deleteNote,
        duplicateNote,
        createSubject,
        createChapter,
        deleteSubject,
        deleteChapter,
        importAudioNote,
        importDocumentNote,
        importWebNote,
        generateFlashcardsFromNote,
        generateQuizFromNote,
        generatePodcastFromNote,
        updateFlashcardMastery,
        addFlashcard,
        addQuizQuestion,
        updateSettings,
        resetToDefaults,
        exportAllDataAsJson,
        importDataFromJson
      }}
    >
      {children}
    </NotesContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export { NotesContext }
// oxlint-disable-next-line react/only-export-components
export { useNotes } from './useNotes'


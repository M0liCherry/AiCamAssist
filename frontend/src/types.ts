export type ActiveView = 'hub' | 'editor' | 'podcasts' | 'flashcards' | 'quizzes' | 'settings'

export type FilterMode = 'chapter' | 'entire'

export interface Subject {
  id: string
  name: string
  icon?: string
}

export interface Chapter {
  id: string
  subjectId: string
  name: string
}

export interface Note {
  id: string
  title: string
  subjectId: string
  chapterId: string
  content: string
  wordCount: number
  badge: string
  updatedAt: string
  tags?: string[]
}

export interface Flashcard {
  id: string
  subjectId: string
  chapterId?: string
  question: string
  answer: string
  mastery: 'new' | 'learning' | 'mastered'
  lastReviewed?: string
}

export interface QuizQuestion {
  id: string
  subjectId: string
  chapterId?: string
  question: string
  options: string[]
  correctAnswerIndex: number
  explanation: string
}

export interface PodcastEpisode {
  id: string
  title: string
  subjectId: string
  chapterId?: string
  duration: string
  durationSeconds: number
  date: string
  summary: string
  transcript: {
    speaker: string
    time: string
    text: string
  }[]
}

export type ThemeName = 'mocha' | 'macchiato' | 'frappe' | 'latte'
export type FontPreference = 'sans' | 'mono' | 'dyslexic'

export interface UserSettings {
  theme: ThemeName
  font: FontPreference
  autoSave: boolean
}

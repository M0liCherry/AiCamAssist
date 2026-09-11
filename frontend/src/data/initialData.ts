import type { Subject, Chapter, Note, Flashcard, QuizQuestion, PodcastEpisode, UserSettings } from '../types'

export const initialSubjects: Subject[] = []

export const initialChapters: Chapter[] = []

export const initialNotes: Note[] = []

export const initialFlashcards: Flashcard[] = []

export const initialQuizzes: QuizQuestion[] = []

export const initialPodcasts: PodcastEpisode[] = []

export const defaultSettings: UserSettings = {
  theme: 'mocha',
  font: 'sans',
  autoSave: true
}

import React, { useState, useEffect } from 'react'
import { useNotes } from '../context/NotesContext'
import type { Flashcard } from '../types'
import { IconCards, IconPlus, IconX } from '../components/icons'

export const FlashcardsView: React.FC = () => {
  const { flashcards, subjects, updateFlashcardMastery, addFlashcard } = useNotes()

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  // New Card Form
  const [newQuestion, setNewQuestion] = useState('')
  const [newAnswer, setNewAnswer] = useState('')
  const [newCardSubjectId, setNewCardSubjectId] = useState(subjects[0]?.id || '')

  const filteredCards = flashcards.filter(
    (c) => selectedSubjectId === 'all' || c.subjectId === selectedSubjectId
  )

  const currentCard: Flashcard | undefined = filteredCards[currentIndex]

  // Keyboard shortcut for flip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !showAddModal) {
        if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return
        e.preventDefault()
        setIsFlipped((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showAddModal])

  const handleNext = () => {
    setIsFlipped(false)
    if (currentIndex < filteredCards.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      setCurrentIndex(0)
    }
  }

  const handlePrev = () => {
    setIsFlipped(false)
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    } else {
      setCurrentIndex(filteredCards.length - 1)
    }
  }

  const handleRate = (mastery: 'new' | 'learning' | 'mastered') => {
    if (!currentCard) return
    updateFlashcardMastery(currentCard.id, mastery)
    handleNext()
  }

  const handleCreateCard = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newQuestion.trim() || !newAnswer.trim()) return

    addFlashcard({
      subjectId: newCardSubjectId,
      question: newQuestion.trim(),
      answer: newAnswer.trim(),
      mastery: 'new'
    })

    setNewQuestion('')
    setNewAnswer('')
    setShowAddModal(false)
  }

  const masteredCount = filteredCards.filter((c) => c.mastery === 'mastered').length
  const learningCount = filteredCards.filter((c) => c.mastery === 'learning').length
  const newCount = filteredCards.filter((c) => c.mastery === 'new').length

  return (
    <div className="content-body">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconCards size={20} style={{ color: 'var(--ctp-blue)' }} />
            <span>Active Recall Flashcards</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
            Spaced repetition memory review.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {subjects.length > 0 && (
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value)
                setCurrentIndex(0)
                setIsFlipped(false)
              }}
            >
              <option value="all">All Subjects ({flashcards.length})</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <IconPlus size={13} />
            <span>Create Card</span>
          </button>
        </div>
      </div>

      {/* Progress & Deck Metrics */}
      {filteredCards.length > 0 && (
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="panel" style={{ flex: 1, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Mastered
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ctp-green)', marginTop: 2 }}>
              {masteredCount}
            </div>
          </div>

          <div className="panel" style={{ flex: 1, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Learning
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ctp-yellow)', marginTop: 2 }}>
              {learningCount}
            </div>
          </div>

          <div className="panel" style={{ flex: 1, padding: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              New
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ctp-blue)', marginTop: 2 }}>
              {newCount}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Card */}
      {currentCard ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="card-container" onClick={() => setIsFlipped(!isFlipped)}>
            <div className={`flashcard-inner ${isFlipped ? 'flipped' : ''}`}>
              {/* Front Side */}
              <div className="flashcard-front">
                <span className="badge" style={{ position: 'absolute', top: 16, left: 20 }}>
                  Question • Card {currentIndex + 1} of {filteredCards.length}
                </span>

                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    textAlign: 'center',
                    maxWidth: '85%',
                    lineHeight: 1.5
                  }}
                >
                  {currentCard.question}
                </div>

                <div
                  style={{
                    position: 'absolute',
                    bottom: 16,
                    fontSize: 12,
                    color: 'var(--text-muted)'
                  }}
                >
                  Click or press Spacebar to reveal answer
                </div>
              </div>

              {/* Back Side */}
              <div className="flashcard-back">
                <span
                  className="badge badge-gold"
                  style={{ position: 'absolute', top: 16, left: 20 }}
                >
                  Answer
                </span>

                <div
                  style={{
                    fontSize: 15,
                    lineHeight: 1.6,
                    textAlign: 'center',
                    maxWidth: '90%',
                    color: 'var(--text-main)'
                  }}
                >
                  {currentCard.answer}
                </div>

                <div
                  style={{
                    position: 'absolute',
                    bottom: 16,
                    fontSize: 12,
                    color: 'var(--text-muted)'
                  }}
                >
                  Click again to flip
                </div>
              </div>
            </div>
          </div>

          {/* Rating / Navigation Controls */}
          {isFlipped ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-secondary"
                style={{ borderColor: 'var(--ctp-red)', color: 'var(--ctp-red)' }}
                onClick={() => handleRate('new')}
              >
                Again (&lt;1m)
              </button>
              <button
                className="btn-secondary"
                style={{ borderColor: 'var(--ctp-yellow)', color: 'var(--ctp-yellow)' }}
                onClick={() => handleRate('learning')}
              >
                Hard (10m)
              </button>
              <button
                className="btn-secondary"
                style={{ borderColor: 'var(--ctp-blue)', color: 'var(--ctp-blue)' }}
                onClick={() => handleRate('mastered')}
              >
                Good (1d)
              </button>
              <button
                className="btn-primary"
                style={{ backgroundColor: 'var(--ctp-green)', color: 'var(--ctp-crust)' }}
                onClick={() => handleRate('mastered')}
              >
                Easy (4d)
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="btn-secondary" onClick={handlePrev}>
                Previous
              </button>
              <button className="btn-primary" onClick={() => setIsFlipped(true)}>
                Reveal Answer
              </button>
              <button className="btn-secondary" onClick={handleNext}>
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state-box" style={{ padding: '60px 20px' }}>
          <div className="empty-state-icon">
            <IconCards size={32} />
          </div>
          <div className="empty-state-title">No Flashcards Yet</div>
          <div className="empty-state-desc">
            Create custom flashcards or generate them from any note.
          </div>
          <button
            className="btn-primary"
            style={{ marginTop: 8 }}
            onClick={() => setShowAddModal(true)}
          >
            + Create First Card
          </button>
        </div>
      )}

      {/* Create Flashcard Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <IconCards size={18} style={{ color: 'var(--ctp-blue)' }} />
                <span>Create Flashcard</span>
              </h2>
              <button className="modal-close-btn" onClick={() => setShowAddModal(false)} title="Close">
                <IconX size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCard} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {subjects.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <select
                    className="form-select"
                    value={newCardSubjectId}
                    onChange={(e) => setNewCardSubjectId(e.target.value)}
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Question</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Enter flashcard question..."
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Answer</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="Enter flashcard answer..."
                  required
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

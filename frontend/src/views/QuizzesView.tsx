import React, { useState } from 'react'
import { useNotes } from '../context/NotesContext'
import type { QuizQuestion } from '../types'

export const QuizzesView: React.FC = () => {
  const { quizzes, subjects, addQuizQuestion, showToast } = useNotes()

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [isAnswerChecked, setIsAnswerChecked] = useState(false)
  const [score, setScore] = useState(0)
  const [quizFinished, setQuizFinished] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  // New question form
  const [newSubjectId, setNewSubjectId] = useState(subjects[0]?.id || '')
  const [newQuestion, setNewQuestion] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [correctIdx, setCorrectIdx] = useState(0)
  const [explanation, setExplanation] = useState('')

  const filteredQuizzes = quizzes.filter(
    (q) => selectedSubjectId === 'all' || q.subjectId === selectedSubjectId
  )

  const currentQ: QuizQuestion | undefined = filteredQuizzes[currentIdx]

  const handleSelectOption = (idx: number) => {
    if (isAnswerChecked) return
    setSelectedOption(idx)
  }

  const handleCheckAnswer = () => {
    if (selectedOption === null || !currentQ) return
    setIsAnswerChecked(true)
    if (selectedOption === currentQ.correctAnswerIndex) {
      setScore((prev) => prev + 1)
      showToast('Correct! Well done.', 'success')
    } else {
      showToast('Incorrect answer.', 'warn')
    }
  }

  const handleNext = () => {
    setIsAnswerChecked(false)
    setSelectedOption(null)

    if (currentIdx < filteredQuizzes.length - 1) {
      setCurrentIdx((prev) => prev + 1)
    } else {
      setQuizFinished(true)
    }
  }

  const handleRestart = () => {
    setCurrentIdx(0)
    setSelectedOption(null)
    setIsAnswerChecked(false)
    setScore(0)
    setQuizFinished(false)
  }

  const handleCreateQuestion = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newQuestion.trim() || options.some((o) => !o.trim())) return

    addQuizQuestion({
      subjectId: newSubjectId,
      question: newQuestion.trim(),
      options: [...options],
      correctAnswerIndex: correctIdx,
      explanation: explanation.trim() || 'Verified by domain principles.'
    })

    setNewQuestion('')
    setOptions(['', '', '', ''])
    setExplanation('')
    setShowAddModal(false)
  }

  return (
    <div className="content-body">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-main)' }}>
            ❓ Interactive Quizzes
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginTop: 2 }}>
            Evaluate and reinforce your conceptual understanding with instant feedback.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <select
            className="form-select"
            style={{ width: 'auto' }}
            value={selectedSubjectId}
            onChange={(e) => {
              setSelectedSubjectId(e.target.value)
              handleRestart()
            }}
          >
            <option value="all">All Subjects ({quizzes.length})</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            + Add Question
          </button>
        </div>
      </div>

      {quizFinished ? (
        <div className="quiz-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 44 }}>🏆</div>
          <h3 style={{ fontSize: 24, fontWeight: 700, marginTop: 10 }}>Quiz Completed!</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            You scored {score} out of {filteredQuizzes.length} (
            {Math.round((score / Math.max(1, filteredQuizzes.length)) * 100)}%)
          </p>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button className="btn-primary" onClick={handleRestart}>
              Retake Quiz
            </button>
          </div>
        </div>
      ) : currentQ ? (
        <div className="quiz-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="badge">
              Question {currentIdx + 1} of {filteredQuizzes.length}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Score: {score}</span>
          </div>

          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.5 }}>
            {currentQ.question}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {currentQ.options.map((opt, idx) => {
              let statusClass = ''
              if (isAnswerChecked) {
                if (idx === currentQ.correctAnswerIndex) {
                  statusClass = 'correct'
                } else if (idx === selectedOption) {
                  statusClass = 'wrong'
                }
              } else if (idx === selectedOption) {
                statusClass = 'selected'
              }

              const letters = ['A', 'B', 'C', 'D']

              return (
                <button
                  key={idx}
                  className={`quiz-option ${statusClass}`}
                  onClick={() => handleSelectOption(idx)}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700
                    }}
                  >
                    {letters[idx]}
                  </span>
                  <span style={{ flex: 1 }}>{opt}</span>
                </button>
              )
            })}
          </div>

          {isAnswerChecked && (
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 8,
                background:
                  selectedOption === currentQ.correctAnswerIndex
                    ? 'rgba(16, 185, 129, 0.1)'
                    : 'rgba(244, 63, 94, 0.1)',
                border: `1px solid ${
                  selectedOption === currentQ.correctAnswerIndex
                    ? 'rgba(16, 185, 129, 0.3)'
                    : 'rgba(244, 63, 94, 0.3)'
                }`,
                fontSize: 13,
                lineHeight: 1.5
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Explanation:</div>
              <div style={{ color: '#E2E8F0' }}>{currentQ.explanation}</div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            {!isAnswerChecked ? (
              <button
                className="btn-primary"
                disabled={selectedOption === null}
                onClick={handleCheckAnswer}
              >
                Check Answer
              </button>
            ) : (
              <button className="btn-primary" onClick={handleNext}>
                {currentIdx < filteredQuizzes.length - 1 ? 'Next Question ▶' : 'View Results 🏆'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="empty-state-box" style={{ padding: '60px 20px' }}>
          <div style={{ fontSize: 32 }}>❓</div>
          <div className="empty-state-title">No Quizzes Available</div>
          <div className="empty-state-desc">
            Generate quizzes from your notes or create a new question manually.
          </div>
          <button
            className="btn-primary"
            style={{ marginTop: 8 }}
            onClick={() => setShowAddModal(true)}
          >
            + Create Question
          </button>
        </div>
      )}

      {/* Add Question Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>❓ Add Quiz Question</h2>
              <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <select
                  className="form-select"
                  value={newSubjectId}
                  onChange={(e) => setNewSubjectId(e.target.value)}
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Question</label>
                <input
                  className="form-input"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="e.g. Which normal form addresses multi-valued dependencies?"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Answer Options</label>
                {options.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <input
                      type="radio"
                      name="correctOption"
                      checked={correctIdx === i}
                      onChange={() => setCorrectIdx(i)}
                      title="Mark as correct answer"
                    />
                    <input
                      className="form-input"
                      value={opt}
                      onChange={(e) => {
                        const next = [...options]
                        next[i] = e.target.value
                        setOptions(next)
                      }}
                      placeholder={`Option ${['A', 'B', 'C', 'D'][i]}`}
                      required
                    />
                  </div>
                ))}
              </div>

              <div className="form-group">
                <label className="form-label">Explanation</label>
                <textarea
                  className="form-textarea"
                  rows={2}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  placeholder="Why is this answer correct?"
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

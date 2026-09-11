import React, { useState } from 'react'
import { useNotes } from '../context/NotesContext'
import type { QuizQuestion } from '../types'
import {
  IconGraduationCap,
  IconTrophy,
  IconHelpCircle,
  IconX,
  IconChevronRight,
  IconPlus,
  IconRotateCcw
} from '../components/icons'

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
      showToast('Incorrect answer. Review explanation below.', 'warn')
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
      subjectId: newSubjectId || subjects[0]?.id || '',
      question: newQuestion.trim(),
      options: [...options],
      correctAnswerIndex: correctIdx,
      explanation: explanation.trim() || 'Verified by core engineering principles.'
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
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconGraduationCap size={20} style={{ color: 'var(--ctp-blue)' }} />
            <span>Interactive Quizzes</span>
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
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
            <IconPlus size={13} />
            <span>Add Question</span>
          </button>
        </div>
      </div>

      {quizFinished ? (
        <div className="quiz-card" style={{ textAlign: 'center', padding: '40px 20px', alignItems: 'center' }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: 'var(--ctp-surface0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ctp-yellow)'
            }}
          >
            <IconTrophy size={36} />
          </div>
          <h3 style={{ fontSize: 22, fontWeight: 700, marginTop: 10 }}>Quiz Completed!</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: 2, fontSize: 13 }}>
            You scored {score} out of {filteredQuizzes.length} (
            {Math.round((score / Math.max(1, filteredQuizzes.length)) * 100)}%)
          </p>

          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button className="btn-primary" onClick={handleRestart}>
              <IconRotateCcw size={13} />
              <span>Retake Quiz</span>
            </button>
          </div>
        </div>
      ) : currentQ ? (
        <div className="quiz-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="badge">
              Question {currentIdx + 1} of {filteredQuizzes.length}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
              Current Score: {score}
            </span>
          </div>

          <h3 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.5 }}>
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
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
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
                    ? 'rgba(166, 227, 161, 0.1)'
                    : 'rgba(243, 139, 168, 0.1)',
                border: `1px solid ${
                  selectedOption === currentQ.correctAnswerIndex
                    ? 'rgba(166, 227, 161, 0.3)'
                    : 'rgba(243, 139, 168, 0.3)'
                }`,
                fontSize: 13,
                lineHeight: 1.5
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 4, color: selectedOption === currentQ.correctAnswerIndex ? 'var(--ctp-green)' : 'var(--ctp-red)' }}>
                {selectedOption === currentQ.correctAnswerIndex ? 'Correct Answer' : 'Explanation:'}
              </div>
              <div style={{ color: 'var(--text-main)' }}>{currentQ.explanation}</div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
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
                {currentIdx < filteredQuizzes.length - 1 ? (
                  <>
                    <span>Next Question</span>
                    <IconChevronRight size={13} />
                  </>
                ) : (
                  <>
                    <IconTrophy size={13} />
                    <span>View Results</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="empty-state-box" style={{ padding: '60px 20px' }}>
          <div className="empty-state-icon">
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                backgroundColor: 'var(--ctp-surface0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ctp-blue)'
              }}
            >
              <IconHelpCircle size={28} />
            </div>
          </div>
          <div className="empty-state-title">No Quizzes Available</div>
          <div className="empty-state-desc">
            Generate quizzes from your notes or create a new question manually.
          </div>
          <button
            className="btn-primary"
            style={{ marginTop: 8 }}
            onClick={() => setShowAddModal(true)}
          >
            <IconPlus size={13} />
            <span>Create Question</span>
          </button>
        </div>
      )}

      {/* Add Question Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                <IconHelpCircle size={18} style={{ color: 'var(--ctp-blue)' }} />
                <span>Add Quiz Question</span>
              </h2>
              <button className="modal-close-btn" onClick={() => setShowAddModal(false)} title="Close">
                <IconX size={16} />
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
                <label className="form-label">Answer Options (Select the correct radio)</label>
                {options.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <input
                      type="radio"
                      name="correctOption"
                      checked={correctIdx === i}
                      onChange={() => setCorrectIdx(i)}
                      title="Mark as correct answer"
                      style={{ accentColor: 'var(--ctp-blue)', cursor: 'pointer' }}
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

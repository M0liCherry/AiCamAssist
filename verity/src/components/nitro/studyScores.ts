import type { Scope, Subject } from "./types";

export type FlashcardScoreData = {
  score: number;
  maxScore: number;
  mastered: number;
  learning: number;
  newCount: number;
  total: number;
  percentage: number;
  updatedAt: string;
};

export type QuizScoreData = {
  bestScore: number;
  total: number;
  percentage: number;
  attemptsCount: number;
  updatedAt: string;
};

export type ScopeScores = {
  scopeType: "chapter" | "subject";
  scopeId: number;
  flashcards?: FlashcardScoreData;
  quiz?: QuizScoreData;
};

const STORAGE_KEY = "VerityAI_study_scores_v1";

export function getStoredScores(): Record<string, ScopeScores> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ScopeScores>) : {};
  } catch {
    return {};
  }
}

export function getScopeScore(scopeType: "chapter" | "subject", scopeId: number): ScopeScores | null {
  const all = getStoredScores();
  return all[`${scopeType}:${scopeId}`] ?? null;
}

export function saveFlashcardSessionScore(
  scope: Scope,
  data: {
    score: number;
    maxScore: number;
    mastered: number;
    learning: number;
    newCount: number;
    total: number;
    percentage: number;
  },
) {
  if (typeof window === "undefined") return;
  try {
    const all = getStoredScores();
    const key = `${scope.scopeType}:${scope.scopeId}`;
    const existing = all[key] ?? { scopeType: scope.scopeType, scopeId: scope.scopeId };

    const prevScore = existing.flashcards?.score ?? -1;
    const shouldUpdate = data.score >= prevScore || (existing.flashcards?.mastered ?? 0) <= data.mastered;

    if (shouldUpdate || !existing.flashcards) {
      existing.flashcards = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      all[key] = existing;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      window.dispatchEvent(new CustomEvent("nitro:scores-updated"));
    }
  } catch {
    // Ignore storage quota or disabled storage
  }
}

export function saveQuizAttemptScore(
  scope: Scope,
  attempt: {
    score: number;
    total: number;
    percentage: number;
  },
) {
  if (typeof window === "undefined") return;
  try {
    const all = getStoredScores();
    const key = `${scope.scopeType}:${scope.scopeId}`;
    const existing = all[key] ?? { scopeType: scope.scopeType, scopeId: scope.scopeId };

    const currentBest = existing.quiz?.bestScore ?? -1;
    const isNewBest = attempt.score >= currentBest;
    const attemptsCount = (existing.quiz?.attemptsCount ?? 0) + 1;

    existing.quiz = {
      bestScore: isNewBest ? attempt.score : currentBest,
      total: isNewBest ? attempt.total : (existing.quiz?.total ?? attempt.total),
      percentage: isNewBest ? attempt.percentage : (existing.quiz?.percentage ?? attempt.percentage),
      attemptsCount,
      updatedAt: new Date().toISOString(),
    };

    all[key] = existing;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent("nitro:scores-updated"));
  } catch {
    // Ignore storage issues
  }
}

export function aggregateSubjectScores(subject: Subject) {
  const localScores = getStoredScores();

  let fcMastered = 0;
  let fcTotal = 0;
  let fcScore = 0;
  let fcMaxScore = 0;

  let quizBestTotal = 0;
  let quizQuestionTotal = 0;
  let quizAttempts = 0;

  const directSubjectLocal = localScores[`subject:${subject.id}`];
  if (directSubjectLocal?.flashcards) {
    fcMastered += directSubjectLocal.flashcards.mastered;
    fcTotal += directSubjectLocal.flashcards.total;
    fcScore += directSubjectLocal.flashcards.score;
    fcMaxScore += directSubjectLocal.flashcards.maxScore;
  } else if (subject.studyMetrics?.flashcards) {
    fcMastered += subject.studyMetrics.flashcards.mastered;
    fcTotal += subject.studyMetrics.flashcards.total;
    fcScore += subject.studyMetrics.flashcards.score;
    fcMaxScore += subject.studyMetrics.flashcards.maxScore;
  }

  if (directSubjectLocal?.quiz) {
    quizBestTotal += directSubjectLocal.quiz.bestScore;
    quizQuestionTotal += directSubjectLocal.quiz.total;
    quizAttempts += directSubjectLocal.quiz.attemptsCount;
  } else if (subject.studyMetrics?.quiz) {
    quizBestTotal += subject.studyMetrics.quiz.bestScore;
    quizQuestionTotal += subject.studyMetrics.quiz.total;
    quizAttempts += subject.studyMetrics.quiz.attemptsCount;
  }

  for (const ch of subject.chapters) {
    const chLocal = localScores[`chapter:${ch.id}`];
    const chFc = chLocal?.flashcards ?? ch.studyMetrics?.flashcards;
    if (chFc) {
      fcMastered += chFc.mastered;
      fcTotal += chFc.total;
      fcScore += chFc.score;
      fcMaxScore += chFc.maxScore;
    }

    const chQuiz = chLocal?.quiz ?? ch.studyMetrics?.quiz;
    if (chQuiz) {
      quizBestTotal += chQuiz.bestScore;
      quizQuestionTotal += chQuiz.total;
      quizAttempts += chQuiz.attemptsCount;
    }
  }

  const fcPercentage = fcMaxScore > 0 ? Math.round((fcScore / fcMaxScore) * 100) : fcTotal > 0 ? Math.round((fcMastered / fcTotal) * 100) : 0;
  const quizPercentage = quizQuestionTotal > 0 ? Math.round((quizBestTotal / quizQuestionTotal) * 100) : 0;

  return {
    flashcards: {
      mastered: fcMastered,
      total: fcTotal,
      score: fcScore,
      maxScore: fcMaxScore,
      percentage: fcPercentage,
      summary: fcTotal > 0 ? `${fcMastered}/${fcTotal} Mastered` : null,
    },
    quiz: {
      bestScore: quizBestTotal,
      total: quizQuestionTotal,
      percentage: quizPercentage,
      attemptsCount: quizAttempts,
    },
  };
}

export function getChapterScores(chapterId: number, subject?: Subject) {
  const localScores = getStoredScores();
  const chLocal = localScores[`chapter:${chapterId}`];
  const chDb = subject?.chapters.find((c) => c.id === chapterId)?.studyMetrics;

  const fc = chLocal?.flashcards ?? chDb?.flashcards;
  const quiz = chLocal?.quiz ?? chDb?.quiz;

  return {
    flashcards: fc
      ? {
        mastered: fc.mastered,
        total: fc.total,
        score: fc.score,
        maxScore: fc.maxScore,
        percentage: fc.percentage,
        summary: `${fc.mastered}/${fc.total} Mastered`,
      }
      : null,
    quiz: quiz
      ? {
        bestScore: quiz.bestScore,
        total: quiz.total,
        percentage: quiz.percentage,
        attemptsCount: quiz.attemptsCount,
      }
      : null,
  };
}

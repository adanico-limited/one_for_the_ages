// store/useGameStore.ts
/**
 * Game state management with Zustand
 */

import { create } from 'zustand'

export interface Question {
    id: string
    mode: string
    person_id?: string
    person_id_a?: string
    person_id_b?: string
    difficulty: number
    person_name?: string
    person_name_a?: string
    person_name_b?: string
    person_image_url?: string | null
    person_image_url_a?: string | null
    person_image_url_b?: string | null
    hints: string[]
    options: (string | number)[]
    correct_answer: Record<string, unknown> | null
}

export interface UnlockedAchievement {
    id: string
    title: string
    description: string
    icon?: string | null
}

export interface GameResult {
    totalScore: number
    questionsCount: number
    correctCount: number
    bestStreak: number
    accuracy: number
    newHighScore?: boolean
    lifetimeScore?: number
    globalRank?: number
    newAchievements?: UnlockedAchievement[]
}

interface GameState {
    sessionId: string | null
    mode: string | null
    questions: Question[]
    currentQuestionIndex: number
    score: number
    streak: number
    bestStreak: number
    correctCount: number
    hintsUsed: number
    startTime: number | null
    questionStartTime: number | null
    lastGameResult: GameResult | null

    isPaused: boolean
    pausedAt: number | null

    // Actions
    startGame: (sessionId: string, mode: string, questions: Question[]) => void
    nextQuestion: () => void
    submitAnswer: (isCorrect: boolean, scoreAwarded: number) => void
    useHint: () => void
    endGame: (result?: GameResult) => void
    resetGame: () => void
    pauseGame: () => void
    resumeGame: () => void
}

export const useGameStore = create<GameState>((set, get) => ({
    sessionId: null,
    mode: null,
    questions: [],
    currentQuestionIndex: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    correctCount: 0,
    hintsUsed: 0,
    startTime: null,
    questionStartTime: null,
    lastGameResult: null,
    isPaused: false,
    pausedAt: null,

    startGame: (sessionId, mode, questions) => {
        set({
            sessionId,
            mode,
            questions,
            currentQuestionIndex: 0,
            score: 0,
            streak: 0,
            bestStreak: 0,
            correctCount: 0,
            hintsUsed: 0,
            startTime: Date.now(),
            questionStartTime: Date.now(),
            lastGameResult: null,
            isPaused: false,
            pausedAt: null,
        })
    },

    nextQuestion: () => {
        const { currentQuestionIndex, questions } = get()
        if (currentQuestionIndex < questions.length - 1) {
            set({
                currentQuestionIndex: currentQuestionIndex + 1,
                questionStartTime: Date.now(),
            })
        }
    },

    submitAnswer: (isCorrect: boolean, scoreAwarded: number) => {
        const { streak, bestStreak, correctCount } = get()
        const newStreak = isCorrect ? streak + 1 : 0
        set({
            streak: newStreak,
            bestStreak: Math.max(bestStreak, newStreak),
            correctCount: isCorrect ? correctCount + 1 : correctCount,
            score: get().score + scoreAwarded
        })
    },


    useHint: () => {
        set({ hintsUsed: get().hintsUsed + 1 })
    },

    endGame: (result?: GameResult) => {
        if (result) {
            set({ lastGameResult: result })
        }
    },

    resetGame: () => {
        set({
            sessionId: null,
            mode: null,
            questions: [],
            currentQuestionIndex: 0,
            score: 0,
            streak: 0,
            bestStreak: 0,
            correctCount: 0,
            hintsUsed: 0,
            startTime: null,
            questionStartTime: null,
            lastGameResult: null,
            isPaused: false,
            pausedAt: null,
        })
    },

    pauseGame: () => {
        set({ isPaused: true, pausedAt: Date.now() })
    },

    resumeGame: () => {
        const { pausedAt, questionStartTime } = get()
        if (pausedAt && questionStartTime) {
            const pausedDuration = Date.now() - pausedAt
            set({
                isPaused: false,
                pausedAt: null,
                questionStartTime: questionStartTime + pausedDuration
            })
        } else {
            set({ isPaused: false, pausedAt: null })
        }
    },
}))

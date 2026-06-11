'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/ui/Layout'
import { PersonImage } from '@/components/ui/PersonImage'
import { GameLoadingSkeleton } from '@/components/ui/SkeletonLoader'
import { GamePauseModal } from '@/components/game/GamePauseModal'
import { HintModal } from '@/components/game/HintModal'
import { FeedbackOverlay } from '@/components/game/FeedbackOverlay'
import { OptionsGrid } from '@/components/game/OptionsGrid'
import { useGameStore } from '@/store/useGameStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useDifficultyStore, getDifficultyParam } from '@/store/useDifficultyStore'
import { getDbCategories } from '@/lib/categories'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { sounds } from '@/lib/sounds'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { ArrowLeft, Clock, Info, Pause, Play, X, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function AgeGuessPage() {
    const router = useRouter()
    const { isAuthenticated, authReady } = useAuthStore()
    const { selected: selectedCategories } = useCategoryStore()
    const { mode: diffMode, level: diffLevel } = useDifficultyStore()
    const {
        sessionId,
        questions,
        currentQuestionIndex,
        score,
        streak,
        isPaused,
        startGame,
        nextQuestion,
        submitAnswer,
        endGame,
        pauseGame,
        useHint,
    } = useGameStore()

    const [guess, setGuess] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [showHint, setShowHint] = useState(false)
    const [hasUsedHint, setHasUsedHint] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [selectedOption, setSelectedOption] = useState<number | null>(null)
    const [feedback, setFeedback] = useState<{
        type: 'spot-on' | 'close' | 'wrong' | null
        correctAge: number | null
        scoreAwarded: number
        diff: number
    }>({ type: null, correctAge: null, scoreAwarded: 0, diff: 0 })

    const currentQuestion = questions[currentQuestionIndex]
    const isLastQuestion = currentQuestionIndex === questions.length - 1

    useEffect(() => {
        if (!authReady) return
        if (!isAuthenticated) {
            router.push('/welcome')
            return
        }

        let cancelled = false

        const initGame = async () => {
            try {
                const categories = getDbCategories(selectedCategories)
                const difficulty = getDifficultyParam(diffMode, diffLevel)
                const session = await apiClient.startSession({ mode: 'AGE_GUESS', categories, difficulty })
                if (cancelled) return
                startGame(session.id, 'AGE_GUESS', session.questions)
                setIsLoading(false)
            } catch (error) {
                if (!cancelled) {
                    logger.error('Failed to start game:', error)
                    router.push('/')
                }
            }
        }

        initGame()
        return () => { cancelled = true }
    }, [isAuthenticated, authReady, router, startGame])

    const handleOptionSelect = (id: string | number) => {
        if (isSubmitting || feedback.type) return
        const val = Number(id)
        setSelectedOption(val)
        setGuess(val.toString())
        handleSubmit(val)
    }

    const handleSubmit = async (manualGuess?: number) => {
        const userGuess = manualGuess !== undefined ? manualGuess : parseInt(guess, 10)
        if (isNaN(userGuess) || !currentQuestion || isSubmitting || feedback.type) return

        setIsSubmitting(true)
        const questionStartTime = useGameStore.getState().questionStartTime || Date.now()
        const responseTimeMs = Date.now() - questionStartTime

        // Show result immediately using the correct_answer embedded in the question
        const correctAge = currentQuestion.correct_answer?.age as number
        const diff = Math.abs(userGuess - correctAge)

        let type: 'spot-on' | 'close' | 'wrong' = 'wrong'
        if (diff === 0) {
            type = 'spot-on'
            sounds.play('correct')
            Haptics.impact({ style: ImpactStyle.Heavy })
        } else if (diff <= 2) {
            type = 'close'
            sounds.play('correct')
            Haptics.impact({ style: ImpactStyle.Medium })
        } else {
            sounds.play('wrong')
            Haptics.impact({ style: ImpactStyle.Light })
        }

        const isCorrect = diff === 0
        setFeedback({ type, correctAge, scoreAwarded: 0, diff })
        submitAnswer(isCorrect, 0)
        setIsSubmitting(false)

        // Fire API in background for score tracking — don't await
        apiClient.submitAnswer(sessionId!, {
            question_template_id: currentQuestion.id,
            question_index: currentQuestionIndex,
            user_answer: { age: userGuess },
            response_time_ms: responseTimeMs,
            hints_used: hasUsedHint ? 1 : 0,
        }).then((result) => {
            if (result) {
                // Update score with server-computed value
                submitAnswer(result.is_correct, result.score_awarded)
                setFeedback(prev => prev.type ? { ...prev, scoreAwarded: result.score_awarded } : prev)
            }
        }).catch((err) => logger.error('Failed to submit answer:', err))
    }

    const handleNext = () => {
        if (isLastQuestion) {
            handleEndGame()
        } else {
            setFeedback({ type: null, correctAge: null, scoreAwarded: 0, diff: 0 })
            setGuess('')
            setSelectedOption(null)
            setShowHint(false)
            setHasUsedHint(false)
            nextQuestion()
        }
    }

    const handleEndGame = async () => {
        try {
            setIsLoading(true)
            const result = await apiClient.endSession(sessionId!)
            endGame(result)
            router.push('/game/results')
        } catch (error) {
            logger.error('Failed to end:', error)
            router.push('/game/results')
        }
    }

    if (isLoading || !currentQuestion) {
        return (
            <AppShell className="flex items-center justify-center bg-canvas">
                <GameLoadingSkeleton />
            </AppShell>
        )
    }

    const progressPct = ((currentQuestionIndex + 1) / questions.length) * 100

    return (
        <AppShell className="bg-canvas flex flex-col p-6 min-h-screen relative overflow-hidden">

            {/* 1️⃣ Top HUD */}
            <header className="flex justify-between items-center mb-4">
                <div className="flex flex-col">
                    <span className="font-montserrat font-bold text-[10px] text-text-muted tracking-[0.2em] uppercase opacity-60">
                        Age Guess
                    </span>
                    <span className="font-serif text-lg text-text-primary">
                        {currentQuestionIndex + 1} <span className="text-text-muted/30">/</span> {questions.length}
                    </span>
                </div>

                <div className="text-right">
                    <span className="font-montserrat font-bold text-[10px] text-primary tracking-[0.2em] uppercase opacity-60">
                        Score
                    </span>
                    <p className="font-serif text-2xl text-text-primary">
                        {score}
                    </p>
                </div>
            </header>

            {/* Progress Bar */}
            <div className="w-full bg-white/5 h-[2px] mb-8 overflow-hidden rounded-full">
                <div
                    className="h-full bg-primary transition-all duration-700 ease-out"
                    style={{ width: `${progressPct}%` }}
                />
            </div>

            {/* 2️⃣ Person Card */}
            <div className="flex-1 flex flex-col items-center justify-center space-y-8 pb-12">
                <div className="relative w-full max-w-[280px] aspect-square group">
                    <PersonImage
                        name={currentQuestion.person_name!}
                        imageUrl={currentQuestion.person_image_url}
                        size="xl"
                        rounded="sharp"
                        className="transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80 pointer-events-none rounded-sharp" />

                    {/* Floating Streak Badge if relevant */}
                    {streak > 2 && (
                        <div className="absolute top-4 right-4 bg-gold text-canvas font-montserrat font-bold text-[10px] px-2 py-1 rounded-sharp animate-flame">
                            {streak} STREAK
                        </div>
                    )}
                </div>

                <div className="text-center space-y-2">
                    <h2 className="font-serif text-3xl text-text-primary leading-tight">
                        {currentQuestion.person_name}
                    </h2>
                    {feedback.type && (
                        <p className={`font-montserrat font-bold text-xs tracking-[0.2em] uppercase ${feedback.type === 'spot-on' ? 'text-green-400' : 'text-primary'}`}>
                            Correct Age: {feedback.correctAge}
                        </p>
                    )}
                </div>
            </div>

            {/* 3️⃣ Options Grid */}
            <div className="w-full max-w-md mx-auto mb-8 px-4">
                <OptionsGrid
                    options={currentQuestion.options?.map((opt: number) => ({
                        id: opt,
                        label: opt.toString(),
                    })) || []}
                    onSelect={handleOptionSelect}
                    selectedId={selectedOption}
                    correctId={feedback.correctAge}
                    disabled={isSubmitting || !!feedback.type}
                    className="grid-cols-2 gap-4"
                    accentColor="teal"
                />
            </div>

            {/* 5️⃣ Secondary Controls */}
            <footer className="flex justify-between items-center px-2 pb-4">
                <button
                    onClick={() => setShowHint(true)}
                    disabled={hasUsedHint}
                    className="flex items-center gap-2 text-text-muted/40 hover:text-text-muted transition-colors disabled:opacity-30 disabled:hover:text-text-muted/40"
                >
                    <Info size={14} />
                    <span className="font-montserrat font-bold text-[10px] tracking-[0.2em] uppercase">
                        {hasUsedHint ? 'Hint Used' : 'Hint (-20%)'}
                    </span>
                </button>

                <button
                    onClick={() => pauseGame()}
                    className="flex items-center gap-2 text-text-muted/40 hover:text-text-muted transition-colors"
                >
                    <Pause size={14} />
                    <span className="font-montserrat font-bold text-[10px] tracking-[0.2em] uppercase">Pause</span>
                </button>
            </footer>

            {/* 🔥 FEEDBACK OVERLAYS */}

            {/* Immediate Response Overlay */}
            {feedback.type && (
                <FeedbackOverlay
                    type={feedback.type}
                    scoreAwarded={feedback.scoreAwarded}
                    correctAnswer={feedback.correctAge!}
                    onComplete={handleNext}
                    isLastQuestion={isLastQuestion}
                />
            )}

            {/* Hint Modal */}
            {showHint && !feedback.type && (
                <HintModal
                    hint={currentQuestion.hints?.[0] || 'No hint available.'}
                    onClose={() => setShowHint(false)}
                    onUseHint={() => {
                        useHint()
                        setHasUsedHint(true)
                    }}
                    isDaily={useGameStore.getState().mode === 'DAILY_CHALLENGE'}
                />
            )}

            {/* Pause Modal */}
            {isPaused && <GamePauseModal />}

        </AppShell>
    )
}

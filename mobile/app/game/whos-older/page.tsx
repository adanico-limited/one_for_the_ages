'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/ui/Layout'
import { PersonImage } from '@/components/ui/PersonImage'
import { GameLoadingSkeleton } from '@/components/ui/SkeletonLoader'
import { useGameStore } from '@/store/useGameStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useDifficultyStore, getDifficultyParam } from '@/store/useDifficultyStore'
import { getDbCategories } from '@/lib/categories'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { sounds } from '@/lib/sounds'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { ArrowLeft, Clock, Info, Pause, Play, CheckCircle, X } from 'lucide-react'

const TIMER_DURATION = 8000 // 8 seconds

export default function WhosOlderPage() {
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
        startGame,
        nextQuestion,
        submitAnswer,
        endGame,
    } = useGameStore()

    const [isLoading, setIsLoading] = useState(true)
    const [isPaused, setIsPaused] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [selection, setSelection] = useState<'A' | 'B' | null>(null)

    // Timer state
    const [timeLeft, setTimeLeft] = useState(TIMER_DURATION)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    // Feedback state
    const [feedback, setFeedback] = useState<{
        isCorrect: boolean
        correctChoice: 'A' | 'B' | null
        scoreAwarded: number
        yearA?: number
        yearB?: number
    } | null>(null)

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
                const session = await apiClient.startSession({ mode: 'WHO_OLDER', categories, difficulty })
                if (cancelled) return
                startGame(session.id, 'WHO_OLDER', session.questions)
                setIsLoading(false)
                startTimer()
            } catch (error) {
                if (!cancelled) {
                    logger.error('Failed to start game:', error)
                    router.push('/')
                }
            }
        }

        initGame()

        return () => {
            cancelled = true
            stopTimer()
        }
    }, [isAuthenticated, authReady, router, startGame])

    // Timer logic
    const startTimer = () => {
        stopTimer()
        setTimeLeft(TIMER_DURATION)
        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 0) {
                    stopTimer()
                    handleSelection(null) // Timeout
                    return 0
                }
                return prev - 100
            })
        }, 100)
    }

    const stopTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current)
    }

    const handleSelection = async (choice: 'A' | 'B' | null) => {
        if (isSubmitting || feedback || isPaused) return

        stopTimer()
        setSelection(choice)
        setIsSubmitting(true)

        if (!choice) {
            // Handle timeout
            setFeedback({
                isCorrect: false,
                correctChoice: null, // should probably fetch this still
                scoreAwarded: 0
            })
            setTimeout(handleNext, 1200)
            return
        }

        try {
            const questionStartTime = useGameStore.getState().questionStartTime || Date.now()
            const responseTimeMs = Date.now() - questionStartTime

            const result = await apiClient.submitAnswer(sessionId!, {
                question_template_id: currentQuestion.id,
                question_index: currentQuestionIndex,
                user_answer: { choice },
                response_time_ms: responseTimeMs,
                hints_used: 0,
            })

            const correctChoice = result.correct_answer.choice
            const yearA = result.correct_answer.year_a || result.correct_answer.birth_year_a
            const yearB = result.correct_answer.year_b || result.correct_answer.birth_year_b

            setFeedback({
                isCorrect: result.is_correct,
                correctChoice,
                scoreAwarded: result.score_awarded,
                yearA: yearA,
                yearB: yearB
            })

            if (result.is_correct) {
                sounds.play('correct')
                await Haptics.impact({ style: ImpactStyle.Medium })
            } else {
                sounds.play('wrong')
                await Haptics.impact({ style: ImpactStyle.Light })
            }

            submitAnswer(result.is_correct, result.score_awarded)

            // Auto-advance
            setTimeout(handleNext, 1200)

        } catch (error) {
            logger.error('Failed to submit:', error)
            handleNext()
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleNext = () => {
        if (isLastQuestion) {
            handleEndGame()
        } else {
            setFeedback(null)
            setSelection(null)
            nextQuestion()
            startTimer()
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
    const timerPct = (timeLeft / TIMER_DURATION) * 100

    return (
        <AppShell className="bg-canvas flex flex-col p-6 min-h-screen relative overflow-hidden">

            {/* 1️⃣ Top HUD */}
            <header className="flex justify-between items-center mb-4">
                <div className="flex flex-col">
                    <span className="font-montserrat font-bold text-[10px] text-text-muted tracking-[0.2em] uppercase opacity-60">
                        Who's Older?
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

            {/* 4️⃣ Optional Timer Bar */}
            <div className="w-full bg-white/5 h-[3px] mb-8 overflow-hidden rounded-full relative">
                <div
                    className={`h-full transition-all duration-100 linear ${timerPct < 30 ? 'bg-orange-500' : 'bg-gold'}`}
                    style={{ width: `${timerPct}%` }}
                />
                {/* HUD-style Question progress underlying */}
                <div
                    className="absolute inset-0 bg-primary/20 -z-10"
                    style={{ width: `${progressPct}%` }}
                />
            </div>

            {/* 2️⃣ VS Header */}
            <div className="text-center mb-10">
                <h1 className="font-montserrat font-bold text-[10px] text-text-muted tracking-[0.4em] uppercase opacity-80">
                    Who was born first?
                </h1>
            </div>

            {/* 3️⃣ Split Person Layout */}
            <div className="flex-1 grid grid-cols-2 gap-4 h-full max-h-[440px]">
                {/* Person A */}
                <button
                    disabled={!!feedback || isPaused}
                    onClick={() => handleSelection('A')}
                    className={`relative flex flex-col group transition-all duration-300 ${selection === 'B' ? 'opacity-30 scale-95' : 'opacity-100 scale-100'
                        } ${feedback?.correctChoice === 'A' ? 'ring-2 ring-green-500 rounded-sharp shadow-[0_0_20px_rgba(34,197,94,0.3)]' :
                            selection === 'A' && feedback?.isCorrect === false ? 'ring-2 ring-red-500 rounded-sharp' : ''
                        }`}
                >
                    <div className="flex-1 rounded-sharp overflow-hidden relative">
                        <PersonImage
                            name={currentQuestion.person_name_a!}
                            imageUrl={currentQuestion.person_image_url_a}
                            size="full"
                            rounded="sharp"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

                        {/* Reveal Year */}
                        {feedback && (
                            <div className="absolute bottom-4 left-0 right-0 text-center animate-slide-up">
                                <p className="font-montserrat font-bold text-[10px] text-gold tracking-widest uppercase mb-1">Born</p>
                                <p className="font-serif text-2xl text-white">{feedback.yearA || '----'}</p>
                            </div>
                        )}
                    </div>
                    <div className="py-4 text-center">
                        <h3 className="font-serif text-lg text-text-primary line-clamp-1">
                            {currentQuestion.person_name_a}
                        </h3>
                    </div>
                </button>

                {/* Person B */}
                <button
                    disabled={!!feedback || isPaused}
                    onClick={() => handleSelection('B')}
                    className={`relative flex flex-col group transition-all duration-300 ${selection === 'A' ? 'opacity-30 scale-95' : 'opacity-100 scale-100'
                        } ${feedback?.correctChoice === 'B' ? 'ring-2 ring-green-500 rounded-sharp shadow-[0_0_20px_rgba(34,197,94,0.3)]' :
                            selection === 'B' && feedback?.isCorrect === false ? 'ring-2 ring-red-500 rounded-sharp' : ''
                        }`}
                >
                    <div className="flex-1 rounded-sharp overflow-hidden relative">
                        <PersonImage
                            name={currentQuestion.person_name_b!}
                            imageUrl={currentQuestion.person_image_url_b}
                            size="full"
                            rounded="sharp"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

                        {/* Reveal Year */}
                        {feedback && (
                            <div className="absolute bottom-4 left-0 right-0 text-center animate-slide-up">
                                <p className="font-montserrat font-bold text-[10px] text-gold tracking-widest uppercase mb-1">Born</p>
                                <p className="font-serif text-2xl text-white">{feedback.yearB || '----'}</p>
                            </div>
                        )}
                    </div>
                    <div className="py-4 text-center">
                        <h3 className="font-serif text-lg text-text-primary line-clamp-1">
                            {currentQuestion.person_name_b}
                        </h3>
                    </div>
                </button>
            </div>

            {/* 5️⃣ Subtle Instruction Text / Outcome Overlay */}
            <footer className="mt-12 h-20 flex flex-col items-center justify-center space-y-2">
                {!feedback ? (
                    <div className="flex flex-col items-center gap-2 opacity-40 animate-pulse-slow">
                        <p className="font-montserrat font-bold text-[10px] tracking-[0.3em] uppercase">Tap the older one</p>
                    </div>
                ) : (
                    <div className="text-center animate-scale-in">
                        <p className={`font-montserrat font-bold text-xs tracking-[0.2em] uppercase ${feedback.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                            {feedback.isCorrect ? `Correct +${feedback.scoreAwarded}` : 'Incorrect'}
                        </p>
                    </div>
                )}
            </footer>

            {/* Float Pause Control */}
            <div className="absolute bottom-8 right-6">
                <button
                    onClick={() => setIsPaused(true)}
                    className="p-3 bg-white/5 border border-white/5 rounded-full text-text-muted/40 hover:text-text-muted transition-colors shadow-2xl"
                >
                    <Pause size={18} />
                </button>
            </div>

            {/* Pause Overlay */}
            {isPaused && (
                <div className="fixed inset-0 z-50 bg-canvas flex flex-col items-center justify-center p-8 animate-fade-in">
                    <h1 className="font-serif text-5xl text-text-primary mb-12">Paused</h1>
                    <div className="w-full max-w-xs space-y-4">
                        <button
                            onClick={() => setIsPaused(false)}
                            className="w-full bg-primary text-white font-montserrat font-bold text-xs tracking-[0.4em] uppercase py-6 rounded-sharp flex items-center justify-center gap-3"
                        >
                            <Play size={16} /> Resume
                        </button>
                        <button
                            onClick={() => router.push('/')}
                            className="w-full bg-white/5 text-text-muted font-montserrat font-bold text-xs tracking-[0.4em] uppercase py-6 rounded-sharp"
                        >
                            Quit Game
                        </button>
                    </div>
                </div>
            )}

        </AppShell>
    )
}

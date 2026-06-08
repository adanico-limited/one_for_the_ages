'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/store/useGameStore'
import { useAuthStore } from '@/store/useAuthStore'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { sounds } from '@/lib/sounds'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { PersonImage } from '@/components/ui/PersonImage'
import { Card } from '@/components/ui/Card'
import { GameLoadingSkeleton } from '@/components/ui/SkeletonLoader'
import { AppShell } from '@/components/ui/Layout'
import { ReverseHUD } from '@/components/game/ReverseHUD'
import { OptionsGrid } from '@/components/game/OptionsGrid'
import { motion, AnimatePresence } from 'framer-motion'

const ZODIAC_SIGNS = [
    { id: 'Aries', label: 'Aries', symbol: '♈' },
    { id: 'Taurus', label: 'Taurus', symbol: '♉' },
    { id: 'Gemini', label: 'Gemini', symbol: '♊' },
    { id: 'Cancer', label: 'Cancer', symbol: '♋' },
    { id: 'Leo', label: 'Leo', symbol: '♌' },
    { id: 'Virgo', label: 'Virgo', symbol: '♍' },
    { id: 'Libra', label: 'Libra', symbol: '♎' },
    { id: 'Scorpio', label: 'Scorpio', symbol: '♏' },
    { id: 'Sagittarius', label: 'Sagittarius', symbol: '♐' },
    { id: 'Capricorn', label: 'Capricorn', symbol: '♑' },
    { id: 'Aquarius', label: 'Aquarius', symbol: '♒' },
    { id: 'Pisces', label: 'Pisces', symbol: '♓' },
]

export default function ReverseModePage() {
    const router = useRouter()
    const { isAuthenticated } = useAuthStore()
    const {
        sessionId,
        questions,
        currentQuestionIndex,
        score,
        startGame,
        nextQuestion,
        submitAnswer,
        endGame,
    } = useGameStore()

    const [selectedId, setSelectedId] = useState<string | number | null>(null)
    const [correctId, setCorrectId] = useState<string | number | null>(null)
    const [feedback, setFeedback] = useState<{ isCorrect: boolean, text: string, subtext: string } | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [mode, setMode] = useState<'REVERSE_SIGN' | 'REVERSE_DOB' | null>(null)

    const currentQuestion = questions[currentQuestionIndex]
    const isLastQuestion = currentQuestionIndex === questions.length - 1

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/welcome')
            return
        }

        const initGame = async () => {
            try {
                // For MVP, we'll alternate or pick based on search params? Let's default to SIGN for now
                // but read it from URL if possible.
                const searchParams = new URLSearchParams(window.location.search)
                const requestedMode = (searchParams.get('type') === 'year' ? 'REVERSE_DOB' : 'REVERSE_SIGN') as 'REVERSE_SIGN' | 'REVERSE_DOB'
                setMode(requestedMode)

                const session = await apiClient.startSession({ mode: requestedMode })
                startGame(session.id, requestedMode, session.questions)
                setIsLoading(false)
            } catch (error) {
                logger.error('Failed to start game:', error)
                router.push('/')
            }
        }

        if (!sessionId) {
            initGame()
        } else {
            setMode(useGameStore.getState().mode as any)
            setIsLoading(false)
        }
    }, [isAuthenticated, sessionId, router, startGame])

    // Generate options based on mode
    const options = useMemo(() => {
        if (!currentQuestion || !currentQuestion.options) return []

        return currentQuestion.options.map((opt: any) => {
            if (mode === 'REVERSE_SIGN') {
                const signInfo = ZODIAC_SIGNS.find(s => s.id === opt)
                return {
                    id: opt,
                    label: opt,
                    symbol: signInfo?.symbol
                }
            } else {
                return { id: opt, label: opt.toString() }
            }
        })
    }, [mode, currentQuestion])

    const handleSelect = async (id: string | number) => {
        if (feedback || !currentQuestion) return
        setSelectedId(id)

        try {
            const responseTimeMs = Date.now() - (useGameStore.getState().questionStartTime || 0)

            const userAnswer = mode === 'REVERSE_SIGN' ? { sign: id } : { year: id }
            const result = await apiClient.submitAnswer(sessionId!, {
                question_template_id: currentQuestion.id,
                question_index: currentQuestionIndex,
                user_answer: userAnswer,
                response_time_ms: responseTimeMs,
                hints_used: 0,
            })

            const correctVal = mode === 'REVERSE_SIGN' ? result.correct_answer?.sign : result.correct_answer?.year
            setCorrectId(correctVal)
            submitAnswer(result.is_correct, result.score_awarded)

            if (result.is_correct) {
                sounds.play('correct')
                await Haptics.impact({ style: ImpactStyle.Medium })
            } else {
                sounds.play('wrong')
                await Haptics.impact({ style: ImpactStyle.Light })
            }

            setFeedback({
                isCorrect: result.is_correct,
                text: result.is_correct ? 'Correct' : 'Incorrect',
                subtext: result.is_correct
                    ? `${correctVal} +${result.score_awarded}`
                    : `Correct Answer: ${correctVal}`
            })

            setTimeout(() => {
                if (isLastQuestion) {
                    handleEndGame()
                } else {
                    nextQuestion()
                    setSelectedId(null)
                    setCorrectId(null)
                    setFeedback(null)
                }
            }, 1500) // 1s + some buffer
        } catch (error) {
            logger.error('Failed to submit:', error)
        }
    }

    const handleEndGame = async () => {
        try {
            const result = await apiClient.endSession(sessionId!)
            endGame(result)
            router.push('/game/results')
        } catch (error) {
            logger.error('Failed to end game:', error)
        }
    }

    if (isLoading || !currentQuestion) {
        return (
            <AppShell className="flex items-center justify-center">
                <GameLoadingSkeleton />
            </AppShell>
        )
    }

    return (
        <div className="min-h-screen bg-canvas pb-10">
            <ReverseHUD
                current={currentQuestionIndex + 1}
                total={questions.length}
                score={score}
            />

            <AnimatePresence mode="wait">
                <motion.main
                    key={currentQuestionIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="px-6 pt-8 space-y-8 max-w-md mx-auto"
                >
                    {/* Prompt */}
                    <div className="text-center space-y-1">
                        <p className="text-text-primary text-lg font-medium">
                            {mode === 'REVERSE_SIGN' ? 'What is their sign?' : 'Which year were they born?'}
                        </p>
                    </div>

                    {/* Person Card */}
                    <div className="relative group">
                        <div className="aspect-[4/5] w-full overflow-hidden rounded-sharp border-sharp border-border-subtle bg-surface">
                            <PersonImage
                                name={currentQuestion.person_name!}
                                imageUrl={currentQuestion.person_image_url}
                                size="xl"
                                rounded="sharp"
                                className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-700"
                            />
                        </div>
                        <div className="mt-4 text-center">
                            <h2 className="text-2xl font-bold tracking-tight text-text-primary uppercase">
                                {currentQuestion.person_name}
                            </h2>
                        </div>
                    </div>

                    {/* Options Grid */}
                    <OptionsGrid
                        options={options}
                        onSelect={handleSelect}
                        selectedId={selectedId}
                        correctId={correctId}
                        disabled={!!feedback}
                        accentColor="violet"
                        className="pt-4"
                    />

                    {/* HUD Replacement/Secondary Controls (Hint/Pause) */}
                    <div className="flex justify-between items-center px-2 pt-4">
                        <button className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-opacity">
                            Hint (-20%)
                        </button>
                        <button className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-opacity">
                            Pause
                        </button>
                    </div>
                </motion.main>
            </AnimatePresence>

            {/* Feedback Overlay - Bottom Float */}
            <AnimatePresence>
                {feedback && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="fixed bottom-10 left-0 right-0 flex justify-center z-20 pointer-events-none"
                    >
                        <div className={`
                            px-8 py-3 rounded-sharp border-sharp flex flex-col items-center
                            ${feedback.isCorrect
                                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                : 'bg-red-500/10 border-red-500/30 text-red-400'}
                            backdrop-blur-md shadow-2xl
                        `}>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-0.5">
                                {feedback.text}
                            </span>
                            <span className="text-lg font-bold">
                                {feedback.subtext}
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

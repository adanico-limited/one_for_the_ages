import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { PersonImage } from '@/components/ui/PersonImage'
import { GameLoadingSkeleton } from '@/components/ui/SkeletonLoader'
import { FeedbackOverlay } from '@/components/game/FeedbackOverlay'
import { useGameStore } from '@/store/useGameStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useDifficultyStore, getDifficultyParam } from '@/store/useDifficultyStore'
import { getDbCategories } from '@/lib/categories'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { sounds } from '@/lib/sounds'
import { haptics, ImpactStyle } from '@/lib/haptics'

const TIMER_DURATION = 8000

export default function WhosOlderPage() {
    const router = useRouter()
    const { isAuthenticated, authReady } = useAuthStore()
    const { selected: selectedCategories } = useCategoryStore()
    const { mode: diffMode, level: diffLevel } = useDifficultyStore()
    const { sessionId, questions, currentQuestionIndex, score, streak, startGame, nextQuestion, submitAnswer, endGame } = useGameStore()

    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [selection, setSelection] = useState<'A' | 'B' | null>(null)
    const [timeLeft, setTimeLeft] = useState(TIMER_DURATION)
    const [feedback, setFeedback] = useState<{ type: 'spot-on' | 'close' | 'wrong'; scoreAwarded: number; correctAnswer: string } | null>(null)

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const pendingSubmit = useRef<Promise<any> | null>(null)
    const currentQuestion = questions[currentQuestionIndex]
    const isLastQuestion = currentQuestionIndex === questions.length - 1

    useEffect(() => {
        if (!authReady) return
        if (!isAuthenticated) { router.replace('/welcome'); return }
        let cancelled = false
        const init = async () => {
            try {
                const categories = getDbCategories(selectedCategories)
                const difficulty = getDifficultyParam(diffMode, diffLevel)
                const session = await apiClient.startSession({ mode: 'WHO_OLDER', categories, difficulty })
                if (cancelled) return
                startGame(session.id, 'WHO_OLDER', session.questions)
                setIsLoading(false)
                startTimer()
            } catch (e) {
                if (!cancelled) { logger.error('Failed to start:', e); router.replace('/') }
            }
        }
        init()
        return () => { cancelled = true; stopTimer() }
    }, [isAuthenticated, authReady])

    const startTimer = () => {
        stopTimer()
        setTimeLeft(TIMER_DURATION)
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 100) { handleTimeout(); return 0 }
                return prev - 100
            })
        }, 100)
    }

    const stopTimer = () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }

    const handleTimeout = () => {
        stopTimer()
        if (!isSubmitting && !feedback) handleSelect(null as any)
    }

    const handleSelect = async (choice: 'A' | 'B') => {
        if (isSubmitting || feedback || !currentQuestion) return
        setIsSubmitting(true)
        stopTimer()
        setSelection(choice)

        const startTime = useGameStore.getState().questionStartTime || Date.now()
        const responseTimeMs = Date.now() - startTime
        const correctAnswer = currentQuestion.correct_answer as any

        const submitPromise = apiClient.submitAnswer(sessionId!, {
            question_template_id: currentQuestion.id,
            question_index: currentQuestionIndex,
            user_answer: { choice },
            response_time_ms: responseTimeMs,
            hints_used: 0,
        }).then(result => {
            const isCorrect = result?.is_correct ?? false
            const scoreAwarded = result?.score_awarded ?? 0
            if (isCorrect) { sounds.play('correct'); haptics.impact(ImpactStyle.Heavy) }
            else { sounds.play('wrong'); haptics.impact(ImpactStyle.Light) }
            submitAnswer(isCorrect, scoreAwarded)
            const olderName = correctAnswer?.older === 'A' ? currentQuestion.person_name_a : currentQuestion.person_name_b
            setFeedback({ type: isCorrect ? 'spot-on' : 'wrong', scoreAwarded, correctAnswer: olderName || 'Unknown' })
        }).catch(err => logger.error('Submit failed:', err))

        pendingSubmit.current = submitPromise
        setIsSubmitting(false)
    }

    const handleNext = () => {
        if (isLastQuestion) { handleEndGame(); return }
        setFeedback(null)
        setSelection(null)
        nextQuestion()
        startTimer()
    }

    const handleEndGame = async () => {
        try {
            setIsLoading(true)
            if (pendingSubmit.current) await pendingSubmit.current
            const result = await apiClient.endSession(sessionId!)
            endGame(result)
            router.replace('/game/results')
        } catch { router.replace('/game/results') }
    }

    if (isLoading || !currentQuestion) {
        return <SafeAreaView style={s.safe}><GameLoadingSkeleton /></SafeAreaView>
    }

    const timerPct = timeLeft / TIMER_DURATION
    const progressPct = ((currentQuestionIndex + 1) / questions.length) * 100

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.container}>
                {/* HUD */}
                <View style={s.hud}>
                    <View>
                        <Text style={s.hudLabel}>WHO'S OLDER?</Text>
                        <Text style={s.hudQ}>{currentQuestionIndex + 1} / {questions.length}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={s.hudLabel}>SCORE</Text>
                        <Text style={s.hudScore}>{score}</Text>
                    </View>
                </View>

                {/* Progress */}
                <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${progressPct}%` }]} />
                </View>

                {/* Timer */}
                <View style={s.timerTrack}>
                    <View style={[s.timerFill, { width: `${timerPct * 100}%`, backgroundColor: timerPct < 0.3 ? '#ef4444' : '#6c63ff' }]} />
                </View>

                {/* Question */}
                <Text style={s.question}>Who is OLDER?</Text>

                {/* Two person cards */}
                <View style={s.cards}>
                    {(['A', 'B'] as const).map(side => {
                        const name = side === 'A' ? currentQuestion.person_name_a : currentQuestion.person_name_b
                        const image = side === 'A' ? currentQuestion.person_image_url_a : currentQuestion.person_image_url_b
                        const isSelected = selection === side

                        return (
                            <TouchableOpacity
                                key={side}
                                style={[s.personCard, isSelected && s.personCardSelected]}
                                onPress={() => handleSelect(side)}
                                disabled={!!feedback || isSubmitting}
                                activeOpacity={0.75}
                            >
                                <PersonImage name={name || '?'} imageUrl={image} size="lg" />
                                <Text style={s.personName}>{name}</Text>
                            </TouchableOpacity>
                        )
                    })}
                </View>
            </View>

            {feedback && (
                <FeedbackOverlay
                    type={feedback.type}
                    scoreAwarded={feedback.scoreAwarded}
                    correctAnswer={feedback.correctAnswer}
                    onComplete={handleNext}
                    isLastQuestion={isLastQuestion}
                    streak={streak}
                />
            )}
        </SafeAreaView>
    )
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#1a1a2e' },
    container: { flex: 1, padding: 24, gap: 12 },
    hud: { flexDirection: 'row', justifyContent: 'space-between' },
    hudLabel: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', opacity: 0.6 },
    hudQ: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 18 },
    hudScore: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 24 },
    progressTrack: { height: 2, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 1, overflow: 'hidden' },
    progressFill: { height: 2, backgroundColor: '#6c63ff' },
    timerTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' },
    timerFill: { height: 4, borderRadius: 2 },
    question: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 22, textAlign: 'center', marginVertical: 8 },
    cards: { flex: 1, flexDirection: 'row', gap: 16, alignItems: 'center' },
    personCard: { flex: 1, backgroundColor: '#252847', borderWidth: 1, borderColor: '#2e2c4e', borderRadius: 4, padding: 16, alignItems: 'center', gap: 12 },
    personCardSelected: { borderColor: '#6c63ff', backgroundColor: 'rgba(108,99,255,0.1)' },
    personName: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 13, textAlign: 'center' },
})

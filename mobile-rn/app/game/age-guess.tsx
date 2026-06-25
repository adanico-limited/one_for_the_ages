import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native'
import { useRouter } from 'expo-router'
import { Info, Pause } from 'lucide-react-native'
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
import { haptics, ImpactStyle } from '@/lib/haptics'

export default function AgeGuessPage() {
    const router = useRouter()
    const { isAuthenticated, authReady } = useAuthStore()
    const { selected: selectedCategories } = useCategoryStore()
    const { mode: diffMode, level: diffLevel } = useDifficultyStore()
    const {
        sessionId, questions, currentQuestionIndex, score, streak, isPaused,
        startGame, nextQuestion, submitAnswer, endGame, pauseGame, useHint,
    } = useGameStore()

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

    const pendingSubmit = useRef<Promise<any> | null>(null)
    const currentQuestion = questions[currentQuestionIndex]
    const isLastQuestion = currentQuestionIndex === questions.length - 1

    useEffect(() => {
        if (!authReady) return
        if (!isAuthenticated) { router.replace('/welcome'); return }

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
                if (!cancelled) { logger.error('Failed to start game:', error); router.replace('/') }
            }
        }
        initGame()
        return () => { cancelled = true }
    }, [isAuthenticated, authReady])

    const handleOptionSelect = (id: string | number) => {
        if (isSubmitting || feedback.type) return
        const val = Number(id)
        setSelectedOption(val)
        handleSubmit(val)
    }

    const handleSubmit = async (manualGuess: number) => {
        if (isNaN(manualGuess) || !currentQuestion || isSubmitting || feedback.type) return
        setIsSubmitting(true)

        const questionStartTime = useGameStore.getState().questionStartTime || Date.now()
        const responseTimeMs = Date.now() - questionStartTime
        const correctAge = currentQuestion.correct_answer?.age as number
        const diff = Math.abs(manualGuess - correctAge)

        let type: 'spot-on' | 'close' | 'wrong' = 'wrong'
        if (diff === 0) { type = 'spot-on'; sounds.play('correct'); haptics.impact(ImpactStyle.Heavy) }
        else if (diff === 1) { type = 'close'; sounds.play('correct'); haptics.impact(ImpactStyle.Medium) }
        else { sounds.play('wrong'); haptics.impact(ImpactStyle.Light) }

        setFeedback({ type, correctAge, scoreAwarded: 0, diff })
        setIsSubmitting(false)

        const submitPromise = apiClient.submitAnswer(sessionId!, {
            question_template_id: currentQuestion.id,
            question_index: currentQuestionIndex,
            user_answer: { age: manualGuess },
            response_time_ms: responseTimeMs,
            hints_used: hasUsedHint ? 1 : 0,
        }).then((result) => {
            if (result) {
                submitAnswer(result.is_correct, result.score_awarded)
                setFeedback(prev => prev.type ? { ...prev, scoreAwarded: result.score_awarded } : prev)
            }
        }).catch((err) => logger.error('Failed to submit answer:', err))

        pendingSubmit.current = submitPromise
    }

    const handleNext = () => {
        if (isLastQuestion) { handleEndGame(); return }
        setFeedback({ type: null, correctAge: null, scoreAwarded: 0, diff: 0 })
        setSelectedOption(null)
        setShowHint(false)
        setHasUsedHint(false)
        nextQuestion()
    }

    const handleEndGame = async () => {
        try {
            setIsLoading(true)
            if (pendingSubmit.current) await pendingSubmit.current
            const result = await apiClient.endSession(sessionId!)
            endGame(result)
            router.replace('/game/results')
        } catch (error) {
            logger.error('Failed to end:', error)
            router.replace('/game/results')
        }
    }

    if (isLoading || !currentQuestion) {
        return <SafeAreaView style={s.safe}><GameLoadingSkeleton /></SafeAreaView>
    }

    const progressPct = ((currentQuestionIndex + 1) / questions.length) * 100

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.container}>
                {/* HUD */}
                <View style={s.hud}>
                    <View>
                        <Text style={s.hudLabel}>AGE GUESS</Text>
                        <Text style={s.hudQ}>{currentQuestionIndex + 1} / {questions.length}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={s.hudLabel}>SCORE</Text>
                        <Text style={s.hudScore}>{score}</Text>
                    </View>
                </View>

                {/* Progress bar */}
                <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${progressPct}%` }]} />
                </View>

                {/* Person */}
                <View style={s.personWrap}>
                    <PersonImage name={currentQuestion.person_name!} imageUrl={currentQuestion.person_image_url} size="xl" />
                    {streak > 2 && (
                        <View style={s.streakBadge}>
                            <Text style={s.streakBadgeText}>{streak} STREAK</Text>
                        </View>
                    )}
                </View>

                <View style={s.nameWrap}>
                    <Text style={s.personName}>{currentQuestion.person_name}</Text>
                    {feedback.type && (
                        <Text style={s.correctAge}>Correct Age: {feedback.correctAge}</Text>
                    )}
                </View>

                {/* Options */}
                <View style={s.options}>
                    <OptionsGrid
                        options={currentQuestion.options?.map((opt: string | number) => ({ id: opt, label: opt.toString() })) || []}
                        onSelect={handleOptionSelect}
                        selectedId={selectedOption}
                        correctId={feedback.correctAge}
                        disabled={isSubmitting || !!feedback.type}
                    />
                </View>

                {/* Footer controls */}
                <View style={s.footer}>
                    <TouchableOpacity style={s.footerBtn} onPress={() => setShowHint(true)} disabled={hasUsedHint}>
                        <Info size={14} color={hasUsedHint ? '#4a4870' : '#8884a8'} />
                        <Text style={[s.footerBtnText, hasUsedHint && { color: '#4a4870' }]}>
                            {hasUsedHint ? 'HINT USED' : 'HINT (-20%)'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.footerBtn} onPress={pauseGame}>
                        <Pause size={14} color="#8884a8" />
                        <Text style={s.footerBtnText}>PAUSE</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {feedback.type && (
                <FeedbackOverlay
                    type={feedback.type}
                    scoreAwarded={feedback.scoreAwarded}
                    correctAnswer={feedback.correctAge!}
                    onComplete={handleNext}
                    isLastQuestion={isLastQuestion}
                    streak={streak}
                />
            )}
            {showHint && !feedback.type && (
                <HintModal
                    hint={currentQuestion.hints?.[0] || 'No hint available.'}
                    onClose={() => setShowHint(false)}
                    onUseHint={() => { useHint(); setHasUsedHint(true) }}
                    isDaily={useGameStore.getState().mode === 'DAILY_CHALLENGE'}
                />
            )}
            {isPaused && <GamePauseModal />}
        </SafeAreaView>
    )
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#1a1a2e' },
    container: { flex: 1, padding: 24, gap: 12 },
    hud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    hudLabel: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', opacity: 0.6 },
    hudQ: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 18 },
    hudScore: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 24 },
    progressTrack: { height: 2, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 1, overflow: 'hidden' },
    progressFill: { height: 2, backgroundColor: '#6c63ff' },
    personWrap: { alignSelf: 'center', position: 'relative' },
    streakBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: '#c9a227', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4 },
    streakBadgeText: { fontFamily: 'Montserrat_400Regular', color: '#1a1a2e', fontSize: 9, letterSpacing: 2, fontWeight: 'bold' },
    nameWrap: { alignItems: 'center', gap: 4 },
    personName: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 26 },
    correctAge: { fontFamily: 'Montserrat_400Regular', color: '#6c63ff', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' },
    options: { flex: 1, justifyContent: 'center' },
    footer: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
    footerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    footerBtnText: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' },
})

import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
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
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { sounds } from '@/lib/sounds'
import { haptics, ImpactStyle } from '@/lib/haptics'

export default function DailyPage() {
    const router = useRouter()
    const { isAuthenticated, authReady } = useAuthStore()
    const { sessionId, questions, currentQuestionIndex, score, streak, isPaused, startGame, nextQuestion, submitAnswer, endGame, pauseGame, useHint } = useGameStore()

    const [isLoading, setIsLoading] = useState(true)
    const [showHint, setShowHint] = useState(false)
    const [hasUsedHint, setHasUsedHint] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [selectedOption, setSelectedOption] = useState<number | null>(null)
    const [feedback, setFeedback] = useState<{ type: 'spot-on' | 'close' | 'wrong' | null; correctAge: number | null; scoreAwarded: number }>({ type: null, correctAge: null, scoreAwarded: 0 })
    const pendingSubmit = useRef<Promise<any> | null>(null)

    const currentQuestion = questions[currentQuestionIndex]
    const isLastQuestion = currentQuestionIndex === questions.length - 1
    const today = new Date().toISOString().split('T')[0]

    useEffect(() => {
        if (!authReady) return
        if (!isAuthenticated) { router.replace('/welcome'); return }
        let cancelled = false
        const init = async () => {
            try {
                const session = await apiClient.startSession({ mode: 'DAILY_CHALLENGE', pack_date: today })
                if (cancelled) return
                startGame(session.id, 'DAILY_CHALLENGE', session.questions)
                setIsLoading(false)
            } catch (e) {
                if (!cancelled) { logger.error('Failed to start daily:', e); router.replace('/') }
            }
        }
        init()
        return () => { cancelled = true }
    }, [isAuthenticated, authReady])

    const handleOptionSelect = (id: string | number) => {
        if (isSubmitting || feedback.type) return
        const val = Number(id)
        setSelectedOption(val)
        handleSubmit(val)
    }

    const handleSubmit = async (guess: number) => {
        if (isNaN(guess) || !currentQuestion || isSubmitting || feedback.type) return
        setIsSubmitting(true)
        const responseTimeMs = Date.now() - (useGameStore.getState().questionStartTime || Date.now())
        const correctAge = currentQuestion.correct_answer?.age as number
        const diff = Math.abs(guess - correctAge)
        let type: 'spot-on' | 'close' | 'wrong' = diff === 0 ? 'spot-on' : diff === 1 ? 'close' : 'wrong'
        if (type !== 'wrong') { sounds.play('correct'); haptics.impact(type === 'spot-on' ? ImpactStyle.Heavy : ImpactStyle.Medium) }
        else { sounds.play('wrong'); haptics.impact(ImpactStyle.Light) }
        setFeedback({ type, correctAge, scoreAwarded: 0 })
        setIsSubmitting(false)
        const p = apiClient.submitAnswer(sessionId!, {
            question_template_id: currentQuestion.id, question_index: currentQuestionIndex,
            user_answer: { age: guess }, response_time_ms: responseTimeMs, hints_used: hasUsedHint ? 1 : 0,
        }).then(r => { if (r) { submitAnswer(r.is_correct, r.score_awarded); setFeedback(prev => prev.type ? { ...prev, scoreAwarded: r.score_awarded } : prev) } })
        pendingSubmit.current = p
    }

    const handleNext = () => {
        if (isLastQuestion) { handleEnd(); return }
        setFeedback({ type: null, correctAge: null, scoreAwarded: 0 })
        setSelectedOption(null); setShowHint(false); setHasUsedHint(false)
        nextQuestion()
    }

    const handleEnd = async () => {
        try {
            setIsLoading(true)
            if (pendingSubmit.current) await pendingSubmit.current
            const result = await apiClient.endSession(sessionId!)
            endGame(result); router.replace('/game/results')
        } catch { router.replace('/game/results') }
    }

    if (isLoading || !currentQuestion) return <SafeAreaView style={s.safe}><GameLoadingSkeleton /></SafeAreaView>

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.container}>
                <View style={s.hud}>
                    <View>
                        <Text style={s.hudLabel}>DAILY CHALLENGE</Text>
                        <Text style={s.hudQ}>{currentQuestionIndex + 1} / {questions.length}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={s.hudLabel}>SCORE</Text>
                        <Text style={s.hudScore}>{score}</Text>
                    </View>
                </View>
                <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }]} />
                </View>
                <View style={s.personWrap}>
                    <PersonImage name={currentQuestion.person_name!} imageUrl={currentQuestion.person_image_url} size="xl" />
                </View>
                <View style={s.nameWrap}>
                    <Text style={s.personName}>{currentQuestion.person_name}</Text>
                    {feedback.type && <Text style={s.correctAge}>Correct Age: {feedback.correctAge}</Text>}
                </View>
                <View style={s.options}>
                    <OptionsGrid
                        options={currentQuestion.options?.map((o: any) => ({ id: o, label: String(o) })) || []}
                        onSelect={handleOptionSelect}
                        selectedId={selectedOption}
                        correctId={feedback.correctAge}
                        disabled={isSubmitting || !!feedback.type}
                    />
                </View>
                <View style={s.footer}>
                    <TouchableOpacity style={s.footerBtn} onPress={() => setShowHint(true)} disabled={hasUsedHint}>
                        <Info size={14} color={hasUsedHint ? '#4a4870' : '#8884a8'} />
                        <Text style={s.footerBtnText}>{hasUsedHint ? 'HINT USED' : 'HINT (-30%)'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.footerBtn} onPress={pauseGame}>
                        <Pause size={14} color="#8884a8" />
                        <Text style={s.footerBtnText}>PAUSE</Text>
                    </TouchableOpacity>
                </View>
            </View>
            {feedback.type && <FeedbackOverlay type={feedback.type} scoreAwarded={feedback.scoreAwarded} correctAnswer={feedback.correctAge!} onComplete={handleNext} isLastQuestion={isLastQuestion} streak={streak} />}
            {showHint && !feedback.type && <HintModal hint={currentQuestion.hints?.[0] || 'No hint available.'} onClose={() => setShowHint(false)} onUseHint={() => { useHint(); setHasUsedHint(true) }} isDaily />}
            {isPaused && <GamePauseModal />}
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
    progressFill: { height: 2, backgroundColor: '#c9a227' },
    personWrap: { alignSelf: 'center' },
    nameWrap: { alignItems: 'center', gap: 4 },
    personName: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 26 },
    correctAge: { fontFamily: 'Montserrat_400Regular', color: '#6c63ff', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' },
    options: { flex: 1, justifyContent: 'center' },
    footer: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
    footerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    footerBtnText: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' },
})

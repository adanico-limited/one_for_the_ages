import { useState, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { PersonImage } from '@/components/ui/PersonImage'
import { GameLoadingSkeleton } from '@/components/ui/SkeletonLoader'
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

export default function ReversePage() {
    const router = useRouter()
    const { isAuthenticated, authReady } = useAuthStore()
    const { selected: selectedCategories } = useCategoryStore()
    const { mode: diffMode, level: diffLevel } = useDifficultyStore()
    const { sessionId, questions, currentQuestionIndex, score, streak, startGame, nextQuestion, submitAnswer, endGame } = useGameStore()

    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [selectedOption, setSelectedOption] = useState<string | null>(null)
    const [feedback, setFeedback] = useState<{ type: 'spot-on' | 'wrong'; scoreAwarded: number; correctAnswer: string } | null>(null)
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
                const session = await apiClient.startSession({ mode: 'REVERSE_SIGN', categories, difficulty })
                if (cancelled) return
                startGame(session.id, 'REVERSE_SIGN', session.questions)
                setIsLoading(false)
            } catch (e) {
                if (!cancelled) { logger.error('Failed to start:', e); router.replace('/') }
            }
        }
        init()
        return () => { cancelled = true }
    }, [isAuthenticated, authReady])

    const handleSelect = async (id: string | number) => {
        if (isSubmitting || feedback || !currentQuestion) return
        const choice = String(id)
        setIsSubmitting(true)
        setSelectedOption(choice)

        const responseTimeMs = Date.now() - (useGameStore.getState().questionStartTime || Date.now())
        const p = apiClient.submitAnswer(sessionId!, {
            question_template_id: currentQuestion.id, question_index: currentQuestionIndex,
            user_answer: { sign: choice }, response_time_ms: responseTimeMs, hints_used: 0,
        }).then(r => {
            const isCorrect = r?.is_correct ?? false
            const scoreAwarded = r?.score_awarded ?? 0
            const correctAnswer = String(currentQuestion.correct_answer?.sign || currentQuestion.correct_answer || '')
            if (isCorrect) { sounds.play('correct'); haptics.impact(ImpactStyle.Heavy) }
            else { sounds.play('wrong'); haptics.impact(ImpactStyle.Light) }
            submitAnswer(isCorrect, scoreAwarded)
            setFeedback({ type: isCorrect ? 'spot-on' : 'wrong', scoreAwarded, correctAnswer })
        }).catch(e => logger.error('Submit failed:', e))

        pendingSubmit.current = p
        setIsSubmitting(false)
    }

    const handleNext = () => {
        if (isLastQuestion) { handleEnd(); return }
        setFeedback(null); setSelectedOption(null); nextQuestion()
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
                        <Text style={s.hudLabel}>ZODIAC</Text>
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
                    <Text style={s.question}>What's their Zodiac sign?</Text>
                    {feedback && <Text style={s.correctAnswer}>Correct: {feedback.correctAnswer}</Text>}
                </View>
                <View style={s.options}>
                    <OptionsGrid
                        options={currentQuestion.options?.map((o: any) => ({ id: String(o), label: String(o) })) || []}
                        onSelect={handleSelect}
                        selectedId={selectedOption}
                        correctId={feedback ? String(currentQuestion.correct_answer?.sign || currentQuestion.correct_answer) : null}
                        disabled={isSubmitting || !!feedback}
                    />
                </View>
            </View>
            {feedback && <FeedbackOverlay type={feedback.type} scoreAwarded={feedback.scoreAwarded} correctAnswer={feedback.correctAnswer} onComplete={handleNext} isLastQuestion={isLastQuestion} streak={streak} />}
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
    personWrap: { alignSelf: 'center' },
    nameWrap: { alignItems: 'center', gap: 6 },
    personName: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 24 },
    question: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 13 },
    correctAnswer: { fontFamily: 'Montserrat_400Regular', color: '#6c63ff', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' },
    options: { flex: 1, justifyContent: 'center' },
})

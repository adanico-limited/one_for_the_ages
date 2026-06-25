import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native'
import { Flame } from 'lucide-react-native'

interface FeedbackOverlayProps {
    type: 'spot-on' | 'close' | 'wrong'
    scoreAwarded: number
    correctAnswer: string | number
    onComplete: () => void
    isLastQuestion?: boolean
    streak?: number
}

function getStreakMilestone(streak: number): string | null {
    if (streak >= 10) return 'ON FIRE! 10 IN A ROW!'
    if (streak >= 5) return 'UNSTOPPABLE! 5 STREAK!'
    if (streak >= 3) return 'HAT TRICK! 3 STREAK!'
    return null
}

export function FeedbackOverlay({ type, scoreAwarded, correctAnswer, onComplete, isLastQuestion, streak = 0 }: FeedbackOverlayProps) {
    const streakMilestone = streak > 0 ? getStreakMilestone(streak) : null

    const colors = {
        'spot-on': { text: '#c9a227', border: 'rgba(201,162,39,0.4)', btn: '#c9a227', btnText: '#000' },
        'close': { text: '#6c63ff', border: 'rgba(108,99,255,0.4)', btn: '#6c63ff', btnText: '#fff' },
        'wrong': { text: '#f87171', border: 'rgba(248,113,113,0.4)', btn: '#ef4444', btnText: '#fff' },
    }[type]

    const title = type === 'spot-on' ? 'SPOT ON' : type === 'close' ? 'So Close' : 'Wrong'

    return (
        <Modal transparent animationType="fade" visible>
            <View style={s.backdrop}>
                <View style={[s.card, { borderColor: colors.border }]}>
                    {streakMilestone && (
                        <View style={s.milestoneRow}>
                            <Flame size={14} color="#c9a227" />
                            <Text style={s.milestoneText}>{streakMilestone}</Text>
                            <Flame size={14} color="#c9a227" />
                        </View>
                    )}

                    <View style={s.center}>
                        <Text style={[s.title, { color: colors.text }]}>{title}</Text>
                        <Text style={[s.score, { color: colors.text }]}>+{scoreAwarded}</Text>
                    </View>

                    {streak > 0 && (
                        <View style={s.streakRow}>
                            <Flame size={13} color="#fb923c" />
                            <Text style={s.streakText}>{streak} STREAK</Text>
                        </View>
                    )}

                    <View style={s.line} />

                    <View style={s.answerWrap}>
                        {type === 'wrong' && (
                            <Text style={s.answerLabel}>CORRECT ANSWER</Text>
                        )}
                        <Text style={s.answerText}>
                            {type === 'spot-on' ? correctAnswer : `Correct: ${correctAnswer}`}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[s.nextBtn, { backgroundColor: colors.btn }]}
                        onPress={onComplete}
                    >
                        <Text style={[s.nextBtnText, { color: colors.btnText }]}>
                            {isLastQuestion ? 'SEE RESULTS' : 'NEXT'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    )
}

const s = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end', paddingBottom: 40, paddingHorizontal: 16 },
    card: { backgroundColor: '#252847', borderWidth: 1, borderRadius: 4, padding: 24, gap: 16 },
    milestoneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(201,162,39,0.1)', borderWidth: 1, borderColor: 'rgba(201,162,39,0.3)', borderRadius: 4, paddingVertical: 8 },
    milestoneText: { fontFamily: 'Montserrat_400Regular', color: '#c9a227', fontSize: 11, letterSpacing: 3 },
    center: { alignItems: 'center', gap: 8 },
    title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 42 },
    score: { fontFamily: 'Montserrat_400Regular', fontSize: 22, letterSpacing: 4, fontWeight: 'bold' },
    streakRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    streakText: { fontFamily: 'Montserrat_400Regular', color: '#fb923c', fontSize: 11, letterSpacing: 3 },
    line: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 4 },
    answerWrap: { alignItems: 'center', gap: 4 },
    answerLabel: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 10, letterSpacing: 3 },
    answerText: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 22 },
    nextBtn: { borderRadius: 4, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
    nextBtnText: { fontFamily: 'Montserrat_400Regular', fontSize: 12, letterSpacing: 4, fontWeight: 'bold' },
})

import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { Play, Home, Flame } from 'lucide-react-native'
import { useGameStore } from '@/store/useGameStore'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'

export function GamePauseModal() {
    const router = useRouter()
    const { sessionId, score, streak, currentQuestionIndex, questions, resumeGame, resetGame, mode } = useGameStore()
    const [isQuitting, setIsQuitting] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const isDaily = mode === 'DAILY_CHALLENGE'

    const handleQuit = async () => {
        if (!isQuitting) { setIsQuitting(true); return }
        setIsLoading(true)
        try {
            if (sessionId) await apiClient.endSession(sessionId)
            resetGame()
            router.replace('/')
        } catch (error) {
            logger.error('Failed to quit:', error)
            router.replace('/')
        }
    }

    return (
        <Modal transparent animationType="fade" visible>
            <View style={s.backdrop}>
                <View style={s.card}>
                    <View style={s.topBorder} />

                    <Text style={s.title}>{isQuitting ? 'QUIT GAME?' : 'GAME PAUSED'}</Text>

                    {!isQuitting ? (
                        <View style={s.info}>
                            <Text style={s.qText}>Question {currentQuestionIndex + 1} of {questions.length}</Text>
                            <View style={s.statsRow}>
                                <View style={s.stat}>
                                    <Text style={s.statLabel}>SCORE</Text>
                                    <Text style={s.statVal}>{score}</Text>
                                </View>
                                {streak > 0 && (
                                    <>
                                        <View style={s.divider} />
                                        <View style={s.stat}>
                                            <Text style={s.statLabel}>STREAK</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <Flame size={14} color="#fb923c" />
                                                <Text style={[s.statVal, { color: '#fb923c' }]}>{streak}</Text>
                                            </View>
                                        </View>
                                    </>
                                )}
                            </View>
                        </View>
                    ) : (
                        <Text style={s.quitText}>
                            Your progress will be saved, but this session cannot be resumed.
                            {isDaily && '\n\nDaily Challenge cannot be restarted.'}
                        </Text>
                    )}

                    <View style={s.btnGroup}>
                        {!isQuitting ? (
                            <>
                                <TouchableOpacity style={s.primaryBtn} onPress={resumeGame}>
                                    <Play size={16} color="#fff" />
                                    <Text style={s.primaryBtnText}>RESUME GAME</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={s.quitBtn} onPress={() => setIsQuitting(true)}>
                                    <Home size={16} color="#f87171" />
                                    <Text style={s.quitBtnText}>QUIT TO HOME</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <TouchableOpacity style={s.confirmQuitBtn} onPress={handleQuit} disabled={isLoading}>
                                    {isLoading ? <ActivityIndicator color="#f87171" /> : <Text style={s.quitBtnText}>CONFIRM QUIT</Text>}
                                </TouchableOpacity>
                                <TouchableOpacity style={s.primaryBtn} onPress={() => setIsQuitting(false)} disabled={isLoading}>
                                    <Text style={s.primaryBtnText}>CANCEL</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    )
}

const s = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
    card: { backgroundColor: '#252847', borderWidth: 1, borderColor: 'rgba(108,99,255,0.2)', borderRadius: 4, padding: 24, gap: 20, overflow: 'hidden' },
    topBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(108,99,255,0.5)' },
    title: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 22, textAlign: 'center' },
    info: { alignItems: 'center', gap: 12 },
    qText: { fontFamily: 'Montserrat_400Regular', color: 'rgba(108,99,255,0.8)', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' },
    statsRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
    stat: { alignItems: 'center', gap: 4 },
    statLabel: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 10, letterSpacing: 3 },
    statVal: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 20 },
    divider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.1)' },
    quitText: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 13, textAlign: 'center', lineHeight: 20 },
    btnGroup: { gap: 10 },
    primaryBtn: { backgroundColor: '#6c63ff', borderRadius: 4, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    primaryBtnText: { fontFamily: 'Montserrat_400Regular', color: '#fff', fontSize: 12, letterSpacing: 3 },
    quitBtn: { paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 4 },
    quitBtnText: { fontFamily: 'Montserrat_400Regular', color: '#f87171', fontSize: 12, letterSpacing: 3 },
    confirmQuitBtn: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: 4, paddingVertical: 16, alignItems: 'center' },
})

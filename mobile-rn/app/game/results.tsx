import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Share } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Target, BarChart3, Calendar, Medal, RotateCcw, Home, Share2, ChevronsUp } from 'lucide-react-native'
import { useGameStore } from '@/store/useGameStore'
import { AchievementToast } from '@/components/ui/AchievementToast'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { calculateLevel } from '@/lib/xp'

export default function ResultsPage() {
    const router = useRouter()
    const { lastGameResult, score: currentScore, mode, resetGame } = useGameStore()
    const [animatedScore, setAnimatedScore] = useState(0)
    const [achievementIndex, setAchievementIndex] = useState(0)

    const newAchievements = lastGameResult?.newAchievements || []
    const currentAchievement = newAchievements[achievementIndex]

    const result = lastGameResult || {
        totalScore: currentScore, questionsCount: 10, correctCount: 0,
        bestStreak: 0, accuracy: 0, lifetimeScore: currentScore,
    }

    const finalScore = result.lifetimeScore || result.totalScore
    const deltaScore = result.totalScore
    const startingScore = Math.max(0, finalScore - deltaScore)
    const startLevel = calculateLevel(startingScore)
    const endLevel = calculateLevel(finalScore)
    const leveledUp = endLevel.level > startLevel.level

    useEffect(() => {
        const duration = 1500
        const start = Date.now()
        const tick = () => {
            const progress = Math.min((Date.now() - start) / duration, 1)
            const ease = 1 - Math.pow(1 - progress, 3)
            setAnimatedScore(Math.floor(startingScore + (finalScore - startingScore) * ease))
            if (progress < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
    }, [])

    useEffect(() => {
        if (!currentAchievement) return
        const t = setTimeout(() => setAchievementIndex(i => i + 1), 3500)
        return () => clearTimeout(t)
    }, [achievementIndex, currentAchievement])

    const handleShare = async () => {
        try {
            await Share.share({
                message: `I just scored ${deltaScore} points in ${mode || 'Challenge'} Mode! Total XP: ${finalScore}. Can you beat me?`,
            })
        } catch {}
    }

    const handleHome = () => { resetGame(); router.replace('/') }

    const handlePlayAgain = () => {
        resetGame()
        const routes: Record<string, string> = {
            AGE_GUESS: '/game/age-guess', WHO_OLDER: '/game/whos-older',
            REVERSE_SIGN: '/game/reverse', DAILY_CHALLENGE: '/game/daily',
        }
        router.replace((routes[mode || ''] || '/') as any)
    }

    return (
        <SafeAreaView style={s.safe}>
            <AchievementToast
                title={currentAchievement?.title || ''}
                description={currentAchievement?.description || ''}
                isVisible={!!currentAchievement}
                onDismiss={() => setAchievementIndex(i => i + 1)}
            />
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

                {/* Header */}
                <View style={s.header}>
                    <Text style={s.headerTitle}>CHALLENGE COMPLETE</Text>
                    <View style={s.headerLine} />
                </View>

                {/* Animated Score */}
                <View style={s.scoreBlock}>
                    <Text style={s.scoreBig}>{animatedScore}</Text>
                    {deltaScore > 0 && <Text style={s.scoreDelta}>+{deltaScore} this round</Text>}
                    <View style={s.levelBlock}>
                        <Text style={s.levelLabel}>Level {endLevel.level} · {endLevel.title}</Text>
                        <ProgressBar value={endLevel.currentXP} max={endLevel.xpForNextLevel} color="#6c63ff" />
                        <Text style={s.xpText}>{endLevel.currentXP} / {endLevel.xpForNextLevel} XP</Text>
                    </View>
                </View>

                {/* Badge */}
                {leveledUp && (
                    <View style={s.badge}>
                        <ChevronsUp size={18} color="#6c63ff" />
                        <Text style={s.badgeText}>Level Up — Level {endLevel.level} · {endLevel.title}</Text>
                    </View>
                )}
                {!leveledUp && result.correctCount === result.questionsCount && result.questionsCount > 0 && (
                    <View style={[s.badge, { borderColor: 'rgba(168,85,247,0.3)', backgroundColor: 'rgba(168,85,247,0.1)' }]}>
                        <Target size={18} color="#c084fc" />
                        <Text style={[s.badgeText, { color: '#c084fc' }]}>Perfect Round</Text>
                    </View>
                )}

                {/* Stats */}
                <View style={s.statsBlock}>
                    <StatRow icon={<Target size={18} color="#8884a8" />} label="Accuracy" value={`${Math.round(result.accuracy)}%`} />
                    <StatRow icon={<BarChart3 size={18} color="#8884a8" />} label="Correct" value={`${result.correctCount} / ${result.questionsCount}`} />
                    <StatRow icon={<Calendar size={18} color="#8884a8" />} label="Streak" value={`${result.bestStreak} 🔥`} />
                    {!!result.globalRank && result.globalRank > 0 && (
                        <StatRow icon={<Medal size={18} color="#6c63ff" />} label="Global Rank" value={`#${result.globalRank}`} highlight />
                    )}
                </View>

                {/* Actions */}
                <View style={s.actions}>
                    <TouchableOpacity style={s.primaryBtn} onPress={handlePlayAgain}>
                        <RotateCcw size={18} color="#fff" />
                        <Text style={s.primaryBtnText}>PLAY AGAIN</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.secondaryBtn} onPress={handleShare}>
                        <Share2 size={18} color="#8884a8" />
                        <Text style={s.secondaryBtnText}>SHARE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.secondaryBtn} onPress={handleHome}>
                        <Home size={18} color="#8884a8" />
                        <Text style={s.secondaryBtnText}>BACK TO HOME</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

const StatRow = ({ icon, label, value, highlight = false }: { icon: any, label: string, value: string, highlight?: boolean }) => (
    <View style={[sr.row, highlight && sr.highlightRow]}>
        <View style={sr.iconLabel}>
            {icon}
            <Text style={[sr.label, highlight && { color: '#6c63ff' }]}>{label}</Text>
        </View>
        <Text style={[sr.value, highlight && { color: '#6c63ff' }]}>{value}</Text>
    </View>
)

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#1a1a2e' },
    scroll: { padding: 24, alignItems: 'center', gap: 24 },
    header: { alignItems: 'center', gap: 8 },
    headerTitle: { fontFamily: 'Montserrat_400Regular', color: '#f0eefc', fontSize: 13, letterSpacing: 4, fontWeight: 'bold' },
    headerLine: { width: 64, height: 2, backgroundColor: 'rgba(108,99,255,0.5)', borderRadius: 1 },
    scoreBlock: { alignItems: 'center', gap: 8 },
    scoreBig: { fontFamily: 'PlayfairDisplay_700Bold', color: '#6c63ff', fontSize: 64, letterSpacing: -2 },
    scoreDelta: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 13, fontWeight: 'bold' },
    levelBlock: { alignItems: 'center', gap: 4, width: 180 },
    levelLabel: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' },
    xpText: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 10, fontVariant: ['tabular-nums'] },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)', backgroundColor: 'rgba(108,99,255,0.1)', borderRadius: 99 },
    badgeText: { fontFamily: 'Montserrat_400Regular', color: '#6c63ff', fontSize: 13, fontWeight: 'bold', letterSpacing: 1 },
    statsBlock: { width: '100%', gap: 6 },
    actions: { width: '100%', gap: 12 },
    primaryBtn: { backgroundColor: '#6c63ff', borderRadius: 4, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    primaryBtnText: { fontFamily: 'Montserrat_400Regular', color: '#fff', fontSize: 13, letterSpacing: 3, fontWeight: 'bold' },
    secondaryBtn: { backgroundColor: '#1e2040', borderWidth: 1, borderColor: '#2e2c4e', borderRadius: 4, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    secondaryBtnText: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 13, letterSpacing: 3, fontWeight: 'bold' },
})

const sr = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#1e2040', borderRadius: 4, borderWidth: 1, borderColor: '#2e2c4e' },
    highlightRow: { borderColor: 'rgba(108,99,255,0.3)' },
    iconLabel: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    label: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 13, textTransform: 'uppercase', letterSpacing: 2 },
    value: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 18 },
})

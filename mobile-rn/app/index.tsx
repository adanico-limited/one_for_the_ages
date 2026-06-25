import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Hourglass, Scale, Star, ArrowRight, SlidersHorizontal, Check } from 'lucide-react-native'
import { useAuthStore } from '@/store/useAuthStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useDifficultyStore, getDifficultyParam } from '@/store/useDifficultyStore'
import { apiClient } from '@/lib/api-client'
import { calculateLevel } from '@/lib/xp'
import { logger } from '@/lib/logger'
import { getCategoryLabel } from '@/lib/categories'
import { BottomNav } from '@/components/ui/BottomNav'

interface UserStats {
    lifetime_score: number
    best_streak: number
    games_played: number
    accuracy_pct: number
    current_streak: number
    last_daily_date?: string | null
}

export default function Home() {
    const { user: authUser, oftaUser, isAuthenticated, authReady, setUser, setOftaUser } = useAuthStore()
    const { selected: selectedCategories } = useCategoryStore()
    const { mode: diffMode, level: diffLevel } = useDifficultyStore()
    const diffIsCustom = diffMode === 'escalating' || diffLevel !== 'easy'
    const diffLabel = diffMode === 'escalating' ? 'Escalating' : diffLevel.charAt(0).toUpperCase() + diffLevel.slice(1)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [timeLeft, setTimeLeft] = useState('')
    const [stats, setStats] = useState<UserStats | null>(null)
    const [statsLoading, setStatsLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        if (authReady) {
            if (isAuthenticated) {
                apiClient.getUserStats()
                    .then(setStats)
                    .catch((err) => logger.warn('Failed to load stats:', err))
                    .finally(() => setStatsLoading(false))
            } else {
                setStatsLoading(false)
            }
        }
    }, [isAuthenticated, authReady])

    const getGreeting = () => {
        const hour = currentTime.getHours()
        if (hour < 12) return 'Good Morning'
        if (hour < 18) return 'Good Afternoon'
        return 'Good Evening'
    }

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date()
            setCurrentTime(now)
            const tomorrow = new Date(now)
            tomorrow.setDate(tomorrow.getDate() + 1)
            tomorrow.setHours(0, 0, 0, 0)
            const diff = tomorrow.getTime() - now.getTime()
            const hours = Math.floor(diff / (1000 * 60 * 60))
            const minutes = Math.floor((diff / (1000 * 60)) % 60)
            const seconds = Math.floor((diff / 1000) % 60)
            setTimeLeft(
                `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
            )
        }, 1000)
        return () => clearInterval(timer)
    }, [])

    const dailyDone = !!stats?.last_daily_date
        && stats.last_daily_date === new Date().toISOString().split('T')[0]

    const levelInfo = calculateLevel(stats?.lifetime_score || 0)
    const user = {
        name: oftaUser?.display_name || authUser?.displayName || oftaUser?.email?.split('@')[0] || 'Challenger',
        level: levelInfo.level,
        streak: stats?.current_streak || 0,
        accuracy: stats ? Math.round(stats.accuracy_pct) : 0,
        bestScore: stats?.lifetime_score || 0,
    }

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

                {/* Header */}
                <View style={s.headerRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.greeting}>{getGreeting()}, {user.name}</Text>
                        {statsLoading ? (
                            <View style={s.skeletonLine} />
                        ) : (
                            <View style={s.subRow}>
                                <Text style={s.level}>Level {user.level}</Text>
                                <Text style={s.dot}>•</Text>
                                <Text style={s.streak}>{user.streak} Day Streak 🔥</Text>
                            </View>
                        )}
                    </View>
                    {!isAuthenticated && (
                        <Link href="/welcome" asChild>
                            <TouchableOpacity style={s.signInBtn}>
                                <Text style={s.signInText}>SIGN IN</Text>
                            </TouchableOpacity>
                        </Link>
                    )}
                </View>

                {/* Daily Challenge */}
                <View style={s.dailyCard}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.dailyLabel}>DAILY CHALLENGE</Text>
                        <Text style={s.dailyTitle}>{dailyDone ? 'Completed for today.' : 'One pack. One shot.'}</Text>
                        {dailyDone ? (
                            <View style={s.doneRow}>
                                <Check size={10} color="#4ade80" />
                                <Text style={s.doneText}>Next challenge in {timeLeft}</Text>
                            </View>
                        ) : (
                            <Text style={s.timeLeft}>Resets in {timeLeft}</Text>
                        )}
                    </View>
                    <Link href="/game/daily" asChild>
                        <TouchableOpacity style={dailyDone ? s.replayBtn : s.playBtn}>
                            <Text style={dailyDone ? s.replayBtnText : s.playBtnText}>
                                {dailyDone ? 'REPLAY' : 'PLAY'}
                            </Text>
                            <ArrowRight size={12} color={dailyDone ? '#8884a8' : '#fff'} />
                        </TouchableOpacity>
                    </Link>
                </View>

                {/* Game Modes header */}
                <View style={s.sectionHeader}>
                    <Text style={s.sectionLabel}>GAME MODES</Text>
                    <View style={s.filterRow}>
                        <Link href="/categories" asChild>
                            <TouchableOpacity style={[s.filterBtn, selectedCategories.length > 0 && s.filterActive]}>
                                <SlidersHorizontal size={10} color={selectedCategories.length > 0 ? '#6c63ff' : '#8884a8'} />
                                <Text style={[s.filterText, selectedCategories.length > 0 && s.filterTextActive]}>
                                    {selectedCategories.length > 0 ? getCategoryLabel(selectedCategories) : 'Categories'}
                                </Text>
                            </TouchableOpacity>
                        </Link>
                        <Link href="/difficulty" asChild>
                            <TouchableOpacity style={[s.filterBtn, diffIsCustom && s.filterActive]}>
                                <Text style={[s.filterText, diffIsCustom && s.filterTextActive]}>
                                    {diffIsCustom ? diffLabel : 'Difficulty'}
                                </Text>
                            </TouchableOpacity>
                        </Link>
                    </View>
                </View>

                {/* Game Mode Cards */}
                <View style={s.modeList}>
                    <Link href="/game/age-guess" asChild>
                        <TouchableOpacity style={s.modeCard}>
                            <Hourglass size={20} color="#6c63ff" />
                            <View style={{ flex: 1 }}>
                                <Text style={s.modeName}>Guess the Age</Text>
                                <Text style={s.modeTag}>PRECISION</Text>
                            </View>
                            <ArrowRight size={14} color="#4a4870" />
                        </TouchableOpacity>
                    </Link>
                    <Link href="/game/whos-older" asChild>
                        <TouchableOpacity style={s.modeCard}>
                            <Scale size={20} color="#6c63ff" />
                            <View style={{ flex: 1 }}>
                                <Text style={s.modeName}>Who's Older?</Text>
                                <Text style={s.modeTag}>VERSUS</Text>
                            </View>
                            <ArrowRight size={14} color="#4a4870" />
                        </TouchableOpacity>
                    </Link>
                    <Link href="/game/reverse" asChild>
                        <TouchableOpacity style={s.modeCard}>
                            <Star size={20} color="#6c63ff" />
                            <View style={{ flex: 1 }}>
                                <Text style={s.modeName}>Zodiac</Text>
                                <Text style={s.modeTag}>ASTROLOGY</Text>
                            </View>
                            <ArrowRight size={14} color="#4a4870" />
                        </TouchableOpacity>
                    </Link>
                </View>

                {/* Quick Stats */}
                <View style={s.statsRow}>
                    {statsLoading ? (
                        <ActivityIndicator color="#6c63ff" />
                    ) : (
                        <>
                            <View style={s.stat}>
                                <Text style={s.statLabel}>ACCURACY</Text>
                                <Text style={s.statValue}>{user.accuracy}%</Text>
                            </View>
                            <View style={s.divider} />
                            <View style={s.stat}>
                                <Text style={s.statLabel}>BEST SCORE</Text>
                                <Text style={s.statValue}>{user.bestScore}</Text>
                            </View>
                            <View style={s.divider} />
                            <View style={s.stat}>
                                <Text style={s.statLabel}>STREAK</Text>
                                <Text style={[s.statValue, { color: '#c9a227' }]}>{user.streak}</Text>
                            </View>
                        </>
                    )}
                </View>

                {/* Bottom padding for nav */}
                <View style={{ height: 80 }} />
            </ScrollView>
            <BottomNav />
        </SafeAreaView>
    )
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#1a1a2e' },
    scroll: { padding: 20, paddingTop: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
    greeting: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 18, marginBottom: 4 },
    subRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    level: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
    dot: { color: '#2e2c4e', fontSize: 10 },
    streak: { fontFamily: 'Montserrat_400Regular', color: '#c9a227', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase' },
    skeletonLine: { height: 10, width: 128, backgroundColor: '#252847', borderRadius: 4 },
    signInBtn: { borderWidth: 1, borderColor: 'rgba(108,99,255,0.4)', borderRadius: 4, paddingHorizontal: 12, paddingVertical: 6 },
    signInText: { fontFamily: 'Montserrat_400Regular', color: '#6c63ff', fontSize: 10, letterSpacing: 3 },
    dailyCard: {
        backgroundColor: '#252847', borderWidth: 1, borderColor: 'rgba(201,162,39,0.3)',
        borderRadius: 4, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20,
    },
    dailyLabel: { fontFamily: 'Montserrat_400Regular', color: '#c9a227', fontSize: 9, letterSpacing: 5, textTransform: 'uppercase', marginBottom: 4 },
    dailyTitle: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 14, marginBottom: 4 },
    doneRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    doneText: { fontFamily: 'Montserrat_400Regular', color: '#4ade80', fontSize: 9, letterSpacing: 2 },
    timeLeft: { fontFamily: 'Montserrat_400Regular', color: 'rgba(201,162,39,0.7)', fontSize: 9, letterSpacing: 2 },
    playBtn: { backgroundColor: '#6c63ff', borderRadius: 4, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
    playBtnText: { fontFamily: 'Montserrat_400Regular', color: '#fff', fontSize: 10, letterSpacing: 2 },
    replayBtn: { backgroundColor: '#1e2040', borderWidth: 1, borderColor: '#2e2c4e', borderRadius: 4, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
    replayBtnText: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 10, letterSpacing: 2 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    sectionLabel: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 9, letterSpacing: 5 },
    filterRow: { flexDirection: 'row', gap: 6 },
    filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#2e2c4e', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 5 },
    filterActive: { borderColor: '#6c63ff', backgroundColor: 'rgba(108,99,255,0.1)' },
    filterText: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 9, letterSpacing: 2 },
    filterTextActive: { color: '#6c63ff' },
    modeList: { gap: 8, marginBottom: 16 },
    modeCard: {
        backgroundColor: '#252847', borderWidth: 1, borderColor: 'rgba(201,162,39,0.1)',
        borderRadius: 4, paddingHorizontal: 20, paddingVertical: 16,
        flexDirection: 'row', alignItems: 'center', gap: 16,
    },
    modeName: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 14, marginBottom: 2 },
    modeTag: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 9, letterSpacing: 3 },
    statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderTopWidth: 1, borderTopColor: '#2e2c4e', paddingTop: 16 },
    stat: { alignItems: 'center', gap: 4 },
    statLabel: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 9, letterSpacing: 3 },
    statValue: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 16 },
    divider: { width: 1, height: 28, backgroundColor: '#2e2c4e' },
})

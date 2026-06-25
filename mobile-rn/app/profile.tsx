import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, Link } from 'expo-router'
import { ArrowLeft, LogOut, Settings } from 'lucide-react-native'
import { useAuthStore } from '@/store/useAuthStore'
import { apiClient } from '@/lib/api-client'
import { calculateLevel } from '@/lib/xp'
import { logger } from '@/lib/logger'
import { signOut } from '@/lib/firebase'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { BottomNav } from '@/components/ui/BottomNav'

interface UserStats {
    lifetime_score: number
    best_streak: number
    current_streak: number
    games_played: number
    total_correct: number
    total_questions: number
    accuracy_pct: number
    favourite_category: string | null
    daily_challenges: number
}

export default function ProfilePage() {
    const router = useRouter()
    const { isAuthenticated, authReady, oftaUser, logout } = useAuthStore()
    const [stats, setStats] = useState<UserStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!authReady) return
        if (!isAuthenticated) { router.replace('/welcome'); return }
        apiClient.getUserStats()
            .then(setStats)
            .catch(err => logger.error('Failed to load stats:', err))
            .finally(() => setIsLoading(false))
    }, [isAuthenticated, authReady])

    const handleLogout = async () => {
        try {
            await signOut()
            logout()
            router.replace('/')
        } catch (error) {
            logger.error('Logout failed:', error)
        }
    }

    const levelInfo = calculateLevel(stats?.lifetime_score || 0)

    return (
        <SafeAreaView style={s.safe}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.replace('/')}>
                    <ArrowLeft size={18} color="#8884a8" />
                </TouchableOpacity>
                <Text style={s.title}>Profile</Text>
                <Link href="/settings" asChild>
                    <TouchableOpacity>
                        <Settings size={18} color="#8884a8" />
                    </TouchableOpacity>
                </Link>
            </View>

            <ScrollView contentContainerStyle={s.scroll}>
                {/* Identity */}
                <View style={s.identityCard}>
                    <View style={s.avatar}>
                        <Text style={s.avatarText}>{(oftaUser?.display_name || 'C').charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.displayName}>{oftaUser?.display_name || 'Challenger'}</Text>
                        <Text style={s.email}>{oftaUser?.email || ''}</Text>
                    </View>
                </View>

                {/* Level */}
                <View style={s.levelCard}>
                    <View style={s.levelHeader}>
                        <Text style={s.levelLabel}>LEVEL {levelInfo.level}</Text>
                        <Text style={s.levelTitle}>{levelInfo.title}</Text>
                    </View>
                    <ProgressBar value={levelInfo.currentXP} max={levelInfo.xpForNextLevel} color="#6c63ff" height={6} />
                    <Text style={s.xpText}>{levelInfo.currentXP} / {levelInfo.xpForNextLevel} XP to next level</Text>
                </View>

                {/* Stats */}
                {isLoading ? (
                    <View style={s.centered}><ActivityIndicator color="#6c63ff" /></View>
                ) : stats && (
                    <View style={s.statsGrid}>
                        <StatCard label="GAMES" value={String(stats.games_played)} />
                        <StatCard label="ACCURACY" value={`${Math.round(stats.accuracy_pct)}%`} />
                        <StatCard label="BEST STREAK" value={String(stats.best_streak)} gold />
                        <StatCard label="DAILY WINS" value={String(stats.daily_challenges)} />
                        <StatCard label="CORRECT" value={`${stats.total_correct}/${stats.total_questions}`} />
                        <StatCard label="LIFETIME XP" value={String(stats.lifetime_score)} />
                    </View>
                )}

                {/* Logout */}
                <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
                    <LogOut size={16} color="#f87171" />
                    <Text style={s.logoutText}>SIGN OUT</Text>
                </TouchableOpacity>

                <View style={{ height: 80 }} />
            </ScrollView>
            <BottomNav />
        </SafeAreaView>
    )
}

const StatCard = ({ label, value, gold = false }: { label: string; value: string; gold?: boolean }) => (
    <View style={sc.card}>
        <Text style={sc.label}>{label}</Text>
        <Text style={[sc.value, gold && { color: '#c9a227' }]}>{value}</Text>
    </View>
)

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#1a1a2e' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
    title: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 18 },
    scroll: { padding: 20, gap: 16, paddingBottom: 24 },
    identityCard: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#252847', borderRadius: 4, padding: 20, borderWidth: 1, borderColor: '#2e2c4e' },
    avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(108,99,255,0.2)', borderWidth: 2, borderColor: 'rgba(108,99,255,0.4)', alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontFamily: 'PlayfairDisplay_700Bold', color: '#6c63ff', fontSize: 22 },
    displayName: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 16 },
    email: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 12 },
    levelCard: { backgroundColor: '#252847', borderRadius: 4, padding: 20, borderWidth: 1, borderColor: '#2e2c4e', gap: 10 },
    levelHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
    levelLabel: { fontFamily: 'Montserrat_400Regular', color: '#6c63ff', fontSize: 10, letterSpacing: 3 },
    levelTitle: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 15 },
    xpText: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 10 },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    centered: { paddingVertical: 40, alignItems: 'center' },
    logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)', borderRadius: 4 },
    logoutText: { fontFamily: 'Montserrat_400Regular', color: '#f87171', fontSize: 12, letterSpacing: 3 },
})

const sc = StyleSheet.create({
    card: { width: '47%', backgroundColor: '#252847', borderRadius: 4, padding: 16, borderWidth: 1, borderColor: '#2e2c4e', gap: 4 },
    label: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 9, letterSpacing: 3 },
    value: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 20 },
})

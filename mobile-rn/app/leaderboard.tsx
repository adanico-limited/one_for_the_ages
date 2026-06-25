import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react-native'
import { useAuthStore } from '@/store/useAuthStore'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { BottomNav } from '@/components/ui/BottomNav'

interface LeaderboardEntry {
    rank: number
    display_name: string
    score?: number
    lifetime_score?: number
    games_played?: number
    accuracy_pct?: number
    is_current_user: boolean
}

export default function LeaderboardPage() {
    const router = useRouter()
    const { isAuthenticated, authReady } = useAuthStore()
    const [activeTab, setActiveTab] = useState<'daily' | 'alltime'>('daily')
    const [dailyEntries, setDailyEntries] = useState<LeaderboardEntry[]>([])
    const [allTimeEntries, setAllTimeEntries] = useState<LeaderboardEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
    const [myRank, setMyRank] = useState<number | null>(null)
    const [totalPlayers, setTotalPlayers] = useState(0)
    const todayStr = new Date().toISOString().split('T')[0]

    useEffect(() => {
        if (!authReady) return
        if (!isAuthenticated) { router.replace('/welcome'); return }
        loadLeaderboard()
    }, [authReady, isAuthenticated, activeTab, selectedDate])

    const loadLeaderboard = async () => {
        setIsLoading(true)
        try {
            if (activeTab === 'daily') {
                const data = await apiClient.getDailyLeaderboard(selectedDate)
                setDailyEntries(data.entries || [])
                setTotalPlayers(data.total_players || 0)
                setMyRank(data.current_user_rank)
            } else {
                const data = await apiClient.getAllTimeLeaderboard()
                setAllTimeEntries(data.entries || [])
                setTotalPlayers(data.total_players || 0)
                setMyRank(data.current_user_rank)
            }
        } catch (error) {
            logger.error('Failed to load leaderboard:', error)
        }
        setIsLoading(false)
    }

    const changeDay = (delta: number) => {
        const d = new Date(selectedDate + 'T00:00:00')
        d.setDate(d.getDate() + delta)
        const next = d.toISOString().split('T')[0]
        if (next > todayStr) return
        setSelectedDate(next)
    }

    const dateLabel = () => {
        if (selectedDate === todayStr) return 'Today'
        const d = new Date(selectedDate + 'T00:00:00')
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        if (selectedDate === yesterday.toISOString().split('T')[0]) return 'Yesterday'
        return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    }

    const getRankLabel = (rank: number) => {
        if (rank === 1) return 'Gold'
        if (rank === 2) return 'Silver'
        if (rank === 3) return 'Bronze'
        return `#${rank}`
    }

    const getRankColor = (rank: number) => {
        if (rank === 1) return '#c9a227'
        if (rank === 2) return '#9ca3af'
        if (rank === 3) return '#d97706'
        return '#8884a8'
    }

    const entries = activeTab === 'daily' ? dailyEntries : allTimeEntries

    return (
        <SafeAreaView style={s.safe}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.replace('/')}>
                    <ArrowLeft size={18} color="#8884a8" />
                </TouchableOpacity>
                <Text style={s.title}>Leaderboard</Text>
                <View style={{ width: 18 }} />
            </View>

            {/* Tabs */}
            <View style={s.tabs}>
                <TouchableOpacity style={[s.tab, activeTab === 'daily' && s.tabActive]} onPress={() => setActiveTab('daily')}>
                    <Text style={[s.tabText, activeTab === 'daily' && s.tabTextActive]}>Daily</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.tab, activeTab === 'alltime' && s.tabActive]} onPress={() => setActiveTab('alltime')}>
                    <Text style={[s.tabText, activeTab === 'alltime' && s.tabTextActive]}>All Time</Text>
                </TouchableOpacity>
            </View>

            {/* Day nav */}
            {activeTab === 'daily' && (
                <View style={s.dayNav}>
                    <TouchableOpacity onPress={() => changeDay(-1)} style={s.dayBtn}>
                        <ChevronLeft size={18} color="#8884a8" />
                    </TouchableOpacity>
                    <Text style={s.dayLabel}>{dateLabel()}</Text>
                    <TouchableOpacity onPress={() => changeDay(1)} style={s.dayBtn} disabled={selectedDate === todayStr}>
                        <ChevronRight size={18} color={selectedDate === todayStr ? '#2e2c4e' : '#8884a8'} />
                    </TouchableOpacity>
                </View>
            )}

            {/* My rank */}
            {!!myRank && (
                <View style={s.myRankCard}>
                    <View>
                        <Text style={s.myRankLabel}>YOUR RANK</Text>
                        <Text style={s.myRankVal}>#{myRank}</Text>
                    </View>
                    <Text style={s.totalPlayers}>of {totalPlayers} players</Text>
                </View>
            )}

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 80 }}>
                {isLoading ? (
                    <View style={s.centered}><ActivityIndicator color="#6c63ff" /></View>
                ) : entries.length === 0 ? (
                    <View style={s.centered}>
                        <Text style={s.emptyText}>No entries yet</Text>
                        <Text style={s.emptySubtext}>Be the first to submit a score!</Text>
                    </View>
                ) : entries.map((entry, i) => (
                    <View key={i} style={[s.row, entry.is_current_user && s.rowHighlight]}>
                        <Text style={[s.rank, { color: getRankColor(entry.rank) }]}>{getRankLabel(entry.rank)}</Text>
                        <View style={{ flex: 1 }}>
                            <Text style={[s.name, entry.is_current_user && { color: '#6c63ff' }]}>
                                {entry.display_name}{entry.is_current_user ? ' (You)' : ''}
                            </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={s.score}>{activeTab === 'daily' ? entry.score : entry.lifetime_score}</Text>
                            <Text style={s.pts}>pts</Text>
                        </View>
                    </View>
                ))}
            </ScrollView>
            <BottomNav />
        </SafeAreaView>
    )
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#1a1a2e' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
    title: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 18 },
    tabs: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: '#1e2040', borderRadius: 4, borderWidth: 1, borderColor: '#2e2c4e', padding: 4, marginBottom: 16 },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 2 },
    tabActive: { backgroundColor: '#6c63ff' },
    tabText: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 13 },
    tabTextActive: { color: '#fff' },
    dayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, backgroundColor: '#1e2040', borderRadius: 4, borderWidth: 1, borderColor: '#2e2c4e', marginBottom: 16, paddingVertical: 4 },
    dayBtn: { padding: 10 },
    dayLabel: { fontFamily: 'Montserrat_400Regular', color: '#f0eefc', fontSize: 13 },
    myRankCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, backgroundColor: 'rgba(108,99,255,0.1)', borderWidth: 1, borderColor: 'rgba(108,99,255,0.3)', borderRadius: 4, padding: 16, marginBottom: 12 },
    myRankLabel: { fontFamily: 'Montserrat_400Regular', color: '#6c63ff', fontSize: 11, letterSpacing: 2 },
    myRankVal: { fontFamily: 'PlayfairDisplay_700Bold', color: '#6c63ff', fontSize: 22 },
    totalPlayers: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 12 },
    centered: { paddingTop: 60, alignItems: 'center', gap: 8 },
    emptyText: { fontFamily: 'PlayfairDisplay_700Bold', color: '#8884a8', fontSize: 16 },
    emptySubtext: { fontFamily: 'Montserrat_400Regular', color: '#4a4870', fontSize: 12 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#2e2c4e' },
    rowHighlight: { backgroundColor: 'rgba(108,99,255,0.05)' },
    rank: { fontFamily: 'Montserrat_400Regular', fontSize: 12, fontWeight: 'bold', width: 52, textAlign: 'center' },
    name: { fontFamily: 'Montserrat_400Regular', color: '#f0eefc', fontSize: 13 },
    score: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 16 },
    pts: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 10 },
})

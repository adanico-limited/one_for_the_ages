'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { AppShell } from '@/components/ui/Layout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ArrowLeft } from 'lucide-react'

interface LeaderboardEntry {
    rank: number
    display_name: string
    score?: number
    lifetime_score?: number
    games_played?: number
    accuracy_pct?: number
    best_streak?: number
    is_current_user: boolean
}

export default function LeaderboardPage() {
    const router = useRouter()
    const { isAuthenticated } = useAuthStore()

    const [activeTab, setActiveTab] = useState<'daily' | 'alltime'>('daily')
    const [dailyEntries, setDailyEntries] = useState<LeaderboardEntry[]>([])
    const [allTimeEntries, setAllTimeEntries] = useState<LeaderboardEntry[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
    const [totalPlayers, setTotalPlayers] = useState(0)
    const [myRank, setMyRank] = useState<number | null>(null)

    useEffect(() => {
        loadLeaderboard()
    }, [activeTab, selectedDate])

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

    const getRankLabel = (rank: number) => {
        if (rank === 1) return 'Gold'
        if (rank === 2) return 'Silver'
        if (rank === 3) return 'Bronze'
        return `#${rank}`
    }

    const getRankColor = (rank: number) => {
        if (rank === 1) return 'text-gold'
        if (rank === 2) return 'text-gray-300'
        if (rank === 3) return 'text-amber-600'
        return 'text-text-muted'
    }

    const entries = activeTab === 'daily' ? dailyEntries : allTimeEntries

    return (
        <AppShell>
            {/* Header */}
            <header className="flex items-center justify-between mb-6 pt-10">
                <Button variant="ghost" onClick={() => router.push('/')} className="text-text-muted">
                    <ArrowLeft size={18} className="mr-1" /> Back
                </Button>
                <h1 className="text-xl font-bold text-text-primary font-serif">Leaderboard</h1>
                <div className="w-16" />
            </header>

            {/* Tabs */}
            <div className="flex bg-surface rounded-sharp border border-border-subtle p-1 mb-6">
                <button
                    onClick={() => setActiveTab('daily')}
                    className={`flex-1 py-2 rounded-sharp text-sm font-medium transition-colors duration-150 ${
                        activeTab === 'daily'
                            ? 'bg-primary text-white'
                            : 'text-text-muted'
                    }`}
                >
                    Daily
                </button>
                <button
                    onClick={() => setActiveTab('alltime')}
                    className={`flex-1 py-2 rounded-sharp text-sm font-medium transition-colors duration-150 ${
                        activeTab === 'alltime'
                            ? 'bg-primary text-white'
                            : 'text-text-muted'
                    }`}
                >
                    All Time
                </button>
            </div>

            {/* Date Picker for Daily */}
            {activeTab === 'daily' && (
                <div className="mb-6">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className="w-full bg-surface text-text-primary py-3 px-4 rounded-sharp border border-border-subtle focus:border-primary focus:outline-none"
                    />
                </div>
            )}

            {/* My Rank Banner */}
            {myRank && (
                <Card className="p-4 mb-6 border-primary/30">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-primary text-sm font-bold">Your Rank</p>
                            <p className="text-text-primary text-2xl font-bold font-mono">#{myRank}</p>
                        </div>
                        <p className="text-text-muted text-sm">of {totalPlayers} players</p>
                    </div>
                </Card>
            )}

            {/* Leaderboard List */}
            {isLoading ? (
                <div className="text-center py-12">
                    <div className="skeleton w-10 h-10 rounded-full mx-auto mb-4" />
                    <p className="text-text-muted">Loading leaderboard...</p>
                </div>
            ) : entries.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-text-muted text-lg">No entries yet</p>
                    <p className="text-text-muted text-sm mt-2">Be the first to submit a score!</p>
                </div>
            ) : (
                <div className="space-y-1">
                    {entries.map((entry, i) => (
                        <div
                            key={i}
                            className={`flex items-center gap-4 p-4 border-b border-border-subtle ${
                                entry.is_current_user ? 'bg-primary/10' : ''
                            }`}
                        >
                            {/* Rank */}
                            <div className={`w-14 text-center font-bold text-sm font-mono ${getRankColor(entry.rank)}`}>
                                {getRankLabel(entry.rank)}
                            </div>

                            {/* Name */}
                            <div className="flex-1">
                                <p className={`font-medium ${entry.is_current_user ? 'text-primary' : 'text-text-primary'}`}>
                                    {entry.display_name}
                                    {entry.is_current_user && ' (You)'}
                                </p>
                                {activeTab === 'alltime' && entry.games_played && (
                                    <p className="text-text-muted text-xs">
                                        {entry.games_played} games · {entry.accuracy_pct?.toFixed(0)}% accuracy
                                    </p>
                                )}
                            </div>

                            {/* Score */}
                            <div className="text-right">
                                <p className="text-text-primary font-bold font-mono">
                                    {activeTab === 'daily' ? entry.score : entry.lifetime_score}
                                </p>
                                <p className="text-text-muted text-xs">points</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </AppShell>
    )
}

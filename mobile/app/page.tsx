'use client'

import { useState, useEffect } from 'react'
import { AppShell } from '@/components/ui/Layout'
import { ArtifactCard } from '@/components/ArtifactCard'
import { BottomNav } from '@/components/ui/BottomNav'
import { Hourglass, Scale, Star, ArrowRight, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useAuthStore } from '@/store/useAuthStore'
import { useCategoryStore } from '@/store/useCategoryStore'
import { useDifficultyStore, getDifficultyParam } from '@/store/useDifficultyStore'
import { apiClient } from '@/lib/api-client'
import { calculateLevel } from '@/lib/xp'
import { logger } from '@/lib/logger'
import { getCategoryLabel } from '@/lib/categories'

interface UserStats {
    lifetime_score: number
    best_streak: number
    games_played: number
    accuracy_pct: number
    current_streak: number
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

    // Dev Auto-Login Logic — set NEXT_PUBLIC_DEV_AUTO_LOGIN=true in .env.local to enable
    useEffect(() => {
        const performDevLogin = async () => {
            if (!isAuthenticated && process.env.NEXT_PUBLIC_DEV_AUTO_LOGIN === 'true') {
                logger.info('performing dev auto-login...')
                const devUser = {
                    uid: 'dev_user_123',
                    email: 'dev@ofta.com',
                    displayName: 'Dev Player',
                    emailVerified: true,
                    isAnonymous: false,
                    metadata: {},
                    providerData: [],
                    refreshToken: '',
                    tenantId: null,
                    delete: async () => { },
                    getIdToken: async () => 'DEV_TOKEN_123',
                    getIdTokenResult: async () => ({} as any),
                    reload: async () => { },
                    toJSON: () => ({}),
                    phoneNumber: null,
                    photoURL: null,
                    providerId: 'firebase',
                }

                // Set user in store (this sets isAuthenticated=true)
                setUser(devUser as any)

                // Set token manually for API client
                apiClient.setToken('DEV_TOKEN_123')

                // Register in backend to ensure DB record exists
                try {
                    const oftaUser = await apiClient.register({
                        firebase_uid: 'dev_user_123',
                        display_name: 'Dev Player',
                        email: 'dev@ofta.com',
                        auth_provider: 'email',
                    })
                    setOftaUser(oftaUser)
                    logger.info('Dev user logged in & registered:', oftaUser)
                } catch (error) {
                    logger.error('Dev login failed:', error)
                }
            }
        }

        performDevLogin()
    }, [isAuthenticated, setUser, setOftaUser])

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

    // 1. Time-based greeting logic
    const getGreeting = () => {
        const hour = currentTime.getHours()
        if (hour < 12) return 'Good Morning'
        if (hour < 18) return 'Good Afternoon'
        return 'Good Evening'
    }

    // 2. Countdown logic for "Resets in..."
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date())

            const now = new Date()
            const tomorrow = new Date(now)
            tomorrow.setDate(tomorrow.getDate() + 1)
            tomorrow.setHours(0, 0, 0, 0)

            const diff = tomorrow.getTime() - now.getTime()
            const hours = Math.floor(diff / (1000 * 60 * 60))
            const minutes = Math.floor((diff / (1000 * 60)) % 60)
            const seconds = Math.floor((diff / 1000) % 60)

            setTimeLeft(
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            )
        }, 1000)

        return () => clearInterval(timer)
    }, [])


    const levelInfo = calculateLevel(stats?.lifetime_score || 0)
    const user = {
        name: oftaUser?.display_name || authUser?.displayName || oftaUser?.email?.split('@')[0] || 'Challenger',
        level: levelInfo.level,
        streak: stats?.current_streak || 0,
        accuracy: stats ? Math.round(stats.accuracy_pct) : 0,
        bestScore: stats?.lifetime_score || 0,
    }

    return (
        <AppShell className="bg-canvas pb-24">
            <div className="flex flex-col gap-4 px-5 pt-14" style={{ minHeight: 'calc(100dvh - 96px)' }}>

                {/* 1️⃣ Header */}
                <header>
                    <div className="flex items-center justify-between">
                        <h1 className="font-serif text-xl text-text-primary tracking-tight">
                            {getGreeting()}, {user.name}
                        </h1>
                        {!isAuthenticated && (
                            <Link
                                href="/welcome"
                                className="font-sans text-[10px] text-primary tracking-widest uppercase border border-primary/40 rounded-sharp px-3 py-1 hover:bg-primary/10 transition-colors"
                            >
                                Sign In
                            </Link>
                        )}
                    </div>
                    <div className="flex items-center gap-2 font-sans text-[10px] tracking-widest uppercase mt-0.5">
                        {statsLoading ? (
                            <div className="h-2.5 w-32 bg-surface-raised rounded animate-pulse" />
                        ) : (
                        <>
                            <span className="text-text-muted">Level {user.level}</span>
                            <span className="text-border-subtle">•</span>
                            <div className="flex items-center gap-1 text-gold">
                                <span>{user.streak} Day Streak</span>
                                <span className="animate-flame drop-shadow-[0_0_8px_rgba(201,162,39,0.5)]">🔥</span>
                            </div>
                        </>
                        )}
                    </div>
                </header>

                {/* 2️⃣ Daily Challenge — compact horizontal */}
                <section>
                    <div className="relative bg-gradient-to-br from-surface-raised to-canvas border border-gold/30 rounded-sharp overflow-hidden p-4 flex items-center justify-between gap-4">
                        <div className="absolute top-0 right-0 w-28 h-28 bg-gold/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                        <div className="z-10 flex-1 min-w-0">
                            <div className="font-sans text-[9px] text-gold tracking-[0.3em] uppercase mb-1">
                                Daily Challenge
                            </div>
                            <h3 className="font-serif text-base text-text-primary leading-tight mb-1">
                                One pack. One shot.
                            </h3>
                            <div className="font-sans text-[9px] text-gold/70 tracking-[0.15em] uppercase">
                                Resets in {timeLeft}
                            </div>
                        </div>
                        <Link href="/game/daily" className="z-10 flex-shrink-0">
                            <button className="bg-primary text-white font-sans text-[10px] tracking-widest uppercase px-4 py-3 rounded-sharp flex items-center gap-1.5 active:bg-primary/80 transition-all whitespace-nowrap shadow-lg shadow-black/40">
                                Play <ArrowRight size={12} />
                            </button>
                        </Link>
                    </div>
                </section>

                {/* 3️⃣ Game Modes */}
                <section>
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="font-sans text-[9px] text-text-muted tracking-[0.3em] uppercase">
                            Game Modes
                        </h2>
                        <div className="flex items-center gap-1.5">
                            <Link
                                href="/categories"
                                className={
                                    "flex items-center gap-1.5 font-sans text-[8px] tracking-widest uppercase px-2.5 py-1.5 rounded-sharp border transition-all " +
                                    (selectedCategories.length > 0
                                        ? "bg-primary/15 border-primary text-primary"
                                        : "border-border-subtle text-text-muted hover:border-gold/30")
                                }
                            >
                                <SlidersHorizontal size={10} />
                                {selectedCategories.length > 0 ? getCategoryLabel(selectedCategories) : "Categories"}
                            </Link>
                            <Link
                                href="/difficulty"
                                className={
                                    "font-sans text-[8px] tracking-widest uppercase px-2.5 py-1.5 rounded-sharp border transition-all " +
                                    (diffIsCustom
                                        ? "bg-primary/15 border-primary text-primary"
                                        : "border-border-subtle text-text-muted hover:border-gold/30")
                                }
                            >
                                {diffIsCustom ? diffLabel : "Difficulty"}
                            </Link>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Link href="/game/age-guess" className="bg-surface-raised border border-gold/10 rounded-sharp px-5 py-4 flex items-center gap-4 hover:border-gold/30 active:opacity-80 transition-all">
                            <Hourglass size={20} className="text-primary shrink-0" />
                            <div className="flex-1">
                                <div className="font-serif text-sm text-text-primary">Guess the Age</div>
                                <div className="font-sans text-[9px] text-text-muted tracking-wide uppercase mt-0.5">Precision</div>
                            </div>
                            <ArrowRight size={14} className="text-text-muted/40 shrink-0" />
                        </Link>
                        <Link href="/game/whos-older" className="bg-surface-raised border border-gold/10 rounded-sharp px-5 py-4 flex items-center gap-4 hover:border-gold/30 active:opacity-80 transition-all">
                            <Scale size={20} className="text-primary shrink-0" />
                            <div className="flex-1">
                                <div className="font-serif text-sm text-text-primary">Who’s Older?</div>
                                <div className="font-sans text-[9px] text-text-muted tracking-wide uppercase mt-0.5">Versus</div>
                            </div>
                            <ArrowRight size={14} className="text-text-muted/40 shrink-0" />
                        </Link>
                        <Link href="/game/reverse" className="bg-surface-raised border border-gold/10 rounded-sharp px-5 py-4 flex items-center gap-4 hover:border-gold/30 active:opacity-80 transition-all">
                            <Star size={20} className="text-primary shrink-0" />
                            <div className="flex-1">
                                <div className="font-serif text-sm text-text-primary">Zodiac</div>
                                <div className="font-sans text-[9px] text-text-muted tracking-wide uppercase mt-0.5">Astrology</div>
                            </div>
                            <ArrowRight size={14} className="text-text-muted/40 shrink-0" />
                        </Link>
                    </div>
                </section>

                {/* 4️⃣ Quick Stats */}
                <section className="border-t border-border-subtle pt-3 flex justify-between items-center text-center">
                    {statsLoading ? (
                        <>
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="flex-1 space-y-1.5">
                                    <div className="h-2 w-12 mx-auto bg-surface-raised rounded animate-pulse" />
                                    <div className="h-5 w-8 mx-auto bg-surface-raised rounded animate-pulse" />
                                </div>
                            ))}
                        </>
                    ) : (
                        <>
                            <div className="space-y-0.5">
                                <p className="font-sans text-[9px] text-text-muted uppercase tracking-widest">Accuracy</p>
                                <p className="font-serif text-base text-text-primary">{user.accuracy}%</p>
                            </div>
                            <div className="w-[1px] h-6 bg-border-subtle" />
                            <div className="space-y-0.5">
                                <p className="font-sans text-[9px] text-text-muted uppercase tracking-widest">Best Score</p>
                                <p className="font-serif text-base text-text-primary">{user.bestScore}</p>
                            </div>
                            <div className="w-[1px] h-6 bg-border-subtle" />
                            <div className="space-y-0.5">
                                <p className="font-sans text-[9px] text-text-muted uppercase tracking-widest">Streak</p>
                                <p className="font-serif text-base text-gold">{user.streak}</p>
                            </div>
                        </>
                    )}
                </section>

            </div>

            {/* 5️⃣ Bottom Navigation */}
            <BottomNav />
        </AppShell>
    )
}

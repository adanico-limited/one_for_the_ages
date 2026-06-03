'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/ui/Layout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { GameLoadingSkeleton } from '@/components/ui/SkeletonLoader'
import { useGameStore } from '@/store/useGameStore'
import { useAuthStore } from '@/store/useAuthStore'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { sounds } from '@/lib/sounds'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Lightbulb, ArrowLeft, Clock, Flame, ArrowRight } from 'lucide-react'

export default function DailyChallengePage() {
    const router = useRouter()
    const { isAuthenticated } = useAuthStore()
    const {
        sessionId,
        questions,
        currentQuestionIndex,
        score,
        startGame,
        nextQuestion,
        submitAnswer,
        endGame,
    } = useGameStore()

    // Lobby vs Game State
    const [isGameStarted, setIsGameStarted] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    // Timer
    const [timeLeft, setTimeLeft] = useState('')
    const [isClosingSoon, setIsClosingSoon] = useState(false)

    // Completion / Stats
    const [alreadyCompleted, setAlreadyCompleted] = useState(false)
    const [userStats, setUserStats] = useState({
        score: 0,
        accuracy: 0,
        rank: '#---',
        streak: 0
    })

    // Game Logic State
    const [guess, setGuess] = useState('')
    const [feedback, setFeedback] = useState<string | null>(null)
    const [showHint, setShowHint] = useState(false)
    const [todayDate] = useState(() => new Date().toISOString().split('T')[0])

    const currentQuestion = questions[currentQuestionIndex]
    const isLastQuestion = currentQuestionIndex === questions.length - 1

    // 1. Initial Data Fetch (Lobby Context)
    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/')
            return
        }

        const fetchInitData = async () => {
            try {
                // Check if already played today
                const packStatus = await apiClient.getDailyPack(todayDate)
                if (packStatus.is_completed) {
                    setAlreadyCompleted(true)
                    setUserStats({
                        score: packStatus.user_score,
                        accuracy: packStatus.accuracy || 80,
                        rank: packStatus.rank || '#412',
                        streak: packStatus.streak || 0
                    })
                } else {
                    // Fetch user stats for the Lobby (streak etc)
                    const stats = await apiClient.getUserStats()
                    setUserStats(prev => ({
                        ...prev,
                        streak: stats.current_streak || 0
                    }))
                }
                setIsLoading(false)
            } catch (error) {
                logger.error('Failed to load lobby data:', error)
                // Fallback to avoid getting stuck
                setIsLoading(false)
            }
        }

        fetchInitData()
    }, [isAuthenticated, router, todayDate])

    // 2. Countdown Timer Logic
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date()
            const tomorrow = new Date(now)
            tomorrow.setDate(tomorrow.getDate() + 1)
            tomorrow.setHours(0, 0, 0, 0)

            const diff = tomorrow.getTime() - now.getTime()
            const hours = Math.floor(diff / (1000 * 60 * 60))
            const minutes = Math.floor((diff / (1000 * 60)) % 60)
            const seconds = Math.floor((diff / 1000) % 60)

            // Color shift if < 1 hour
            if (hours === 0 && !isClosingSoon) setIsClosingSoon(true)

            setTimeLeft(
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            )
        }, 1000)
        return () => clearInterval(timer)
    }, [isClosingSoon])

    // 3. Game Lifecycle Actions
    const handleStartChallenge = async () => {
        setIsLoading(true)
        try {
            const session = await apiClient.startSession({
                mode: 'DAILY_CHALLENGE',
                pack_date: todayDate,
            })
            startGame(session.id, 'DAILY_CHALLENGE', session.questions)
            setIsGameStarted(true)
            setIsLoading(false)
        } catch (error) {
            logger.error('Failed to start daily:', error)
            setIsLoading(false)
        }
    }

    const handleSubmit = async () => {
        if (!guess || !currentQuestion) return

        const userGuess = parseInt(guess, 10)
        if (isNaN(userGuess) || userGuess < 0 || userGuess > 120) {
            setFeedback('Enter a valid age.')
            return
        }

        try {
            // we use the store's track of startTime
            const questionStartTime = useGameStore.getState().questionStartTime || Date.now()
            const responseTimeMs = Date.now() - questionStartTime

            const result = await apiClient.submitAnswer(sessionId!, {
                question_template_id: currentQuestion.id,
                question_index: currentQuestionIndex,
                user_answer: { age: userGuess },
                response_time_ms: responseTimeMs,
                hints_used: showHint ? 1 : 0,
            })

            submitAnswer(result.is_correct, result.score_awarded)

            if (result.is_correct) {
                sounds.play('correct')
                await Haptics.impact({ style: ImpactStyle.Medium })
            } else {
                sounds.play('wrong')
                await Haptics.impact({ style: ImpactStyle.Light })
            }

            setFeedback(result.is_correct
                ? `Correct! ${currentQuestion.celebrity_name} is ${result.correct_answer.age}.`
                : `${currentQuestion.celebrity_name} is ${result.correct_answer.age}.`
            )

            setTimeout(() => {
                if (isLastQuestion) {
                    handleEndGame()
                } else {
                    nextQuestion()
                    setGuess('')
                    setFeedback(null)
                    setShowHint(false)
                }
            }, 1500)
        } catch (error) {
            logger.error('Failed to submit:', error)
            setFeedback('Failed to submit.')
        }
    }

    const handleEndGame = async () => {
        try {
            await apiClient.endSession(sessionId!)
            await apiClient.submitDailyScore(todayDate)
            endGame()
            router.push('/game/results')
        } catch (error) {
            logger.error('Failed to end:', error)
            router.push('/game/results')
        }
    }

    // --- Loading State ---
    if (isLoading) {
        return (
            <AppShell className="flex items-center justify-center p-8 bg-canvas">
                <GameLoadingSkeleton />
            </AppShell>
        )
    }

    // --- VIEW: ALREADY COMPLETED ---
    if (alreadyCompleted) {
        return (
            <AppShell className="bg-canvas flex flex-col p-8 md:p-12">
                <header className="mb-12 text-center">
                    <h1 className="font-montserrat font-bold text-[10px] text-text-muted tracking-[0.4em] uppercase">
                        DAILY CHALLENGE
                    </h1>
                </header>

                <main className="flex-1 flex flex-col items-center justify-center space-y-12">
                    <div className="space-y-4 text-center">
                        <p className="font-serif text-3xl text-text-primary leading-tight">You’ve played today.</p>
                        <p className="font-sans text-sm text-text-muted opacity-80">The archive resets at midnight.</p>
                    </div>

                    <div className="w-full max-w-sm bg-surface-raised border border-white/5 rounded-sharp p-10 space-y-8 shadow-2xl">
                        <div className="flex justify-between items-baseline border-b border-white/5 pb-4">
                            <span className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-bold">Score</span>
                            <span className="font-serif text-3xl text-text-primary">{userStats.score}</span>
                        </div>
                        <div className="flex justify-between items-baseline border-b border-white/5 pb-4">
                            <span className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-bold">Accuracy</span>
                            <span className="font-serif text-3xl text-text-primary">{userStats.accuracy}%</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                            <span className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-bold">Global Rank</span>
                            <span className="font-serif text-3xl text-gold">{userStats.rank}</span>
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-3">
                        <div className={`flex items-center gap-2 transition-colors ${isClosingSoon ? 'text-orange-400' : 'text-primary'}`}>
                            <Clock size={16} />
                            <span className="font-montserrat font-bold text-xs tracking-[0.2em] uppercase">
                                Resets in {timeLeft}
                            </span>
                        </div>
                    </div>
                </main>

                <footer className="mt-auto pt-12 space-y-4">
                    <Button
                        onClick={() => router.push('/leaderboard')}
                        className="w-full h-16 bg-surface-raised border border-white/10 text-text-primary font-montserrat font-bold text-xs tracking-widest uppercase"
                    >
                        View Leaderboard
                    </Button>
                    <Button
                        onClick={() => router.push('/')}
                        variant="ghost"
                        className="w-full h-12 font-montserrat font-bold text-xs tracking-widest uppercase opacity-60"
                    >
                        Return Home
                    </Button>
                </footer>
            </AppShell>
        )
    }

    // --- VIEW: GAMEPLAY LOOP ---
    if (isGameStarted && currentQuestion) {
        const progressPct = ((currentQuestionIndex + 1) / questions.length) * 100

        return (
            <AppShell className="bg-canvas flex flex-col p-8 md:p-12 relative overflow-hidden">
                {/* Clean, high-stakes Progress bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-white/5 z-20">
                    <div
                        className="h-full bg-primary transition-all duration-700 ease-out"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>

                <header className="flex justify-between items-center mb-16 mt-6">
                    <div className="space-y-1">
                        <p className="font-montserrat font-bold text-[10px] text-gold tracking-[0.4em] uppercase opacity-70">
                            Question
                        </p>
                        <p className="font-serif text-3xl text-text-primary">
                            {currentQuestionIndex + 1}<span className="text-text-muted/20 text-xl mx-2">/</span>{questions.length}
                        </p>
                    </div>
                    <div className="text-right space-y-1">
                        <p className="font-montserrat font-bold text-[10px] text-primary tracking-[0.4em] uppercase opacity-70">
                            Points
                        </p>
                        <p className="font-serif text-3xl text-text-primary">
                            {score}
                        </p>
                    </div>
                </header>

                <main className="flex-1 flex flex-col items-center justify-center space-y-12">
                    <div className="text-center space-y-6">
                        <h2 className="font-montserrat font-bold text-[10px] text-text-muted tracking-[0.4em] uppercase opacity-50">
                            How old is...
                        </h2>
                        <h3 className="font-serif text-4xl md:text-6xl text-text-primary leading-tight tracking-tight">
                            {currentQuestion.celebrity_name}?
                        </h3>
                    </div>

                    <div className="w-full max-w-xs space-y-10">
                        <Input
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={guess}
                            onChange={(e) => setGuess(e.target.value)}
                            placeholder="--"
                            className="bg-transparent border-b-2 border-white/5 rounded-none text-center text-6xl font-serif text-gold focus:border-primary transition-all placeholder:text-white/5 h-28 p-0"
                            disabled={!!feedback}
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        />

                        {feedback ? (
                            <div className="py-2 text-center animate-fade-in">
                                <p className={`font-montserrat font-bold text-xs tracking-[0.2em] uppercase ${feedback.includes('Correct') ? 'text-green-400' : 'text-text-muted/60'}`}>
                                    {feedback}
                                </p>
                            </div>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={!guess}
                                className="w-full bg-primary text-white font-montserrat font-bold text-xs tracking-[0.3em] uppercase py-6 rounded-sharp shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30"
                            >
                                Submit Guess
                            </button>
                        )}
                    </div>

                    {/* Hint Section */}
                    {!feedback && currentQuestion.hints?.length > 0 && (
                        <div className="h-12 flex items-center justify-center">
                            {showHint ? (
                                <p className="font-sans text-sm text-text-muted/80 italic px-8 text-center animate-fade-in leading-relaxed">
                                    "{currentQuestion.hints[0]}"
                                </p>
                            ) : (
                                <button
                                    onClick={() => setShowHint(true)}
                                    className="flex items-center gap-2 text-text-muted/30 hover:text-text-muted transition-colors"
                                >
                                    <Lightbulb size={14} />
                                    <span className="font-montserrat font-bold text-[9px] tracking-[0.3em] uppercase">Get Hint</span>
                                </button>
                            )}
                        </div>
                    )}
                </main>
            </AppShell>
        )
    }

    // --- VIEW: DAILY CHALLENGE GATE (LOBBY) ---
    return (
        <AppShell className="bg-canvas flex flex-col p-8 md:p-12">
            {/* 1️⃣ Back Button */}
            <header className="flex items-center mb-12">
                <button
                    onClick={() => router.push('/')}
                    className="flex items-center gap-3 text-text-muted hover:text-text-primary transition-colors group"
                >
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="font-montserrat font-bold text-[10px] tracking-[0.3em] uppercase">Back</span>
                </button>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center space-y-16">

                {/* 2️⃣ Big Title & 3️⃣ Reset Timer */}
                <div className="text-center space-y-6">
                    <h1 className="font-montserrat font-bold text-4xl md:text-5xl text-text-primary tracking-tight leading-none text-center">
                        DAILY CHALLENGE
                    </h1>

                    <div className={`flex items-center justify-center gap-2 transition-colors duration-500 ${isClosingSoon ? 'text-orange-400' : 'text-gold/80'}`}>
                        <Clock size={16} />
                        <span className="font-montserrat font-bold text-xs tracking-[0.25em] uppercase">
                            Resets in {timeLeft}
                        </span>
                    </div>
                </div>

                {/* 4️⃣ Rules Summary Card */}
                <div className="w-full max-w-sm bg-surface-raised border border-white/5 p-10 rounded-sharp space-y-8 shadow-2xl">
                    <div className="space-y-2">
                        <h3 className="font-serif text-xl text-text-primary">Today’s Global Match</h3>
                        <p className="text-[10px] text-text-muted uppercase tracking-widest opacity-60 font-bold tracking-[0.2em]">Archive Curation • Synchronized</p>
                    </div>
                    <ul className="space-y-5">
                        {[
                            '10 Questions',
                            'One Attempt Only',
                            'Score Ranks Worldwide'
                        ].map((rule) => (
                            <li key={rule} className="flex items-center gap-4 text-sm text-text-muted font-sans tracking-wide">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(30,122,140,0.6)]" />
                                {rule}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* 5️⃣ Streak + Personal Context */}
                <div className="flex flex-col items-center space-y-4">
                    <div className="flex items-center gap-3 text-gold">
                        <Flame
                            size={20}
                            className={`${userStats.streak > 0 ? 'animate-flame' : 'opacity-20'} drop-shadow-[0_0_12px_rgba(201,162,39,0.5)]`}
                        />
                        <span className="font-montserrat font-bold text-sm tracking-[0.2em] uppercase">
                            {userStats.streak > 0 ? `${userStats.streak} Day Streak` : 'Start your streak today'}
                        </span>
                    </div>
                </div>

                {/* 6️⃣ Primary CTA */}
                <div className="w-full max-w-sm space-y-6 pt-4">
                    <button
                        onClick={handleStartChallenge}
                        className="w-full bg-primary text-white font-montserrat font-bold text-sm tracking-[0.4em] uppercase py-6 rounded-sharp flex items-center justify-center gap-3 active:bg-primary/90 transition-all shadow-xl shadow-primary/20 hover:scale-[1.02] transform transition-all group"
                    >
                        Play Challenge
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                    <p className="text-[10px] text-text-muted uppercase tracking-[0.35em] text-center opacity-40 font-bold italic">
                        No retries. Make it count.
                    </p>
                </div>

            </main>
        </AppShell>
    )
}

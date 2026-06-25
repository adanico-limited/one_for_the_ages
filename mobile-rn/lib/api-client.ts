import axios, { AxiosInstance, AxiosError } from 'axios'
import { offlineStartSession, offlineSubmitAnswer, offlineEndSession } from './offline-engine'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081'

function isOffline(): boolean {
    return false // NetInfo is async; offline mode falls through to catch
}

class APIClient {
    private client: AxiosInstance
    private authToken: string | null = null

    // Tracks questions for the current offline session so endSession can score them
    private _offlineQuestions: any[] = []
    private _offlineAnswers: any[] = []

    constructor() {
        this.client = axios.create({
            baseURL: API_BASE_URL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
            },
        })

        // Request interceptor to add auth token
        this.client.interceptors.request.use(
            (config) => {
                if (this.authToken) {
                    config.headers.Authorization = `Bearer ${this.authToken}`
                }
                return config
            },
            (error) => Promise.reject(error)
        )

        // Response interceptor — refresh Firebase token on 401 and retry once
        this.client.interceptors.response.use(
            (response) => response,
            async (error: AxiosError) => {
                const config = error.config as any
                if (error.response?.status === 401 && !config?._retried) {
                    config._retried = true
                    try {
                        const { getIdToken } = await import('./firebase')
                        const token = await getIdToken()
                        if (token) {
                            this.setToken(token)
                            config.headers = { ...config.headers, Authorization: `Bearer ${token}` }
                            return this.client(config)
                        }
                    } catch {
                        // token refresh failed — fall through to reject
                    }
                    this.clearToken()
                }
                return Promise.reject(error)
            }
        )
    }

    setToken(token: string) {
        this.authToken = token
    }

    clearToken() {
        this.authToken = null
    }

    // ────────────────────────────────────────────────
    // Config
    // ────────────────────────────────────────────────

    async getConfig() {
        const { data } = await this.client.get('/v1/config')
        return data
    }

    // ────────────────────────────────────────────────
    // Auth
    // ────────────────────────────────────────────────

    async register(payload: {
        firebase_uid: string
        display_name?: string
        email?: string
        country?: string
        device_os?: string
        auth_provider?: string
    }) {
        const { data } = await this.client.post('/v1/auth/register', payload)
        return data
    }

    async getCurrentUser() {
        const { data } = await this.client.get('/v1/auth/me')
        return data
    }

    async updateProfile(payload: { display_name?: string; country?: string }) {
        const { data } = await this.client.patch('/v1/auth/me', payload)
        return data
    }

    // ────────────────────────────────────────────────
    // Sessions (to be implemented)
    // ────────────────────────────────────────────────

    async startSession(payload: {
        mode: string
        pack_date?: string
        categories?: string[]
        difficulty?: string
    }) {
        if (isOffline()) {
            const session = await offlineStartSession(payload)
            this._offlineQuestions = session.questions
            this._offlineAnswers = []
            return session
        }
        const { data } = await this.client.post('/v1/sessions/start', payload)
        return data
    }

    async submitAnswer(sessionId: string, payload: {
        question_template_id: string
        question_index: number
        user_answer: any
        response_time_ms: number
        hints_used: number
    }) {
        if (isOffline() || sessionId.startsWith('offline-')) {
            const question = this._offlineQuestions[payload.question_index]
            const result = offlineSubmitAnswer({
                question,
                user_answer: payload.user_answer,
                mode: question?.mode ?? '',
            })
            this._offlineAnswers[payload.question_index] = result
            return result
        }
        const { data } = await this.client.post(
            `/v1/sessions/${sessionId}/answer`,
            payload
        )
        return data
    }

    async endSession(sessionId: string) {
        if (isOffline() || sessionId.startsWith('offline-')) {
            return offlineEndSession(this._offlineQuestions, this._offlineAnswers)
        }
        const { data } = await this.client.post(`/v1/sessions/${sessionId}/end`)
        return {
            totalScore: data.total_score,
            questionsCount: data.questions_count,
            correctCount: data.correct_count,
            bestStreak: data.best_streak,
            accuracy: data.accuracy,
            lifetimeScore: data.lifetime_score,
            globalRank: data.global_rank,
            newAchievements: data.new_achievements || [],
        }
    }

    // ────────────────────────────────────────────────
    // Packs
    // ────────────────────────────────────────────────

    async getDailyPack(date: string) {
        const { data } = await this.client.get(`/v1/packs/daily/${date}`)
        return data
    }

    // ────────────────────────────────────────────────
    // Leaderboard
    // ────────────────────────────────────────────────

    async getDailyLeaderboard(date: string, limit = 100) {
        const { data } = await this.client.get(`/v1/leaderboards/daily/${date}`, {
            params: { limit },
        })
        return data
    }

    async getUserStats() {
        const { data } = await this.client.get('/v1/users/stats')
        return data
    }

    // ────────────────────────────────────────────────
    // Leaderboard (extended)
    // ────────────────────────────────────────────────

    async getAllTimeLeaderboard(limit = 100) {
        const { data } = await this.client.get('/v1/leaderboards/all-time', {
            params: { limit },
        })
        return data
    }

    async submitDailyScore(date: string) {
        const { data } = await this.client.post(`/v1/leaderboards/daily/${date}/submit`)
        return data
    }

    // ────────────────────────────────────────────────
    // Users / Stats
    // ────────────────────────────────────────────────

    async getUserAchievements() {
        const { data } = await this.client.get('/v1/users/achievements')
        return data
    }

    async getUserHistory(limit = 20) {
        const { data } = await this.client.get('/v1/users/history', {
            params: { limit },
        })
        return data
    }

    async deleteAccount() {
        const { data } = await this.client.delete('/v1/auth/me')
        return data
    }

    // ────────────────────────────────────────────────
    // Telemetry
    // ────────────────────────────────────────────────

    async logEvent(payload: {
        event_type: string
        event_data?: Record<string, unknown>
        client_ts_tms?: string
    }) {
        // Fire and forget
        this.client.post('/v1/telemetry/events', payload).catch(() => { })
    }
}

export const apiClient = new APIClient()

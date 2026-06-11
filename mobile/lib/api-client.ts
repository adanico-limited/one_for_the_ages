// lib/api-client.ts
/**
 * API Client for OFTA Backend
 */

import axios, { AxiosInstance, AxiosError } from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081'

class APIClient {
    private client: AxiosInstance
    private authToken: string | null = null

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

        // Response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => response,
            (error: AxiosError) => {
                if (error.response?.status === 401) {
                    // Token expired or invalid
                    this.clearToken()
                    // Optionally trigger re-authentication
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
    }) {
        const { data } = await this.client.post('/v1/sessions/start', payload)
        return data
    }

    async submitAnswer(sessionId: string, payload: {
        question_template_id: string
        question_index: number
        user_answer: string | number | boolean
        response_time_ms: number
        hints_used: number
    }) {
        const { data } = await this.client.post(
            `/v1/sessions/${sessionId}/answer`,
            payload
        )
        return data
    }

    async endSession(sessionId: string) {
        const { data } = await this.client.post(`/v1/sessions/${sessionId}/end`)
        return {
            totalScore: data.total_score,
            questionsCount: data.questions_count,
            correctCount: data.correct_count,
            bestStreak: data.best_streak,
            accuracy: data.accuracy,
            lifetimeScore: data.lifetime_score,
            globalRank: data.global_rank,
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

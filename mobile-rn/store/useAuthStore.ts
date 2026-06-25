import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from 'firebase/auth'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { zustandStorage } from '@/lib/storage'

export interface OftaUser {
    id: string
    firebase_uid: string
    display_name: string | null
    email: string | null
    country: string | null
    device_os: string | null
    auth_provider: string
    created_at_tms: string
    last_active_at_tms: string
}

interface AuthState {
    user: User | null
    oftaUser: OftaUser | null
    isAuthenticated: boolean
    authReady: boolean

    setUser: (user: User | null) => void
    setAuthReady: () => void
    setOftaUser: (oftaUser: OftaUser) => void
    registerUser: (firebaseUser: User) => Promise<void>
    logout: () => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            oftaUser: null,
            isAuthenticated: false,
            authReady: false,

            setUser: (user) => { set({ user, isAuthenticated: !!user }) },
            setAuthReady: () => set({ authReady: true }),
            setOftaUser: (oftaUser) => set({ oftaUser }),

            registerUser: async (firebaseUser) => {
                try {
                    const token = await firebaseUser.getIdToken()
                    apiClient.setToken(token)
                    const oftaUser = await apiClient.register({
                        firebase_uid: firebaseUser.uid,
                        display_name: firebaseUser.displayName || undefined,
                        email: firebaseUser.email || undefined,
                        auth_provider: firebaseUser.isAnonymous ? 'anonymous' : 'email',
                    })
                    set({ oftaUser })
                } catch (error) {
                    logger.error('Failed to register user:', error)
                }
            },

            logout: () => {
                set({ user: null, oftaUser: null, isAuthenticated: false })
                apiClient.clearToken()
            },
        }),
        {
            name: 'ofta-auth',
            storage: zustandStorage,
            partialize: (state) => ({
                oftaUser: state.oftaUser,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
)

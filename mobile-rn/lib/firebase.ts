import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import {
    getReactNativePersistence,
    initializeAuth,
    signInAnonymously,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut as firebaseSignOut,
    onIdTokenChanged,
    Auth,
    User,
} from 'firebase/auth'
import AsyncStorage from '@react-native-async-storage/async-storage'

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
}

let app: FirebaseApp
let auth: Auth

if (!getApps().length) {
    app = initializeApp(firebaseConfig)
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
    })
} else {
    app = getApps()[0]
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
    })
}

export { auth }

export const signInAnon = () => signInAnonymously(auth)
export const signInEmail = (email: string, password: string) =>
    signInWithEmailAndPassword(auth, email, password)
export const signUpEmail = (email: string, password: string) =>
    createUserWithEmailAndPassword(auth, email, password)
export const signOut = () => firebaseSignOut(auth)
export const onAuthChange = (callback: (user: User | null) => void) =>
    onIdTokenChanged(auth, callback)
export const getCurrentUser = () => auth.currentUser
export const getIdToken = async () => {
    const user = auth.currentUser
    if (!user) return null
    return user.getIdToken()
}

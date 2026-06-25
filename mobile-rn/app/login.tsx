import { useState } from 'react'
import {
    View, Text, TextInput, TouchableOpacity,
    ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter, useLocalSearchParams, Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native'
import { updateProfile } from 'firebase/auth'
import { signInEmail, signUpEmail } from '@/lib/firebase'
import { useAuthStore } from '@/store/useAuthStore'

type Mode = 'login' | 'register'

export default function Login() {
    const router = useRouter()
    const params = useLocalSearchParams<{ mode?: string }>()
    const { setUser, registerUser } = useAuthStore()

    const [mode, setMode] = useState<Mode>(params.mode === 'register' ? 'register' : 'login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [displayName, setDisplayName] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async () => {
        setError(null)
        setIsLoading(true)
        try {
            if (mode === 'login') {
                const { user } = await signInEmail(email, password)
                setUser(user)
                await registerUser(user)
            } else {
                const { user } = await signUpEmail(email, password)
                if (displayName) await updateProfile(user, { displayName })
                setUser(user)
                await registerUser(user)
            }
            router.replace('/')
        } catch (err: any) {
            const code = err?.code || ''
            if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
                setError('Incorrect email or password.')
            } else if (code.includes('email-already-in-use')) {
                setError('An account with this email already exists.')
            } else if (code.includes('weak-password')) {
                setError('Password must be at least 6 characters.')
            } else if (code.includes('invalid-email')) {
                setError('Please enter a valid email address.')
            } else {
                setError('Something went wrong. Please try again.')
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <SafeAreaView style={s.safe}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

                    {/* Back */}
                    <Link href="/welcome" asChild>
                        <TouchableOpacity style={s.back}>
                            <ArrowLeft size={16} color="#8884a8" />
                            <Text style={s.backText}>BACK</Text>
                        </TouchableOpacity>
                    </Link>

                    {/* Header */}
                    <View style={s.header}>
                        <Text style={s.title}>{mode === 'login' ? 'Welcome back.' : 'Create account.'}</Text>
                        <Text style={s.subtitle}>
                            {mode === 'login'
                                ? 'Sign in to restore your streak and stats.'
                                : 'Join to save your progress across devices.'}
                        </Text>
                    </View>

                    {/* Form */}
                    <View style={s.form}>
                        {mode === 'register' && (
                            <View style={s.field}>
                                <Text style={s.label}>DISPLAY NAME</Text>
                                <TextInput
                                    style={s.input}
                                    value={displayName}
                                    onChangeText={setDisplayName}
                                    placeholder="How you'll appear on leaderboards"
                                    placeholderTextColor="#4a4870"
                                    autoCorrect={false}
                                />
                            </View>
                        )}

                        <View style={s.field}>
                            <Text style={s.label}>EMAIL</Text>
                            <TextInput
                                style={s.input}
                                value={email}
                                onChangeText={setEmail}
                                placeholder="your@email.com"
                                placeholderTextColor="#4a4870"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={s.field}>
                            <Text style={s.label}>PASSWORD</Text>
                            <View style={s.passwordRow}>
                                <TextInput
                                    style={[s.input, s.passwordInput]}
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
                                    placeholderTextColor="#4a4870"
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={s.eyeBtn}>
                                    {showPassword
                                        ? <EyeOff size={16} color="#8884a8" />
                                        : <Eye size={16} color="#8884a8" />
                                    }
                                </TouchableOpacity>
                            </View>
                        </View>

                        {error && <Text style={s.error}>{error}</Text>}

                        <TouchableOpacity
                            style={[s.submitBtn, isLoading && s.submitBtnDisabled]}
                            onPress={handleSubmit}
                            disabled={isLoading}
                        >
                            {isLoading
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={s.submitBtnText}>
                                    {mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                                </Text>
                            }
                        </TouchableOpacity>
                    </View>

                    {/* Toggle */}
                    <TouchableOpacity onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}>
                        <Text style={s.toggleText}>
                            {mode === 'login'
                                ? "Don't have an account? Create one"
                                : 'Already have an account? Sign in'}
                        </Text>
                    </TouchableOpacity>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    )
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#1a1a2e' },
    scroll: { padding: 24, flexGrow: 1, justifyContent: 'center' },
    back: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 40, marginTop: 10 },
    backText: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 10, letterSpacing: 3 },
    header: { marginBottom: 32 },
    title: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 28, marginBottom: 8 },
    subtitle: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 13 },
    form: { gap: 16 },
    field: { gap: 6 },
    label: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 10, letterSpacing: 3 },
    input: {
        backgroundColor: '#1e2040', borderWidth: 1, borderColor: '#2e2c4e',
        borderRadius: 4, paddingHorizontal: 16, paddingVertical: 14,
        color: '#f0eefc', fontFamily: 'Montserrat_400Regular', fontSize: 14,
    },
    passwordRow: { position: 'relative' },
    passwordInput: { paddingRight: 48 },
    eyeBtn: { position: 'absolute', right: 14, top: 14 },
    error: { fontFamily: 'Montserrat_400Regular', color: '#f87171', fontSize: 12 },
    submitBtn: { backgroundColor: '#6c63ff', borderRadius: 4, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { fontFamily: 'Montserrat_400Regular', color: '#fff', fontSize: 13, letterSpacing: 3 },
    toggleText: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 13, textAlign: 'center', marginTop: 32 },
})

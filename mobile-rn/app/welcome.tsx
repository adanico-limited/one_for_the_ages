import { useState } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { signInAnon } from '@/lib/firebase'
import { useAuthStore } from '@/store/useAuthStore'
import { apiClient } from '@/lib/api-client'

export default function Welcome() {
    const router = useRouter()
    const { setUser, registerUser } = useAuthStore()
    const [isLoading, setIsLoading] = useState(false)

    const handleGuest = async () => {
        setIsLoading(true)
        try {
            const { user } = await signInAnon()
            setUser(user)
            await registerUser(user)
            router.replace('/')
        } catch (e) {
            console.error(e)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.bg} />

            {/* Logo */}
            <View style={styles.logoWrap}>
                <Image source={require('../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
            </View>

            {/* Headlines */}
            <View style={styles.headlines}>
                <Text style={styles.h2}>Everyone&apos;s an expert...</Text>
                <Text style={[styles.h2, styles.italic]}>until the clock starts.</Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
                <Link href="/login?mode=register" asChild>
                    <TouchableOpacity style={styles.primaryBtn}>
                        <Text style={styles.primaryBtnText}>GET STARTED</Text>
                    </TouchableOpacity>
                </Link>

                <Link href="/login" asChild>
                    <TouchableOpacity style={styles.loginBtn}>
                        <Text style={styles.loginBtnText}>Log In</Text>
                    </TouchableOpacity>
                </Link>

                <TouchableOpacity onPress={handleGuest} disabled={isLoading} style={styles.guestBtn}>
                    {isLoading
                        ? <ActivityIndicator size="small" color="#8884a8" />
                        : <Text style={styles.guestBtnText}>CONTINUE AS GUEST</Text>
                    }
                </TouchableOpacity>

                <Text style={styles.fine}>Upgrade anytime without losing progress.</Text>
            </View>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'space-between', paddingHorizontal: 32 },
    bg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(108,99,255,0.05)' },
    logoWrap: { alignItems: 'center', paddingTop: 24 },
    logo: { width: 160, height: 160, opacity: 0.85 },
    headlines: { gap: 8, alignItems: 'center' },
    h2: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 28, textAlign: 'center', lineHeight: 38 },
    italic: { opacity: 0.9, fontStyle: 'italic' },
    actions: { paddingBottom: 48, alignItems: 'center', gap: 20 },
    primaryBtn: { width: '100%', backgroundColor: '#6c63ff', paddingVertical: 16, borderRadius: 4, alignItems: 'center' },
    primaryBtnText: { fontFamily: 'Montserrat_400Regular', color: '#fff', fontSize: 13, letterSpacing: 2 },
    loginBtn: { alignItems: 'center' },
    loginBtnText: { fontFamily: 'Montserrat_400Regular', color: '#f0eefc', fontSize: 14, textDecorationLine: 'underline' },
    guestBtn: { alignItems: 'center', opacity: 0.7 },
    guestBtnText: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 11, letterSpacing: 3 },
    fine: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 11, textAlign: 'center', marginTop: 16 },
})

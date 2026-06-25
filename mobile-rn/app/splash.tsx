import { useEffect, useState } from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { onAuthChange } from '@/lib/firebase'
import { logger } from '@/lib/logger'
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated'

export default function Splash() {
    const router = useRouter()
    const [statusText, setStatusText] = useState('Initialising session')
    const logoOpacity = useSharedValue(0)
    const subtitleOpacity = useSharedValue(0)

    const logoStyle = useAnimatedStyle(() => ({ opacity: logoOpacity.value }))
    const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }))

    useEffect(() => {
        setTimeout(() => { logoOpacity.value = withTiming(1, { duration: 1000 }) }, 300)
        setTimeout(() => { subtitleOpacity.value = withTiming(0.7, { duration: 1000 }) }, 700)

        const startTime = Date.now()
        const MIN_DURATION = 1500

        const timeoutId = setTimeout(() => {
            logger.warn('Splash timeout reached, redirecting to welcome')
            router.replace('/welcome')
        }, 3000)

        const unsubscribe = onAuthChange(async (user) => {
            if (user) {
                setStatusText('Syncing daily challenge')
                await new Promise(r => setTimeout(r, 600))
                setStatusText('Restoring streak')
            }
            const elapsed = Date.now() - startTime
            if (elapsed < MIN_DURATION) {
                await new Promise(r => setTimeout(r, MIN_DURATION - elapsed))
            }
            clearTimeout(timeoutId)
            router.replace(user ? '/' : '/welcome')
        })

        return () => {
            unsubscribe()
            clearTimeout(timeoutId)
        }
    }, [])

    return (
        <View style={styles.container}>
            <View style={styles.bg} />
            <Animated.View style={[styles.logoWrap, logoStyle]}>
                <Image source={require('../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
            </Animated.View>
            <Animated.View style={[styles.subtitle, subtitleStyle]}>
                <Text style={styles.subtitleText}>One for the Ages</Text>
            </Animated.View>
            <View style={styles.statusRow}>
                <Text style={styles.statusText}>{statusText}</Text>
                <View style={styles.dot} />
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
    bg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
    logoWrap: { alignItems: 'center' },
    logo: { width: 220, height: 220 },
    subtitle: { marginTop: 24 },
    subtitleText: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 15, letterSpacing: 4 },
    statusRow: { position: 'absolute', bottom: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusText: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', opacity: 0.6 },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#6c63ff' },
})

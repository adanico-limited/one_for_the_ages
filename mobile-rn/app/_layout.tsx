import '../global.css'
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useFonts, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display'
import { Montserrat_400Regular } from '@expo-google-fonts/montserrat'
import * as SplashScreen from 'expo-splash-screen'
import { AuthProvider } from '@/components/providers/AuthProvider'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        PlayfairDisplay_700Bold,
        Montserrat_400Regular,
    })

    useEffect(() => {
        if (fontsLoaded) SplashScreen.hideAsync()
    }, [fontsLoaded])

    if (!fontsLoaded) return null

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <AuthProvider>
                    <StatusBar style="light" />
                    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
                        <Stack.Screen name="splash" />
                        <Stack.Screen name="welcome" />
                        <Stack.Screen name="login" />
                        <Stack.Screen name="index" />
                        <Stack.Screen name="categories" />
                        <Stack.Screen name="difficulty" />
                        <Stack.Screen name="leaderboard" />
                        <Stack.Screen name="profile" />
                        <Stack.Screen name="settings" />
                        <Stack.Screen name="game/age-guess" />
                        <Stack.Screen name="game/daily" />
                        <Stack.Screen name="game/whos-older" />
                        <Stack.Screen name="game/reverse" />
                        <Stack.Screen name="game/results" />
                    </Stack>
                </AuthProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    )
}

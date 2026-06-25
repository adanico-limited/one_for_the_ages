import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'

interface AchievementToastProps {
    title: string
    description: string
    isVisible: boolean
    onDismiss: () => void
}

export function AchievementToast({ title, description, isVisible, onDismiss }: AchievementToastProps) {
    const [opacity] = useState(new Animated.Value(0))

    useEffect(() => {
        if (!isVisible || !title) return
        Animated.sequence([
            Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.delay(2800),
            Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start(() => onDismiss())
    }, [isVisible, title])

    if (!isVisible || !title) return null

    return (
        <Animated.View style={[s.toast, { opacity }]}>
            <View style={s.icon}><Text style={s.iconText}>🏆</Text></View>
            <View style={s.textWrap}>
                <Text style={s.titleText}>{title}</Text>
                <Text style={s.descText}>{description}</Text>
            </View>
        </Animated.View>
    )
}

const s = StyleSheet.create({
    toast: {
        position: 'absolute', top: 60, left: 16, right: 16, zIndex: 100,
        backgroundColor: '#252847', borderWidth: 1, borderColor: 'rgba(201,162,39,0.3)',
        borderRadius: 4, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
    },
    icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(201,162,39,0.1)', alignItems: 'center', justifyContent: 'center' },
    iconText: { fontSize: 20 },
    textWrap: { flex: 1 },
    titleText: { fontFamily: 'PlayfairDisplay_700Bold', color: '#c9a227', fontSize: 14, marginBottom: 2 },
    descText: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 11 },
})

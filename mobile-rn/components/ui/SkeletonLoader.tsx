import { View, StyleSheet, Animated } from 'react-native'
import { useEffect, useState } from 'react'

const SkeletonBlock = ({ style }: { style?: any }) => {
    const [anim] = useState(new Animated.Value(0.3))

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(anim, { toValue: 0.8, duration: 700, useNativeDriver: true }),
                Animated.timing(anim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
            ])
        )
        loop.start()
        return () => loop.stop()
    }, [])

    return <Animated.View style={[{ backgroundColor: '#252847', borderRadius: 4 }, style, { opacity: anim }]} />
}

export const GameLoadingSkeleton = () => (
    <View style={s.container}>
        <SkeletonBlock style={{ width: 240, height: 240, borderRadius: 4, marginBottom: 24 }} />
        <SkeletonBlock style={{ width: 180, height: 28, marginBottom: 12 }} />
        <SkeletonBlock style={{ width: 120, height: 16, marginBottom: 40 }} />
        <View style={s.grid}>
            {[0,1,2,3].map(i => (
                <SkeletonBlock key={i} style={{ width: '47%', height: 88 }} />
            ))}
        </View>
    </View>
)

const s = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, width: '100%' },
})

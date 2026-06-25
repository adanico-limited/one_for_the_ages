import { View, StyleSheet } from 'react-native'

interface ProgressBarProps {
    value: number
    max: number
    color?: string
    height?: number
}

export const ProgressBar = ({ value, max, color = '#6c63ff', height = 4 }: ProgressBarProps) => {
    const pct = max > 0 ? Math.min(1, value / max) : 0
    return (
        <View style={[s.track, { height }]}>
            <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: color, height }]} />
        </View>
    )
}

const s = StyleSheet.create({
    track: { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' },
    fill: { borderRadius: 99 },
})

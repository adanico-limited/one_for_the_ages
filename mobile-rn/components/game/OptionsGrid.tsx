import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

interface Option {
    id: string | number
    label: string
    symbol?: string
}

interface OptionsGridProps {
    options: Option[]
    onSelect: (id: string | number) => void
    selectedId?: string | number | null
    correctId?: string | number | null
    disabled?: boolean
}

export const OptionsGrid = ({ options, onSelect, selectedId, correctId, disabled = false }: OptionsGridProps) => {
    return (
        <View style={s.grid}>
            {options.map((option) => {
                const isSelected = selectedId === option.id
                const isCorrect = correctId === option.id
                const isWrong = isSelected && correctId !== null && !isCorrect
                const revealMode = correctId !== null

                let borderColor = '#2e2c4e'
                let opacity: number = 1
                if (revealMode) {
                    if (isCorrect) borderColor = '#22c55e'
                    else if (isWrong) borderColor = '#ef4444'
                    else { borderColor = '#2e2c4e'; opacity = 0.4 }
                } else if (isSelected) {
                    borderColor = '#6c63ff'
                }

                return (
                    <TouchableOpacity
                        key={option.id}
                        style={[s.btn, { borderColor, opacity }]}
                        onPress={() => !disabled && onSelect(option.id)}
                        disabled={disabled}
                        activeOpacity={0.7}
                    >
                        {option.symbol && <Text style={s.symbol}>{option.symbol}</Text>}
                        <Text style={s.label}>{option.label}</Text>
                    </TouchableOpacity>
                )
            })}
        </View>
    )
}

const s = StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    btn: {
        width: '47%', height: 88, backgroundColor: '#1e2040',
        borderWidth: 1, borderRadius: 4,
        alignItems: 'center', justifyContent: 'center', gap: 4,
    },
    symbol: { fontSize: 18, color: '#f0eefc' },
    label: { fontFamily: 'Montserrat_400Regular', color: '#f0eefc', fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' },
})

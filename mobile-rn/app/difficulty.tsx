import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft, Check } from 'lucide-react-native'
import { useDifficultyStore, DifficultyMode, DifficultyLevel } from '@/store/useDifficultyStore'

const LEVELS: { id: DifficultyLevel; label: string; desc: string }[] = [
    { id: 'easy', label: 'Easy', desc: 'Well-known names, wider age options' },
    { id: 'medium', label: 'Medium', desc: 'Moderately famous, tighter options' },
    { id: 'hard', label: 'Hard', desc: 'Obscure picks, answers within 1 year' },
]

export default function DifficultyPage() {
    const router = useRouter()
    const { mode: storedMode, level: storedLevel, setMode, setLevel } = useDifficultyStore()
    const [draftMode, setDraftMode] = useState<DifficultyMode>(storedMode)
    const [draftLevel, setDraftLevel] = useState<DifficultyLevel>(storedLevel)

    const handleConfirm = () => {
        setMode(draftMode)
        setLevel(draftLevel)
        router.back()
    }

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <ArrowLeft size={20} color="#8884a8" />
                </TouchableOpacity>
                <View>
                    <Text style={s.title}>Difficulty</Text>
                    <Text style={s.subtitle}>HOW DO YOU WANT TO BE CHALLENGED?</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={s.scroll}>
                {/* Fixed Mode */}
                <View style={[s.modeCard, draftMode === 'fixed' && s.modeCardActive]}>
                    <TouchableOpacity style={s.modeHeader} onPress={() => setDraftMode('fixed')}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.modeTitle}>Fixed Level</Text>
                            <Text style={s.modeDesc}>Every question matches your chosen difficulty</Text>
                        </View>
                        <View style={[s.radio, draftMode === 'fixed' && s.radioActive]}>
                            {draftMode === 'fixed' && <Check size={10} color="#fff" strokeWidth={3} />}
                        </View>
                    </TouchableOpacity>

                    {draftMode === 'fixed' && (
                        <View style={s.levels}>
                            {LEVELS.map(lvl => (
                                <TouchableOpacity
                                    key={lvl.id}
                                    style={[s.levelRow, draftLevel === lvl.id && s.levelRowActive]}
                                    onPress={() => setDraftLevel(lvl.id)}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={[s.levelLabel, draftLevel === lvl.id && { color: '#6c63ff' }]}>{lvl.label}</Text>
                                        <Text style={s.levelDesc}>{lvl.desc}</Text>
                                    </View>
                                    {draftLevel === lvl.id && <Check size={14} color="#6c63ff" />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* Escalating Mode */}
                <View style={[s.modeCard, draftMode === 'escalating' && s.modeCardActive]}>
                    <TouchableOpacity style={s.modeHeader} onPress={() => setDraftMode('escalating')}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.modeTitle}>Escalating</Text>
                            <Text style={s.modeDesc}>Starts easy, gets harder as you go</Text>
                        </View>
                        <View style={[s.radio, draftMode === 'escalating' && s.radioActive]}>
                            {draftMode === 'escalating' && <Check size={10} color="#fff" strokeWidth={3} />}
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <View style={s.footer}>
                <TouchableOpacity style={s.confirmBtn} onPress={handleConfirm}>
                    <Text style={s.confirmBtnText}>CONFIRM</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    )
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#1a1a2e' },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
    title: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 18 },
    subtitle: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 9, letterSpacing: 3, marginTop: 2 },
    scroll: { padding: 20, gap: 12, paddingBottom: 120 },
    modeCard: { backgroundColor: '#252847', borderWidth: 1, borderColor: '#2e2c4e', borderRadius: 4, overflow: 'hidden' },
    modeCardActive: { borderColor: '#6c63ff', backgroundColor: 'rgba(108,99,255,0.03)' },
    modeHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
    modeTitle: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 15 },
    modeDesc: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 11, marginTop: 2 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#2e2c4e', alignItems: 'center', justifyContent: 'center' },
    radioActive: { borderColor: '#6c63ff', backgroundColor: '#6c63ff' },
    levels: { borderTopWidth: 1, borderTopColor: 'rgba(108,99,255,0.1)', paddingHorizontal: 20, paddingVertical: 8, gap: 4 },
    levelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4 },
    levelRowActive: {},
    levelLabel: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 13 },
    levelDesc: { fontFamily: 'Montserrat_400Regular', color: '#4a4870', fontSize: 10, marginTop: 2 },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#1a1a2e', borderTopWidth: 1, borderTopColor: '#2e2c4e' },
    confirmBtn: { backgroundColor: '#6c63ff', borderRadius: 4, paddingVertical: 16, alignItems: 'center' },
    confirmBtnText: { fontFamily: 'Montserrat_400Regular', color: '#fff', fontSize: 12, letterSpacing: 3 },
})

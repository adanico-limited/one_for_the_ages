import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native'
import { Lightbulb } from 'lucide-react-native'

interface HintModalProps {
    hint: string
    onClose: () => void
    onUseHint: () => void
    isDaily?: boolean
}

export function HintModal({ hint, onClose, onUseHint, isDaily = false }: HintModalProps) {
    const [step, setStep] = useState<'confirm' | 'reveal'>('confirm')
    const penalty = isDaily ? 30 : 20

    const handleConfirm = () => {
        onUseHint()
        setStep('reveal')
    }

    return (
        <Modal transparent animationType="fade" visible>
            <View style={s.backdrop}>
                <View style={s.card}>
                    <View style={s.topBorder} />

                    <View style={s.iconWrap}>
                        <Lightbulb size={24} color="#6c63ff" />
                    </View>

                    <Text style={s.title}>{step === 'confirm' ? 'HINT' : 'HINT REVEALED'}</Text>

                    {step === 'confirm' ? (
                        <Text style={s.body}>
                            Using a hint reduces this question's score by{' '}
                            <Text style={s.penalty}>{penalty}%</Text>.{'\n\n'}Continue?
                        </Text>
                    ) : (
                        <View style={s.revealWrap}>
                            <Text style={s.hintText}>"{hint}"</Text>
                            <Text style={s.penaltyNote}>Score reduced by {penalty}%</Text>
                        </View>
                    )}

                    <View style={s.btnRow}>
                        {step === 'confirm' ? (
                            <>
                                <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
                                    <Text style={s.cancelText}>CANCEL</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={s.useBtn} onPress={handleConfirm}>
                                    <Text style={s.useBtnText}>USE HINT</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <TouchableOpacity style={[s.useBtn, { flex: 1 }]} onPress={onClose}>
                                <Text style={s.useBtnText}>GOT IT</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    )
}

const s = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
    card: { backgroundColor: '#252847', borderWidth: 1, borderColor: 'rgba(108,99,255,0.2)', borderRadius: 4, padding: 24, gap: 20, overflow: 'hidden', alignItems: 'center' },
    topBorder: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(108,99,255,0.5)' },
    iconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(108,99,255,0.1)', alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 22 },
    body: { fontFamily: 'PlayfairDisplay_700Bold', color: '#8884a8', fontSize: 16, textAlign: 'center', lineHeight: 26 },
    penalty: { color: '#fbbf24' },
    revealWrap: { alignItems: 'center', gap: 12, width: '100%' },
    hintText: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 17, fontStyle: 'italic', textAlign: 'center', lineHeight: 28, paddingHorizontal: 8, paddingVertical: 12, borderLeftWidth: 2, borderColor: 'rgba(108,99,255,0.3)', backgroundColor: 'rgba(108,99,255,0.05)', borderRadius: 2, alignSelf: 'stretch' },
    penaltyNote: { fontFamily: 'Montserrat_400Regular', color: '#fbbf24', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' },
    btnRow: { flexDirection: 'row', gap: 10, width: '100%' },
    cancelBtn: { flex: 1, paddingVertical: 16, alignItems: 'center' },
    cancelText: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 12, letterSpacing: 3 },
    useBtn: { flex: 1, backgroundColor: '#6c63ff', borderRadius: 4, paddingVertical: 16, alignItems: 'center' },
    useBtnText: { fontFamily: 'Montserrat_400Regular', color: '#fff', fontSize: 12, letterSpacing: 3 },
})

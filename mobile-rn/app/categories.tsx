import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft, Check, ChevronDown } from 'lucide-react-native'
import { CATEGORIES, getCategoryLabel } from '@/lib/categories'
import { useCategoryStore } from '@/store/useCategoryStore'

export default function CategoriesPage() {
    const router = useRouter()
    const { selected, toggle, clear } = useCategoryStore()
    const [expanded, setExpanded] = useState<string[]>(['sports', 'tv_film', 'music'])
    const [draft, setDraft] = useState<string[]>(selected)

    const toggleDraft = (id: string) => {
        setDraft(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
    }

    const toggleSection = (id: string) => {
        setExpanded(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
    }

    const handleConfirm = () => {
        useCategoryStore.setState({ selected: draft })
        router.back()
    }

    return (
        <SafeAreaView style={s.safe}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <ArrowLeft size={20} color="#8884a8" />
                </TouchableOpacity>
                <View>
                    <Text style={s.title}>Categories</Text>
                    <Text style={s.subtitle}>SELECT WHAT YOU WANT TO BE QUIZZED ON</Text>
                </View>
            </View>

            {draft.length > 0 && (
                <TouchableOpacity style={s.clearBtn} onPress={() => setDraft([])}>
                    <Text style={s.clearBtnText}>CLEAR ALL</Text>
                </TouchableOpacity>
            )}

            <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll}>
                {CATEGORIES.map((cat) => {
                    const isOpen = expanded.includes(cat.id)
                    const selectedCount = cat.subcategories.filter(s => s.available && draft.includes(s.id)).length
                    const availableCount = cat.subcategories.filter(s => s.available).length

                    return (
                        <View key={cat.id} style={s.section}>
                            <TouchableOpacity style={s.sectionHeader} onPress={() => toggleSection(cat.id)}>
                                <View style={s.sectionHeaderLeft}>
                                    <Text style={s.sectionTitle}>{cat.label}</Text>
                                    {selectedCount > 0 && (
                                        <View style={s.badge}>
                                            <Text style={s.badgeText}>{selectedCount}/{availableCount}</Text>
                                        </View>
                                    )}
                                </View>
                                <ChevronDown size={16} color="#8884a8" style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }} />
                            </TouchableOpacity>

                            {isOpen && (
                                <View style={s.subList}>
                                    {cat.subcategories.filter(s => s.available).map(sub => {
                                        const isSelected = draft.includes(sub.id)
                                        return (
                                            <TouchableOpacity
                                                key={sub.id}
                                                style={[s.subItem, isSelected && s.subItemActive]}
                                                onPress={() => toggleDraft(sub.id)}
                                            >
                                                <Text style={[s.subLabel, isSelected && s.subLabelActive]}>{sub.label}</Text>
                                                {isSelected && <Check size={14} color="#6c63ff" />}
                                            </TouchableOpacity>
                                        )
                                    })}
                                </View>
                            )}
                        </View>
                    )
                })}
            </ScrollView>

            <View style={s.footer}>
                <TouchableOpacity style={s.confirmBtn} onPress={handleConfirm}>
                    <Text style={s.confirmBtnText}>
                        {draft.length === 0 ? 'PLAY ALL' : `CONFIRM  •  ${getCategoryLabel(draft)}`}
                    </Text>
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
    clearBtn: { alignSelf: 'flex-end', marginRight: 20, marginBottom: 4 },
    clearBtnText: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 9, letterSpacing: 3 },
    scroll: { paddingHorizontal: 20, paddingBottom: 100, gap: 10 },
    section: { backgroundColor: '#252847', borderWidth: 1, borderColor: 'rgba(201,162,39,0.1)', borderRadius: 4, overflow: 'hidden' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
    sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    sectionTitle: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 15 },
    badge: { backgroundColor: 'rgba(108,99,255,0.2)', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
    badgeText: { fontFamily: 'Montserrat_400Regular', color: '#6c63ff', fontSize: 9, letterSpacing: 2 },
    subList: { borderTopWidth: 1, borderTopColor: '#2e2c4e', paddingHorizontal: 20, paddingVertical: 8, gap: 4 },
    subItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4 },
    subItemActive: {},
    subLabel: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 13 },
    subLabelActive: { color: '#6c63ff' },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#1a1a2e', borderTopWidth: 1, borderTopColor: '#2e2c4e' },
    confirmBtn: { backgroundColor: '#6c63ff', borderRadius: 4, paddingVertical: 16, alignItems: 'center' },
    confirmBtnText: { fontFamily: 'Montserrat_400Regular', color: '#fff', fontSize: 12, letterSpacing: 3 },
})

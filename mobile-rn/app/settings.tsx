import { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, ActivityIndicator, Switch, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft } from 'lucide-react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'
import { useAuthStore } from '@/store/useAuthStore'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { signOut, auth } from '@/lib/firebase'
import { sounds } from '@/lib/sounds'
import { haptics } from '@/lib/haptics'

export default function SettingsPage() {
    const router = useRouter()
    const { isAuthenticated, oftaUser, logout } = useAuthStore()
    const [displayName, setDisplayName] = useState(oftaUser?.display_name || '')
    const [isSaving, setIsSaving] = useState(false)
    const [saveMsg, setSaveMsg] = useState<string | null>(null)
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [hapticsEnabled, setHapticsEnabled] = useState(true)

    useEffect(() => {
        AsyncStorage.getItem('ofta-settings').then(val => {
            if (val) {
                try {
                    const p = JSON.parse(val)
                    setSoundEnabled(p.sound !== false)
                    setHapticsEnabled(p.haptics !== false)
                } catch {}
            }
        })
    }, [])

    const saveSettings = async (key: string, value: boolean) => {
        const current = await AsyncStorage.getItem('ofta-settings')
        const parsed = current ? JSON.parse(current) : {}
        await AsyncStorage.setItem('ofta-settings', JSON.stringify({ ...parsed, [key]: value }))
        if (key === 'sound') sounds.setEnabled(value)
        if (key === 'haptics') haptics.setEnabled(value)
    }

    const handleSave = async () => {
        setIsSaving(true)
        setSaveMsg(null)
        try {
            await apiClient.updateProfile({ display_name: displayName })
            setSaveMsg('Profile saved!')
        } catch {
            setSaveMsg('Failed to save')
        }
        setIsSaving(false)
    }

    const handleLogout = async () => {
        try {
            await signOut()
            logout()
            router.replace('/')
        } catch (error) {
            logger.error('Logout failed:', error)
        }
    }

    const handleDeleteAccount = () => {
        Alert.alert('Delete Account', 'This will permanently delete your account and all progress. This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try {
                        await apiClient.deleteAccount()
                        await signOut()
                        logout()
                        router.replace('/')
                    } catch (error) {
                        logger.error('Delete failed:', error)
                        Alert.alert('Error', 'Failed to delete account. Please try again.')
                    }
                }
            }
        ])
    }

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <ArrowLeft size={18} color="#8884a8" />
                </TouchableOpacity>
                <Text style={s.title}>Settings</Text>
                <View style={{ width: 18 }} />
            </View>

            <ScrollView contentContainerStyle={s.scroll}>
                {/* Profile */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>PROFILE</Text>
                    <View style={s.field}>
                        <Text style={s.fieldLabel}>DISPLAY NAME</Text>
                        <TextInput
                            style={s.input}
                            value={displayName}
                            onChangeText={setDisplayName}
                            placeholder="Your display name"
                            placeholderTextColor="#4a4870"
                        />
                    </View>
                    {saveMsg && <Text style={[s.saveMsg, saveMsg.includes('Failed') && { color: '#f87171' }]}>{saveMsg}</Text>}
                    <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={isSaving}>
                        {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>SAVE PROFILE</Text>}
                    </TouchableOpacity>
                </View>

                {/* Preferences */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>PREFERENCES</Text>
                    <View style={s.toggle}>
                        <Text style={s.toggleLabel}>Sound Effects</Text>
                        <Switch
                            value={soundEnabled}
                            onValueChange={v => { setSoundEnabled(v); saveSettings('sound', v) }}
                            trackColor={{ true: '#6c63ff', false: '#2e2c4e' }}
                            thumbColor="#f0eefc"
                        />
                    </View>
                    <View style={s.toggle}>
                        <Text style={s.toggleLabel}>Haptic Feedback</Text>
                        <Switch
                            value={hapticsEnabled}
                            onValueChange={v => { setHapticsEnabled(v); saveSettings('haptics', v) }}
                            trackColor={{ true: '#6c63ff', false: '#2e2c4e' }}
                            thumbColor="#f0eefc"
                        />
                    </View>
                </View>

                {/* Account */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>ACCOUNT</Text>
                    <TouchableOpacity style={s.dangerBtn} onPress={handleLogout}>
                        <Text style={s.dangerBtnText}>SIGN OUT</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.dangerBtn, { marginTop: 8, borderColor: 'rgba(239,68,68,0.3)' }]} onPress={handleDeleteAccount}>
                        <Text style={[s.dangerBtnText, { color: '#ef4444' }]}>DELETE ACCOUNT</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#1a1a2e' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
    title: { fontFamily: 'PlayfairDisplay_700Bold', color: '#f0eefc', fontSize: 18 },
    scroll: { padding: 20, gap: 24 },
    section: { gap: 12 },
    sectionTitle: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 9, letterSpacing: 4 },
    field: { gap: 6 },
    fieldLabel: { fontFamily: 'Montserrat_400Regular', color: '#8884a8', fontSize: 10, letterSpacing: 3 },
    input: { backgroundColor: '#1e2040', borderWidth: 1, borderColor: '#2e2c4e', borderRadius: 4, paddingHorizontal: 16, paddingVertical: 14, color: '#f0eefc', fontFamily: 'Montserrat_400Regular', fontSize: 14 },
    saveMsg: { fontFamily: 'Montserrat_400Regular', color: '#4ade80', fontSize: 12 },
    saveBtn: { backgroundColor: '#6c63ff', borderRadius: 4, paddingVertical: 14, alignItems: 'center' },
    saveBtnText: { fontFamily: 'Montserrat_400Regular', color: '#fff', fontSize: 12, letterSpacing: 3 },
    toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2e2c4e' },
    toggleLabel: { fontFamily: 'Montserrat_400Regular', color: '#f0eefc', fontSize: 14 },
    dangerBtn: { borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)', borderRadius: 4, paddingVertical: 14, alignItems: 'center' },
    dangerBtnText: { fontFamily: 'Montserrat_400Regular', color: '#f87171', fontSize: 12, letterSpacing: 3 },
})

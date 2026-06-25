import AsyncStorage from '@react-native-async-storage/async-storage'
import { StateStorage } from 'zustand/middleware'

export const zustandStorage: StateStorage = {
    getItem: async (name) => (await AsyncStorage.getItem(name)) ?? null,
    setItem: async (name, value) => { await AsyncStorage.setItem(name, value) },
    removeItem: async (name) => { await AsyncStorage.removeItem(name) },
}

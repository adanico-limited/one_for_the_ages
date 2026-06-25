import * as ExpoHaptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'

export enum ImpactStyle {
    Heavy = 'Heavy',
    Medium = 'Medium',
    Light = 'Light',
}

class HapticsManager {
    private enabled: boolean = true

    constructor() {
        AsyncStorage.getItem('ofta-settings').then((val) => {
            if (val) {
                try {
                    const parsed = JSON.parse(val)
                    this.enabled = parsed.haptics !== false
                } catch {}
            }
        })
    }

    setEnabled(enabled: boolean) {
        this.enabled = enabled
    }

    async impact(style: ImpactStyle) {
        if (!this.enabled) return
        try {
            switch (style) {
                case ImpactStyle.Heavy:
                    await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Heavy)
                    break
                case ImpactStyle.Medium:
                    await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Medium)
                    break
                case ImpactStyle.Light:
                    await ExpoHaptics.impactAsync(ExpoHaptics.ImpactFeedbackStyle.Light)
                    break
            }
        } catch {}
    }
}

export const haptics = new HapticsManager()

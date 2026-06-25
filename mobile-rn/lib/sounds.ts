import AsyncStorage from '@react-native-async-storage/async-storage'

type SoundName = 'correct' | 'wrong' | 'streak' | 'tick' | 'complete' | 'tap'

class SoundManager {
    private enabled: boolean = true

    constructor() {
        AsyncStorage.getItem('ofta-settings').then((val) => {
            if (val) {
                try {
                    const parsed = JSON.parse(val)
                    this.enabled = parsed.sound !== false
                } catch {}
            }
        })
    }

    setEnabled(enabled: boolean) {
        this.enabled = enabled
    }

    // React Native doesn't have Web Audio API.
    // Sounds are non-critical — haptics provide tactile feedback instead.
    // To add real sounds: place .mp3 files in assets/sounds/ and use expo-av.
    play(_sound: SoundName) {}
}

export const sounds = new SoundManager()

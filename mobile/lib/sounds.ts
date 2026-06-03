/**
 * Sound effects via Web Audio API — no audio files required.
 * Reads enabled state from localStorage settings.
 */

type SoundName = 'correct' | 'wrong' | 'streak' | 'tick' | 'complete' | 'tap'

class SoundManager {
  private enabled: boolean = true
  private ctx: AudioContext | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const settings = localStorage.getItem('ofta-settings')
        if (settings) {
          const parsed = JSON.parse(settings)
          this.enabled = parsed.sound !== false
        }
      } catch {
        // ignore
      }
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
  }

  private getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext()
      } catch {
        return null
      }
    }
    return this.ctx
  }

  private tone(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.3) {
    const ctx = this.getCtx()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()

    osc.connect(gainNode)
    gainNode.connect(ctx.destination)

    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)

    gainNode.gain.setValueAtTime(gain, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  }

  play(sound: SoundName) {
    if (!this.enabled) return
    try {
      switch (sound) {
        case 'correct':
          this.tone(523, 0.08, 'sine', 0.3)   // C5
          setTimeout(() => this.tone(659, 0.12, 'sine', 0.3), 80)  // E5
          break
        case 'wrong':
          this.tone(200, 0.15, 'sawtooth', 0.2)
          setTimeout(() => this.tone(150, 0.2, 'sawtooth', 0.15), 100)
          break
        case 'streak':
          this.tone(523, 0.06, 'sine', 0.25)
          setTimeout(() => this.tone(659, 0.06, 'sine', 0.25), 60)
          setTimeout(() => this.tone(784, 0.12, 'sine', 0.3), 120)
          break
        case 'tick':
          this.tone(880, 0.04, 'square', 0.1)
          break
        case 'complete':
          this.tone(523, 0.1, 'sine', 0.3)
          setTimeout(() => this.tone(659, 0.1, 'sine', 0.3), 100)
          setTimeout(() => this.tone(784, 0.1, 'sine', 0.3), 200)
          setTimeout(() => this.tone(1046, 0.25, 'sine', 0.35), 300)
          break
        case 'tap':
          this.tone(440, 0.05, 'sine', 0.15)
          break
      }
    } catch {
      // Silently fail — sounds are non-critical
    }
  }
}

export const sounds = new SoundManager()

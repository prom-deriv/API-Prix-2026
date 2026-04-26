/**
 * Sound Manager for Surf the Waves Game
 * Uses Web Audio API for programmatic sound generation
 */

class SoundManager {
  private audioContext: AudioContext | null = null
  private masterGain: GainNode | null = null
  private isEnabled: boolean = true
  private volume: number = 0.3

  constructor() {
    this.initialize()
  }

  private initialize() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.masterGain = this.audioContext.createGain()
      this.masterGain.connect(this.audioContext.destination)
      this.masterGain.gain.value = this.volume
      this.setupInteractionUnlock()
    } catch (err) {
      console.warn("[SoundManager] Web Audio API not available:", err)
    }
  }

  private setupInteractionUnlock() {
    const unlock = () => {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().then(() => {
          console.log("[SoundManager] AudioContext unlocked successfully")
        })
      }
      // Remove listeners once unlocked
      document.removeEventListener('click', unlock)
      document.removeEventListener('keydown', unlock)
      document.removeEventListener('touchstart', unlock)
    }

    document.addEventListener('click', unlock)
    document.addEventListener('keydown', unlock)
    document.addEventListener('touchstart', unlock)
  }

  private ensureContext() {
    if (!this.audioContext || !this.masterGain) return false
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }
    return true
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume))
    if (this.masterGain) {
      this.masterGain.gain.value = this.volume
    }
  }

  getVolume(): number {
    return this.volume
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled
    if (this.masterGain) {
      this.masterGain.gain.value = enabled ? this.volume : 0
    }
  }

  isAudioEnabled(): boolean {
    return this.isEnabled
  }

  /**
   * Play ocean wave ambient sound (continuous loop)
   */
  playOceanAmbient(): (() => void) | null {
    if (!this.ensureContext() || !this.isEnabled) return null

    try {
      const ctx = this.audioContext!
      const audio = new Audio('/Surf Waves/Wave sound.mp3')
      audio.loop = true
      
      const source = ctx.createMediaElementSource(audio)
      const gain = ctx.createGain()
      
      // Subtle volume for ambient sound
      gain.gain.value = 0.5

      source.connect(gain)
      gain.connect(this.masterGain!)

      let cleanupDone = false;

      const playAudio = () => {
        if (cleanupDone) return;
        audio.play().then(() => {
          console.log("[SoundManager] Ocean ambient started successfully")
        }).catch(err => {
          console.warn("[SoundManager] Autoplay prevented for ocean ambient:", err)
          // Retry on first interaction
          const retryPlay = () => {
            if (cleanupDone) return;
            audio.play().then(() => {
              console.log("[SoundManager] Ocean ambient started successfully on retry")
            }).catch(console.warn);
            document.removeEventListener('click', retryPlay);
            document.removeEventListener('keydown', retryPlay);
            document.removeEventListener('touchstart', retryPlay);
          };
          document.addEventListener('click', retryPlay);
          document.addEventListener('keydown', retryPlay);
          document.addEventListener('touchstart', retryPlay);
        })
      };

      playAudio();

      // Return cleanup function
      return () => {
        cleanupDone = true;
        try {
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
          setTimeout(() => {
            audio.pause()
            audio.currentTime = 0
            source.disconnect()
            console.log("[SoundManager] Ocean ambient stopped")
          }, 500)
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    } catch (err) {
      console.warn("[SoundManager] Failed to play ocean ambient:", err)
      return null
    }
  }

  /**
   * Play wave crash sound
   */
  playWaveCrash() {
    if (!this.ensureContext() || !this.isEnabled) return

    try {
      const ctx = this.audioContext!
      const noise = ctx.createBufferSource()
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      
      // Generate white noise for wave crash
      for (let i = 0; i < buffer.length; i++) {
        data[i] = Math.random() * 2 - 1
      }
      
      noise.buffer = buffer
      
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 2000
      filter.Q.value = 1
      
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      
      noise.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain!)
      
      noise.start()
      noise.stop(ctx.currentTime + 0.5)
    } catch (err) {
      console.warn("[SoundManager] Failed to play wave crash:", err)
    }
  }

  /**
   * Play power-up collection sound
   */
  playPowerUpCollect() {
    if (!this.ensureContext() || !this.isEnabled) return

    try {
      const ctx = this.audioContext!
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(800, ctx.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1)

      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)

      oscillator.connect(gain)
      gain.connect(this.masterGain!)

      oscillator.start()
      oscillator.stop(ctx.currentTime + 0.2)
    } catch (err) {
      console.warn("[SoundManager] Failed to play power-up sound:", err)
    }
  }

  /**
   * Play trick performance sound
   */
  playTrick(intensity: number = 1) {
    if (!this.ensureContext() || !this.isEnabled) return

    try {
      const ctx = this.audioContext!
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()

      oscillator.type = 'sawtooth'
      const baseFreq = 200 + (intensity * 100)
      oscillator.frequency.setValueAtTime(baseFreq, ctx.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(baseFreq * 2, ctx.currentTime + 0.15)

      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)

      oscillator.connect(gain)
      gain.connect(this.masterGain!)

      oscillator.start()
      oscillator.stop(ctx.currentTime + 0.15)
    } catch (err) {
      console.warn("[SoundManager] Failed to play trick sound:", err)
    }
  }

  /**
   * Play combo sound with increasing pitch
   */
  playCombo(comboLevel: number) {
    if (!this.ensureContext() || !this.isEnabled) return

    try {
      const ctx = this.audioContext!
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()

      oscillator.type = 'square'
      const frequency = 400 + (comboLevel * 50)
      oscillator.frequency.value = frequency

      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)

      oscillator.connect(gain)
      gain.connect(this.masterGain!)

      oscillator.start()
      oscillator.stop(ctx.currentTime + 0.1)
    } catch (err) {
      console.warn("[SoundManager] Failed to play combo sound:", err)
    }
  }

  /**
   * Play session start sound
   */
  playSessionStart() {
    if (!this.ensureContext() || !this.isEnabled) return

    try {
      const ctx = this.audioContext!
      
      // Play a rising tone sequence
      const frequencies = [400, 500, 600, 800]
      frequencies.forEach((freq, index) => {
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()

        oscillator.type = 'sine'
        oscillator.frequency.value = freq

        const startTime = ctx.currentTime + (index * 0.08)
        gain.gain.setValueAtTime(0.2, startTime)
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15)

        oscillator.connect(gain)
        gain.connect(this.masterGain!)

        oscillator.start(startTime)
        oscillator.stop(startTime + 0.15)
      })
    } catch (err) {
      console.warn("[SoundManager] Failed to play session start sound:", err)
    }
  }

  /**
   * Play session end sound
   */
  playSessionEnd(success: boolean) {
    if (!this.ensureContext() || !this.isEnabled) return

    try {
      const ctx = this.audioContext!
      
      if (success) {
        // Victory fanfare
        const frequencies = [600, 800, 1000, 1200]
        frequencies.forEach((freq, index) => {
          const oscillator = ctx.createOscillator()
          const gain = ctx.createGain()

          oscillator.type = 'sine'
          oscillator.frequency.value = freq

          const startTime = ctx.currentTime + (index * 0.1)
          gain.gain.setValueAtTime(0.25, startTime)
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3)

          oscillator.connect(gain)
          gain.connect(this.masterGain!)

          oscillator.start(startTime)
          oscillator.stop(startTime + 0.3)
        })
      } else {
        // Wipeout sound
        const oscillator = ctx.createOscillator()
        const gain = ctx.createGain()

        oscillator.type = 'sawtooth'
        oscillator.frequency.setValueAtTime(400, ctx.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5)

        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)

        oscillator.connect(gain)
        gain.connect(this.masterGain!)

        oscillator.start()
        oscillator.stop(ctx.currentTime + 0.5)
      }
    } catch (err) {
      console.warn("[SoundManager] Failed to play session end sound:", err)
    }
  }

  /**
   * Play peaceful ambient sound (continuous loop)
   */
  playPeacefulAmbient(): (() => void) | null {
    if (!this.ensureContext() || !this.isEnabled) return null

    try {
      const ctx = this.audioContext!
      const ambientGain = ctx.createGain()
      ambientGain.gain.value = 0.001
      ambientGain.connect(this.masterGain!)
      
      // Gentle fade in
      ambientGain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 2)

      // C Major 7 chord frequencies (C, E, G, B) down an octave
      const frequencies = [130.81, 164.81, 196.00, 246.94]
      const oscillators: OscillatorNode[] = []

      frequencies.forEach(freq => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        
        osc.type = 'sine'
        osc.frequency.value = freq
        
        gain.gain.value = 0.25 // Soft volume per note

        osc.connect(gain)
        gain.connect(ambientGain)
        
        osc.start()
        oscillators.push(osc)
        
        // Add gentle chorus effect with LFO
        const lfo = ctx.createOscillator()
        const lfoGain = ctx.createGain()
        lfo.frequency.value = 0.1 + (Math.random() * 0.2)
        lfoGain.gain.value = 2
        lfo.connect(lfoGain)
        lfoGain.connect(osc.frequency)
        lfo.start()
        oscillators.push(lfo)
      })

      return () => {
        try {
          ambientGain.gain.cancelScheduledValues(ctx.currentTime)
          ambientGain.gain.setValueAtTime(ambientGain.gain.value, ctx.currentTime)
          ambientGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1)
          setTimeout(() => {
            oscillators.forEach(osc => osc.stop())
            ambientGain.disconnect()
          }, 1000)
        } catch (e) {}
      }
    } catch (err) {
      console.warn("[SoundManager] Failed to play peaceful ambient sound:", err)
      return null
    }
  }

  /**
   * Play engine revving sound for racing
   */
  playEngineRev() {
    if (!this.ensureContext() || !this.isEnabled) return

    try {
      const ctx = this.audioContext!
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()

      oscillator.type = 'sawtooth'
      oscillator.frequency.setValueAtTime(60, ctx.currentTime) // Low idle
      oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.5) // Rev up
      oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 1.0) // Drop

      gain.gain.setValueAtTime(0.2, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0)

      oscillator.connect(gain)
      gain.connect(this.masterGain!)

      oscillator.start()
      oscillator.stop(ctx.currentTime + 1.0)
    } catch (err) {
      console.warn("[SoundManager] Failed to play engine rev sound:", err)
    }
  }

  /**
   * Play continuous engine driving sound
   */
  playEngineDriving(): (() => void) | null {
    if (!this.ensureContext() || !this.isEnabled) return null

    try {
      const ctx = this.audioContext!
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      const filter = ctx.createBiquadFilter()

      oscillator.type = 'sawtooth'
      oscillator.frequency.value = 120 // Mid rumble

      filter.type = 'lowpass'
      filter.frequency.value = 800
      filter.Q.value = 1

      gain.gain.value = 0.1 // Subtle volume

      oscillator.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain!)

      oscillator.start()

      // LFO for engine purr
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      lfo.frequency.value = 15 // Purr speed
      lfoGain.gain.value = 10
      lfo.connect(lfoGain)
      lfoGain.connect(oscillator.frequency)
      lfo.start()

      return () => {
        try {
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
          setTimeout(() => {
            oscillator.stop()
            lfo.stop()
          }, 500)
        } catch (e) {}
      }
    } catch (err) {
      console.warn("[SoundManager] Failed to play engine driving sound:", err)
      return null
    }
  }

  /**
   * Play heartbeat sound for chart ticks
   */
  playHeartbeat() {
    if (!this.ensureContext() || !this.isEnabled) return

    try {
      const ctx = this.audioContext!
      
      // Heartbeat consists of two distinct beats: "lub" and "dub"
      // "lub" - first beat
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(50, ctx.currentTime) // Low frequency thud
      osc1.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.1)
      
      gain1.gain.setValueAtTime(0, ctx.currentTime)
      gain1.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.02) // Quick attack
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1) // Quick decay

      osc1.connect(gain1)
      gain1.connect(this.masterGain!)
      
      osc1.start(ctx.currentTime)
      osc1.stop(ctx.currentTime + 0.15)
      
      // "dub" - second beat
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(60, ctx.currentTime + 0.2) // Slightly higher frequency
      osc2.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3)
      
      gain2.gain.setValueAtTime(0, ctx.currentTime + 0.2)
      gain2.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.22) // Quick attack
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3) // Quick decay

      osc2.connect(gain2)
      gain2.connect(this.masterGain!)
      
      osc2.start(ctx.currentTime + 0.2)
      osc2.stop(ctx.currentTime + 0.35)

    } catch (err) {
      console.warn("[SoundManager] Failed to play heartbeat sound:", err)
    }
  }

  /**
   * Play whoosh sound for surfing or overtaking
   */
  playWhoosh() {
    if (!this.ensureContext() || !this.isEnabled) return

    try {
      const ctx = this.audioContext!
      const noise = ctx.createBufferSource()
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      
      // Generate white noise
      for (let i = 0; i < buffer.length; i++) {
        data[i] = Math.random() * 2 - 1
      }
      
      noise.buffer = buffer
      
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 1000
      filter.Q.value = 1
      
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
      
      noise.connect(filter)
      filter.connect(gain)
      gain.connect(this.masterGain!)
      
      noise.start()
      noise.stop(ctx.currentTime + 0.3)
    } catch (err) {
      console.warn("[SoundManager] Failed to play whoosh sound:", err)
    }
  }
}

// Singleton instance
let soundManagerInstance: SoundManager | null = null

export function getSoundManager(): SoundManager {
  if (!soundManagerInstance) {
    soundManagerInstance = new SoundManager()
  }
  return soundManagerInstance
}

export default SoundManager

import React, { createContext, useContext, useState, useCallback, useEffect } from "react"
import { getSoundManager } from "../utils/soundManager"

export interface SurfSession {
  id: string
  timestamp: number
  symbol: string
  startPrice: number
  endPrice: number | null
  duration: number // in seconds
  score: number
  maxCombo: number
  powerUpsCollected: number
  tricksPerformed: number
  status: "riding" | "wiped" | "finished"
  contractId?: string
  // Trading info
  stake?: number
  prediction?: "UP" | "DOWN"
  targetDuration?: number
  profitLoss?: number
}

export interface PowerUp {
  id: string
  type: "rsi" | "macd" | "volatility"
  position: number
  points: number
  collected: boolean
}

export type SurferState = "idle" | "riding" | "trick" | "wipeout" | "celebrate"

interface SurfState {
  sessions: SurfSession[]
  currentSession: SurfSession | null
  surferState: SurferState
  currentScore: number
  currentCombo: number
  maxCombo: number
  powerUps: PowerUp[]
  totalWaves: number
  bestRide: number
  surfPoints: number
}

interface SurfContextType extends SurfState {
  startSession: (symbol: string, startPrice: number, stake?: number, options?: { contractId?: string, prediction?: "UP" | "DOWN", targetDuration?: number }) => string
  endSession: (sessionId: string, endPrice: number, status: "wiped" | "finished", profitLoss?: number) => void
  updateScore: (points: number) => void
  addCombo: () => void
  resetCombo: () => void
  setSurferState: (state: SurferState) => void
  collectPowerUp: (powerUpId: string) => void
  addPowerUp: (powerUp: Omit<PowerUp, "id" | "collected">) => void
  performTrick: (points: number) => void
  clearSurfHistory: () => void
  getLeaderboard: () => SurfSession[]
}

const STORAGE_KEY = "promo-trade-surf-waves"

const SurfContext = createContext<SurfContextType | null>(null)

function loadFromStorage(): SurfState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        sessions: parsed.sessions || [],
        currentSession: null,
        surferState: "idle",
        currentScore: 0,
        currentCombo: 0,
        maxCombo: parsed.maxCombo || 0,
        powerUps: [],
        totalWaves: parsed.totalWaves || 0,
        bestRide: parsed.bestRide || 0,
        surfPoints: parsed.surfPoints || 0,
      }
    }
  } catch (err) {
    console.warn("[SurfContext] Failed to load from storage:", err)
  }
  return {
    sessions: [],
    currentSession: null,
    surferState: "idle",
    currentScore: 0,
    currentCombo: 0,
    maxCombo: 0,
    powerUps: [],
    totalWaves: 0,
    bestRide: 0,
    surfPoints: 0,
  }
}

function saveToStorage(state: SurfState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sessions: state.sessions.slice(0, 100), // Keep last 100 sessions
      maxCombo: state.maxCombo,
      totalWaves: state.totalWaves,
      bestRide: state.bestRide,
      surfPoints: state.surfPoints,
    }))
  } catch (err) {
    console.warn("[SurfContext] Failed to save to storage:", err)
  }
}

export function SurfProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SurfState>(loadFromStorage)

  // Persist to localStorage whenever state changes
  useEffect(() => {
    saveToStorage(state)
  }, [state])

  const startSession = useCallback((symbol: string, startPrice: number, stake: number = 0, options?: { contractId?: string, prediction?: "UP" | "DOWN", targetDuration?: number }): string => {
    const id = options?.contractId ? `surf-${options.contractId}` : `surf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const newSession: SurfSession = {
      id,
      timestamp: Date.now(),
      symbol,
      startPrice,
      endPrice: null,
      duration: 0,
      score: 0,
      maxCombo: 0,
      powerUpsCollected: 0,
      tricksPerformed: 0,
      status: "riding",
      stake,
      contractId: options?.contractId,
      prediction: options?.prediction,
      targetDuration: options?.targetDuration,
    }

    setState(prev => ({
      ...prev,
      currentSession: newSession,
      currentScore: 0,
      currentCombo: 0,
      surferState: "riding",
      powerUps: [],
    }))

    return id
  }, [])

  const endSession = useCallback((sessionId: string, endPrice: number, status: "wiped" | "finished", profitLoss?: number) => {
    setState(prev => {
      if (!prev.currentSession || prev.currentSession.id !== sessionId) return prev

      const duration = Math.floor((Date.now() - prev.currentSession.timestamp) / 1000)
      const finalSession: SurfSession = {
        ...prev.currentSession,
        endPrice,
        duration,
        score: prev.currentScore,
        maxCombo: prev.maxCombo,
        status,
        profitLoss,
      }

      const newBestRide = Math.max(prev.bestRide, prev.currentScore)
      const newTotalWaves = prev.totalWaves + 1
      const pointsEarned = prev.currentSession.stake || 0

      return {
        ...prev,
        sessions: [finalSession, ...prev.sessions].slice(0, 100),
        currentSession: null,
        surferState: status === "wiped" ? "wipeout" : "celebrate",
        bestRide: newBestRide,
        totalWaves: newTotalWaves,
        surfPoints: prev.surfPoints + pointsEarned,
      }
    })
  }, [])

  const updateScore = useCallback((points: number) => {
    setState(prev => ({
      ...prev,
      currentScore: prev.currentScore + points,
    }))
  }, [])

  const addCombo = useCallback(() => {
    setState(prev => {
      const newCombo = prev.currentCombo + 1
      return {
        ...prev,
        currentCombo: newCombo,
        maxCombo: Math.max(prev.maxCombo, newCombo),
      }
    })
  }, [])

  const resetCombo = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentCombo: 0,
    }))
  }, [])

  const setSurferState = useCallback((surferState: SurferState) => {
    setState(prev => ({ ...prev, surferState }))
  }, [])

  const collectPowerUp = useCallback((powerUpId: string) => {
    setState(prev => {
      const powerUp = prev.powerUps.find(p => p.id === powerUpId)
      if (!powerUp || powerUp.collected) return prev

      // Play collection sound
      const soundMgr = getSoundManager()
      soundMgr.playPowerUpCollect()

      const newPowerUps = prev.powerUps.map(p =>
        p.id === powerUpId ? { ...p, collected: true } : p
      )

      const newScore = prev.currentScore + powerUp.points
      const newSession = prev.currentSession ? {
        ...prev.currentSession,
        powerUpsCollected: prev.currentSession.powerUpsCollected + 1,
      } : null

      return {
        ...prev,
        powerUps: newPowerUps,
        currentScore: newScore,
        currentSession: newSession,
      }
    })
  }, [])

  const addPowerUp = useCallback((powerUp: Omit<PowerUp, "id" | "collected">) => {
    const id = `powerup-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const newPowerUp: PowerUp = {
      ...powerUp,
      id,
      collected: false,
    }

    setState(prev => ({
      ...prev,
      powerUps: [...prev.powerUps, newPowerUp],
    }))
  }, [])

  const performTrick = useCallback((points: number) => {
    setState(prev => {
      const newSession = prev.currentSession ? {
        ...prev.currentSession,
        tricksPerformed: prev.currentSession.tricksPerformed + 1,
      } : null

      return {
        ...prev,
        currentScore: prev.currentScore + points,
        currentSession: newSession,
      }
    })
  }, [])

  const clearSurfHistory = useCallback(() => {
    setState({
      sessions: [],
      currentSession: null,
      surferState: "idle",
      currentScore: 0,
      currentCombo: 0,
      maxCombo: 0,
      powerUps: [],
      totalWaves: 0,
      bestRide: 0,
      surfPoints: 0,
    })
  }, [])

  const getLeaderboard = useCallback(() => {
    return [...state.sessions]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  }, [state.sessions])

  return (
    <SurfContext.Provider value={{
      ...state,
      startSession,
      endSession,
      updateScore,
      addCombo,
      resetCombo,
      setSurferState,
      collectPowerUp,
      addPowerUp,
      performTrick,
      clearSurfHistory,
      getLeaderboard,
    }}>
      {children}
    </SurfContext.Provider>
  )
}

export function useSurf() {
  const context = useContext(SurfContext)
  if (!context) {
    throw new Error("useSurf must be used within a SurfProvider")
  }
  return context
}

export default SurfContext

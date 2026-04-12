import React, { createContext, useContext, useState, useCallback, useEffect } from "react"
import type { ContractType } from "../types/deriv"

export interface GhostTrade {
  id: string
  timestamp: number
  symbol: string
  contractType: ContractType
  amount: number
  entryPrice: number
  exitPrice: number | null
  duration: number
  durationUnit: string
  result: "win" | "loss" | "pending"
  profit: number
  mochiPoints: number
}

export type MascotEmotion = "idle" | "win" | "lose"

interface GhostState {
  ghostTrades: GhostTrade[]
  mochiPoints: number
  totalSims: number
  winCount: number
  lossCount: number
  mascotEmotion: MascotEmotion
  activeGhostTrade: GhostTrade | null
}

interface GhostContextType extends GhostState {
  addGhostTrade: (trade: Omit<GhostTrade, "id" | "timestamp" | "result" | "profit" | "mochiPoints" | "exitPrice"> & { id?: string }) => string
  settleGhostTrade: (tradeId: string, exitPrice: number, realProfit?: number, realResult?: "win" | "loss") => void
  setMascotEmotion: (emotion: MascotEmotion) => void
  winRate: number
  clearGhostHistory: () => void
}

const STORAGE_KEY = "promo-trade-ghost-lab"

const GhostContext = createContext<GhostContextType | null>(null)

function loadFromStorage(): GhostState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        ghostTrades: parsed.ghostTrades || [],
        mochiPoints: parsed.mochiPoints || 0,
        totalSims: parsed.totalSims || 0,
        winCount: parsed.winCount || 0,
        lossCount: parsed.lossCount || 0,
        mascotEmotion: "idle",
        activeGhostTrade: null,
      }
    }
  } catch (err) {
    console.warn("[GhostContext] Failed to load from storage:", err)
  }
  return {
    ghostTrades: [],
    mochiPoints: 0,
    totalSims: 0,
    winCount: 0,
    lossCount: 0,
    mascotEmotion: "idle",
    activeGhostTrade: null,
  }
}

function saveToStorage(state: GhostState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ghostTrades: state.ghostTrades,
      mochiPoints: state.mochiPoints,
      totalSims: state.totalSims,
      winCount: state.winCount,
      lossCount: state.lossCount,
    }))
  } catch (err) {
    console.warn("[GhostContext] Failed to save to storage:", err)
  }
}

interface GhostProviderProps {
  children: React.ReactNode
  onTradeSettle?: (profit: number) => void
}

export function GhostProvider({ children, onTradeSettle }: GhostProviderProps) {
  const [state, setState] = useState<GhostState>(loadFromStorage)

  // Persist to localStorage whenever state changes
  useEffect(() => {
    saveToStorage(state)
  }, [state])

  const addGhostTrade = useCallback((
    trade: Omit<GhostTrade, "id" | "timestamp" | "result" | "profit" | "mochiPoints" | "exitPrice"> & { id?: string }
  ): string => {
    const id = trade.id || `ghost-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const newTrade: GhostTrade = {
      ...trade,
      id,
      timestamp: Date.now(),
      result: "pending",
      profit: 0,
      mochiPoints: 0,
      exitPrice: null,
    }

    setState(prev => ({
      ...prev,
      ghostTrades: [newTrade, ...prev.ghostTrades].slice(0, 100),
      activeGhostTrade: newTrade,
      mascotEmotion: "idle",
    }))

    return id
  }, [])

  const settleGhostTrade = useCallback((tradeId: string, exitPrice: number, realProfit?: number, realResult?: "win" | "loss") => {
    setState(prev => {
      const tradeIndex = prev.ghostTrades.findIndex(t => t.id === tradeId)
      if (tradeIndex === -1) return prev

      const trade = prev.ghostTrades[tradeIndex]
      
      let won = false
      let profit = 0
      
      if (realResult) {
        won = realResult === "win"
        profit = realProfit ?? (won ? trade.amount * 0.8 : -trade.amount)
      } else {
        // Local simulation fallback
        if (trade.contractType === "CALL") {
          won = exitPrice > trade.entryPrice
        } else if (trade.contractType === "PUT") {
          won = exitPrice < trade.entryPrice
        } else if (trade.contractType === "ONETOUCH") {
          // Touch: wins if price moved significantly (simplified)
          won = Math.abs(exitPrice - trade.entryPrice) > trade.entryPrice * 0.001
        } else if (trade.contractType === "NOTOUCH") {
          // No Touch: wins if price didn't move much
          won = Math.abs(exitPrice - trade.entryPrice) <= trade.entryPrice * 0.001
        }

        const payout = trade.amount * 1.8 // 80% payout
        profit = won ? payout - trade.amount : -trade.amount
      }

      const mochiPoints = won ? Math.floor(trade.amount * 10) : 0

      const updatedTrade: GhostTrade = {
        ...trade,
        exitPrice,
        result: won ? "win" : "loss",
        profit,
        mochiPoints,
      }

      if (onTradeSettle) {
        // Need to run this outside the setState callback to avoid potential issues
        setTimeout(() => onTradeSettle(profit), 0)
      }

      const newTrades = [...prev.ghostTrades]
      newTrades[tradeIndex] = updatedTrade

      return {
        ...prev,
        ghostTrades: newTrades,
        mochiPoints: prev.mochiPoints + mochiPoints,
        totalSims: prev.totalSims + 1,
        winCount: prev.winCount + (won ? 1 : 0),
        lossCount: prev.lossCount + (won ? 0 : 1),
        mascotEmotion: won ? "win" : "lose",
        activeGhostTrade: null,
      }
    })
  }, [])

  const setMascotEmotion = useCallback((emotion: MascotEmotion) => {
    setState(prev => ({ ...prev, mascotEmotion: emotion }))
  }, [])

  const clearGhostHistory = useCallback(() => {
    setState({
      ghostTrades: [],
      mochiPoints: 0,
      totalSims: 0,
      winCount: 0,
      lossCount: 0,
      mascotEmotion: "idle",
      activeGhostTrade: null,
    })
  }, [])

  const winRate = state.totalSims > 0 ? (state.winCount / state.totalSims) * 100 : 0

  return (
    <GhostContext.Provider value={{
      ...state,
      addGhostTrade,
      settleGhostTrade,
      setMascotEmotion,
      winRate,
      clearGhostHistory,
    }}>
      {children}
    </GhostContext.Provider>
  )
}

export function useGhost() {
  const context = useContext(GhostContext)
  if (!context) {
    throw new Error("useGhost must be used within a GhostProvider")
  }
  return context
}

export default GhostContext
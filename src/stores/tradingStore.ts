import { create } from "zustand"
import type {
  ActiveSymbol,
  Tick,
  OHLC,
  ProposalOpenContract,
  ProfitTable,
  ConnectionState,
  ChartStyle,
} from "../types/deriv"

interface ContractSLTP {
  stopLoss?: number
  takeProfit?: number
}

interface TradingState extends ConnectionState {
  // Symbols
  symbols: ActiveSymbol[]
  currentSymbol: string
  isSymbolLoading: boolean

  // Ticks
  currentTick: Tick | null
  tickHistory: Tick[]
  totalTicksReceived: number

  // OHLC Data
  currentOHLC: OHLC | null
  ohlcHistory: OHLC[]

  // Chart Style
  chartStyle: ChartStyle

  // Trading
  isTrading: boolean
  activeContracts: ProposalOpenContract[]
  recentTrades: ProfitTable["transactions"]

  // Stop Loss & Take Profit
  stopLoss: number | null
  takeProfit: number | null
  contractsSLTP: Map<number, ContractSLTP>

  // Barrier for Higher/Lower and Touch/No Touch
  barrier: number | null
  barrierHigh: number | null
  barrierLow: number | null
  barrierOffset: number | null
  minBarrierOffset: number | null
  maxBarrierOffset: number | null
  pipSize: number | null

  // Deriv Points
  derivPoints: number

  // Actions
  setSymbols: (symbols: ActiveSymbol[]) => void
  setCurrentSymbol: (symbol: string) => void
  setIsSymbolLoading: (loading: boolean) => void
  setCurrentTick: (tick: Tick) => void
  addTickToHistory: (tick: Tick) => void
  setTickHistory: (history: Tick[]) => void
  setCurrentOHLC: (ohlc: OHLC) => void
  addOHLCToHistory: (ohlc: OHLC) => void
  setOHLCHistory: (history: OHLC[]) => void
  setChartStyle: (style: ChartStyle) => void
  setConnectionState: (state: Partial<ConnectionState>) => void
  setIsTrading: (isTrading: boolean) => void
  addActiveContract: (contract: ProposalOpenContract) => void
  updateActiveContract: (contractId: number, updates: Partial<ProposalOpenContract>) => void
  removeActiveContract: (contractId: number) => void
  addRecentTrade: (trade: ProfitTable["transactions"][0]) => void
  setBarrier: (barrier: number | null) => void
  setBarrierHigh: (barrier: number | null) => void
  setBarrierLow: (barrier: number | null) => void
  setBarrierOffset: (offset: number | null) => void
  setBarrierOffsetRange: (min: number | null, max: number | null) => void
  setPipSize: (pipSize: number | null) => void
  setDerivPoints: (points: number) => void
  addDerivPoints: (points: number) => void
  convertDerivPoints: (pointsToConvert: number) => number
  fetchSymbols: () => Promise<void>
  clearState: () => void
  
  // Stop Loss & Take Profit Actions
  setStopLoss: (value: number | null) => void
  setTakeProfit: (value: number | null) => void
  setContractSLTP: (contractId: number, sl?: number, tp?: number) => void
  getContractSLTP: (contractId: number) => ContractSLTP | undefined
  clearContractSLTP: (contractId: number) => void
}

import { getDerivAPI } from "../lib/deriv-api"

const MAX_TICK_HISTORY = 1000
const MAX_OHLC_HISTORY = 500

import { devtools, persist, createJSONStorage } from 'zustand/middleware';

export const useTradingStore = create<TradingState>()(
  devtools(
    persist(
      (set, get) => ({
  // Initial state
  symbols: [],
  currentSymbol: "R_100",
  isSymbolLoading: false,
  currentTick: null,
  tickHistory: [],
  totalTicksReceived: 0,
  currentOHLC: null,
  ohlcHistory: [],
  chartStyle: 'area',
  isTrading: false,
  activeContracts: [],
  recentTrades: [],
  isConnected: false,
  isConnecting: false,
  error: null,
  lastConnected: null,
  stopLoss: null,
  takeProfit: null,
  contractsSLTP: new Map(),
  barrier: null,
  barrierHigh: null,
  barrierLow: null,
  barrierOffset: null,
  minBarrierOffset: null,
  maxBarrierOffset: null,
  pipSize: null,
  derivPoints: Number(localStorage.getItem("deriv_points") || "0"), // Default to 0 points

  // Actions
  setSymbols: (symbols) => set({ symbols }),

  setCurrentSymbol: (symbol) => set({
    currentSymbol: symbol,
    tickHistory: [],
    currentTick: null,
    totalTicksReceived: 0,
    ohlcHistory: [],
    currentOHLC: null,
  }),

  setIsSymbolLoading: (loading) => set({ isSymbolLoading: loading }),

  setCurrentTick: (tick) => {
    const state = get()

    // Check if this epoch already exists in history (deduplication)
    const existingIndex = state.tickHistory.findIndex(t => t.epoch === tick.epoch)

    let newHistory: Tick[]
    if (existingIndex !== -1) {
      // Update existing tick with same epoch instead of adding duplicate
      newHistory = [...state.tickHistory]
      newHistory[existingIndex] = tick
    } else {
      // Add new tick and ensure ascending order by epoch
      newHistory = [...state.tickHistory, tick]
      // Sort by epoch to maintain strict ascending order
      newHistory.sort((a, b) => a.epoch - b.epoch)
    }

    // Keep only the last MAX_TICK_HISTORY ticks
    if (newHistory.length > MAX_TICK_HISTORY) {
      newHistory.shift()
    }

    set({
      currentTick: tick,
      tickHistory: newHistory,
      totalTicksReceived: state.totalTicksReceived + 1
    })
  },

  addTickToHistory: (tick) => {
    const state = get()

    // Check if this epoch already exists in history (deduplication)
    const existingIndex = state.tickHistory.findIndex(t => t.epoch === tick.epoch)

    let newHistory: Tick[]
    if (existingIndex !== -1) {
      // Update existing tick with same epoch instead of adding duplicate
      newHistory = [...state.tickHistory]
      newHistory[existingIndex] = tick
    } else {
      // Add new tick and ensure ascending order by epoch
      newHistory = [...state.tickHistory, tick]
      // Sort by epoch to maintain strict ascending order
      newHistory.sort((a, b) => a.epoch - b.epoch)
    }

    if (newHistory.length > MAX_TICK_HISTORY) {
      newHistory.shift()
    }

    set({ tickHistory: newHistory })
  },

  setTickHistory: (history) => set({ tickHistory: history }),

  setCurrentOHLC: (ohlc) => {
    const state = get()

    // Check if this epoch already exists in history (deduplication)
    const existingIndex = state.ohlcHistory.findIndex(o => o.epoch === ohlc.epoch)

    let newHistory: OHLC[]
    if (existingIndex !== -1) {
      // Update existing OHLC with same epoch instead of adding duplicate
      newHistory = [...state.ohlcHistory]
      newHistory[existingIndex] = ohlc
    } else {
      // Add new OHLC and ensure ascending order by epoch
      newHistory = [...state.ohlcHistory, ohlc]
      // Sort by epoch to maintain strict ascending order
      newHistory.sort((a, b) => a.epoch - b.epoch)
    }

    // Keep only the last MAX_OHLC_HISTORY items
    if (newHistory.length > MAX_OHLC_HISTORY) {
      newHistory.shift()
    }

    set({
      currentOHLC: ohlc,
      ohlcHistory: newHistory,
    })
  },

  addOHLCToHistory: (ohlc) => {
    const state = get()

    // Check if this epoch already exists in history (deduplication)
    const existingIndex = state.ohlcHistory.findIndex(o => o.epoch === ohlc.epoch)

    let newHistory: OHLC[]
    if (existingIndex !== -1) {
      // Update existing OHLC with same epoch instead of adding duplicate
      newHistory = [...state.ohlcHistory]
      newHistory[existingIndex] = ohlc
    } else {
      // Add new OHLC and ensure ascending order by epoch
      newHistory = [...state.ohlcHistory, ohlc]
      // Sort by epoch to maintain strict ascending order
      newHistory.sort((a, b) => a.epoch - b.epoch)
    }

    if (newHistory.length > MAX_OHLC_HISTORY) {
      newHistory.shift()
    }

    set({ ohlcHistory: newHistory })
  },

  setOHLCHistory: (history) => set({ ohlcHistory: history }),

  setChartStyle: (style) => set({
    chartStyle: style,
    tickHistory: [],
    ohlcHistory: [],
    currentTick: null,
    currentOHLC: null
  }),

  setConnectionState: (connectionState) => set((state) => ({
    ...state,
    ...connectionState,
  })),

  setIsTrading: (isTrading) => set({ isTrading }),

  addActiveContract: (contract) => set((state) => ({
    activeContracts: [...state.activeContracts, contract],
  })),

  updateActiveContract: (contractId, updates) => set((state) => ({
    activeContracts: state.activeContracts.map((contract) =>
      contract.contract_id === contractId
        ? { ...contract, ...updates }
        : contract
    ),
  })),

  removeActiveContract: (contractId) => set((state) => ({
    activeContracts: state.activeContracts.filter(
      (contract) => contract.contract_id !== contractId
    ),
  })),

  addRecentTrade: (trade) => set((state) => ({
    recentTrades: [trade, ...state.recentTrades].slice(0, 50),
  })),

  setBarrier: (barrier) => set({ barrier }),
  setBarrierHigh: (barrierHigh) => set({ barrierHigh }),
  setBarrierLow: (barrierLow) => set({ barrierLow }),
  setBarrierOffset: (offset) => set({ barrierOffset: offset }),
  setBarrierOffsetRange: (min, max) => set({ minBarrierOffset: min, maxBarrierOffset: max }),
  setPipSize: (pipSize) => set({ pipSize }),

  // Stop Loss & Take Profit Actions
  setStopLoss: (value) => set({ stopLoss: value }),
  
  setTakeProfit: (value) => set({ takeProfit: value }),
  
  setContractSLTP: (contractId, sl, tp) => set((state) => {
    const newMap = new Map(state.contractsSLTP)
    newMap.set(contractId, { stopLoss: sl, takeProfit: tp })
    return { contractsSLTP: newMap }
  }),
  
  getContractSLTP: (contractId) => {
    const state = get()
    return state.contractsSLTP.get(contractId)
  },
  
  clearContractSLTP: (contractId) => set((state) => {
    const newMap = new Map(state.contractsSLTP)
    newMap.delete(contractId)
    return { contractsSLTP: newMap }
  }),

  fetchSymbols: async () => {
    const api = getDerivAPI()
    set({ isSymbolLoading: true })
    try {
      const allSymbols = await api.getActiveSymbols()

      // Use all symbols returned by the API - it already filters appropriately
      // The API returns only valid, tradeable symbols
      console.log(`[TradingStore] Loaded ${allSymbols.length} symbols from API`)
      set({ symbols: allSymbols, isSymbolLoading: false })
    } catch (error) {
      console.error("Failed to fetch symbols", error)
      set({ isSymbolLoading: false })
    }
  },

  setDerivPoints: (points) => {
    localStorage.setItem("deriv_points", String(points))
    set({ derivPoints: points })
  },

  addDerivPoints: (points) => {
    const state = get()
    const newPoints = state.derivPoints + points
    localStorage.setItem("deriv_points", String(newPoints))
    set({ derivPoints: newPoints })
  },

  convertDerivPoints: (pointsToConvert) => {
    const state = get()
    // Conversion rate: 100 points = $1
    const cashAmount = Math.floor(pointsToConvert / 100)
    if (cashAmount > 0 && pointsToConvert >= 100) {
      const newPoints = state.derivPoints - (cashAmount * 100)
      localStorage.setItem("deriv_points", String(newPoints))
      set({ derivPoints: newPoints })
    }
    return cashAmount
  },

  clearState: () => set({
    symbols: [],
    currentSymbol: "R_100",
    isSymbolLoading: false,
    currentTick: null,
    tickHistory: [],
    totalTicksReceived: 0,
    currentOHLC: null,
    ohlcHistory: [],
    chartStyle: 'area',
    isTrading: false,
    activeContracts: [],
    recentTrades: [],
    isConnected: false,
    isConnecting: false,
    error: null,
    lastConnected: null,
    stopLoss: null,
    takeProfit: null,
    contractsSLTP: new Map(),
    barrier: null,
    barrierHigh: null,
    barrierLow: null,
    barrierOffset: null,
    minBarrierOffset: null,
    maxBarrierOffset: null,
    pipSize: null,
  }),
}),
{
  name: 'trading-store',
  storage: createJSONStorage(() => sessionStorage),
}
)
)
);

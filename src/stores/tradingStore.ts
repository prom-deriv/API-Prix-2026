import { create } from "zustand"
import type {
  ActiveSymbol,
  Tick,
  ProposalOpenContract,
  ProfitTable,
  ConnectionState,
} from "../types/deriv"

interface TradingState extends ConnectionState {
  // Symbols
  symbols: ActiveSymbol[]
  currentSymbol: string
  isSymbolLoading: boolean
  
  // Ticks
  currentTick: Tick | null
  tickHistory: Tick[]
  totalTicksReceived: number
  
  // Trading
  isTrading: boolean
  activeContracts: ProposalOpenContract[]
  recentTrades: ProfitTable["transactions"]
  
  // Barrier for Higher/Lower and Touch/No Touch
  barrier: number | null
  barrierOffset: number | null
  minBarrierOffset: number | null
  maxBarrierOffset: number | null
  pipSize: number | null
  
  // Actions
  setSymbols: (symbols: ActiveSymbol[]) => void
  setCurrentSymbol: (symbol: string) => void
  setIsSymbolLoading: (loading: boolean) => void
  setCurrentTick: (tick: Tick) => void
  addTickToHistory: (tick: Tick) => void
  setTickHistory: (history: Tick[]) => void
  setConnectionState: (state: Partial<ConnectionState>) => void
  setIsTrading: (isTrading: boolean) => void
  addActiveContract: (contract: ProposalOpenContract) => void
  updateActiveContract: (contractId: number, updates: Partial<ProposalOpenContract>) => void
  removeActiveContract: (contractId: number) => void
  addRecentTrade: (trade: ProfitTable["transactions"][0]) => void
  setBarrier: (barrier: number | null) => void
  setBarrierOffset: (offset: number | null) => void
  setBarrierOffsetRange: (min: number | null, max: number | null) => void
  setPipSize: (pipSize: number | null) => void
  clearState: () => void
}

const MAX_TICK_HISTORY = 1000

export const useTradingStore = create<TradingState>((set, get) => ({
  // Initial state
  symbols: [],
  currentSymbol: "R_100",
  isSymbolLoading: false,
  currentTick: null,
  tickHistory: [],
  totalTicksReceived: 0,
  isTrading: false,
  activeContracts: [],
  recentTrades: [],
  isConnected: false,
  isConnecting: false,
  error: null,
  lastConnected: null,
  barrier: null,
  barrierOffset: null,
  minBarrierOffset: null,
  maxBarrierOffset: null,
  pipSize: null,

  // Actions
  setSymbols: (symbols) => set({ symbols }),

  setCurrentSymbol: (symbol) => set({ currentSymbol: symbol, tickHistory: [], currentTick: null, totalTicksReceived: 0 }),

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
  setBarrierOffset: (offset) => set({ barrierOffset: offset }),
  setBarrierOffsetRange: (min, max) => set({ minBarrierOffset: min, maxBarrierOffset: max }),
  setPipSize: (pipSize) => set({ pipSize }),

  clearState: () => set({
    symbols: [],
    currentSymbol: "R_100",
    isSymbolLoading: false,
    currentTick: null,
    tickHistory: [],
    totalTicksReceived: 0,
    isTrading: false,
    activeContracts: [],
    recentTrades: [],
    isConnected: false,
    isConnecting: false,
    error: null,
    lastConnected: null,
    barrier: null,
    barrierOffset: null,
    minBarrierOffset: null,
    maxBarrierOffset: null,
    pipSize: null,
  }),
}))

export default useTradingStore
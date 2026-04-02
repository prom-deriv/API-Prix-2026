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
  
  // Ticks
  currentTick: Tick | null
  tickHistory: Tick[]
  
  // Trading
  isTrading: boolean
  activeContracts: ProposalOpenContract[]
  recentTrades: ProfitTable["transactions"]
  
  // Barrier for Higher/Lower and Touch/No Touch
  barrier: number | null
  
  // Actions
  setSymbols: (symbols: ActiveSymbol[]) => void
  setCurrentSymbol: (symbol: string) => void
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
  clearState: () => void
}

const MAX_TICK_HISTORY = 1000

export const useTradingStore = create<TradingState>((set, get) => ({
  // Initial state
  symbols: [],
  currentSymbol: "R_100",
  currentTick: null,
  tickHistory: [],
  isTrading: false,
  activeContracts: [],
  recentTrades: [],
  isConnected: false,
  isConnecting: false,
  error: null,
  lastConnected: null,
  barrier: null,

  // Actions
  setSymbols: (symbols) => set({ symbols }),

  setCurrentSymbol: (symbol) => set({ currentSymbol: symbol, tickHistory: [], currentTick: null }),

  setCurrentTick: (tick) => {
    const state = get()
    const newHistory = [...state.tickHistory, tick]
    
    // Keep only the last MAX_TICK_HISTORY ticks
    if (newHistory.length > MAX_TICK_HISTORY) {
      newHistory.shift()
    }

    set({ 
      currentTick: tick, 
      tickHistory: newHistory 
    })
  },

  addTickToHistory: (tick) => {
    const state = get()
    const newHistory = [...state.tickHistory, tick]
    
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

  clearState: () => set({
    symbols: [],
    currentSymbol: "R_100",
    currentTick: null,
    tickHistory: [],
    isTrading: false,
    activeContracts: [],
    recentTrades: [],
    isConnected: false,
    isConnecting: false,
    error: null,
    lastConnected: null,
  }),
}))

export default useTradingStore
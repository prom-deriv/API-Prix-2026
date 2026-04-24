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

  setCurrentSymbol: (symbol) => {
    // Check if the symbol is actually changing to prevent unnecessary resets
    const current = get().currentSymbol;
    if (current === symbol) return;
    
    set({
      currentSymbol: symbol,
      tickHistory: [],
      currentTick: null,
      totalTicksReceived: 0,
      ohlcHistory: [],
      currentOHLC: null,
    })
  },

  setIsSymbolLoading: (loading) => set({ isSymbolLoading: loading }),

  setCurrentTick: (tick) => {
    const state = get()

    // ✅ STRICT SYMBOL GUARD:
    // Reject any tick whose symbol does not match the store's currentSymbol.
    // This closes the final race-condition window where a stale tick from the
    // *previous* symbol's subscription could arrive after the user switched
    // symbols but before the server's `forget_all` took effect — which was
    // the direct cause of the chart header showing e.g. "BTC/USD 735.32".
    if (tick.symbol && tick.symbol !== state.currentSymbol) {
      return
    }

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

    // ✅ STRICT SYMBOL GUARD (see setCurrentTick)
    if (tick.symbol && tick.symbol !== state.currentSymbol) {
      return
    }

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

  setTickHistory: (history) => {
    // Simple passthrough. Callers (Home.tsx, MochiMoto.tsx, SurfTheWaves.tsx)
    // already guard their writes behind a symbol-match check
    // (`loadingSymbolRef !== symbolToLoad`), so this store-level setter
    // intentionally does NOT try to be clever about symbols.
    //
    // A previous revision tried two different "clever" behaviours here —
    // first hard-dropping mismatched history, later silently flipping
    // `currentSymbol` to match. Both were footguns:
    //   * Dropping caused legit history to disappear on reconnect.
    //   * Flipping caused a silent desync where the UI still showed the
    //     user's picked symbol but the store believed a different one,
    //     producing the "chart stuck with stale prices, no live ticks"
    //     bug after switching assets.
    //
    // Cross-symbol leakage from live WebSocket pushes is still blocked at
    // the per-tick level by `setCurrentTick` / `setCurrentOHLC` below,
    // which is the correct layer for that guard.
    set({ tickHistory: history })
  },

  setCurrentOHLC: (ohlc) => {
    const state = get()

    // ✅ STRICT SYMBOL GUARD (see setCurrentTick)
    if (ohlc.symbol && ohlc.symbol !== state.currentSymbol) {
      return
    }

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

  setOHLCHistory: (history) => {
    // Simple passthrough — see the extended comment on setTickHistory above
    // for why the "clever" reconcile logic was removed. The caller owns
    // the symbol-match check; this setter must not silently mutate
    // `currentSymbol`.
    set({ ohlcHistory: history })
  },

  setChartStyle: (style) => {
    // NOTE: We intentionally do NOT wipe tickHistory/ohlcHistory here.
    // History arrays are keyed by the CURRENT symbol, not by chart style,
    // so they remain valid when the user only switches how the data is
    // visualised (Area <-> Line <-> OHLC <-> Candlestick). Wiping them
    // would cause the chart to briefly render from a single live tick,
    // making it look like it "starts from 0" until the async re-fetch
    // completes. History is still reset when the symbol changes
    // (see setCurrentSymbol) which is the correct trigger.
    set({ chartStyle: style })
  },

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

      // Ensure that we include cryptocurrencies properly and default the market name if missing
      // Filter out some problematic symbols that don't load ticks
      const validSymbols = allSymbols.filter(sym => 
        !sym.symbol.startsWith('OTC_')
      );
      
      const enhancedSymbols = validSymbols.map(sym => ({
        ...sym,
        market_display_name: sym.market_display_name || (
          sym.symbol.startsWith('BTC') || sym.symbol.startsWith('ETH') || sym.symbol.includes('CRYPTO') ? 'Cryptocurrencies' : 'Other Assets'
        ),
      }))

      console.log(`[TradingStore] Loaded ${enhancedSymbols.length} symbols from API`)
      set({ symbols: enhancedSymbols, isSymbolLoading: false })
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

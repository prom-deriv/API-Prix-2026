import { create } from "zustand"
import { devtools } from "zustand/middleware"
import type { DetectedPattern } from "../utils/patternDetection"
import type { SupportResistanceLevel } from "../utils/technicalIndicators"

/**
 * AI Store
 * Manages AI-powered trading assistant state
 */

export interface TechnicalIndicators {
  rsi: number | null
  macd: {
    macd: number
    signal: number
    histogram: number
  } | null
  trend: 'uptrend' | 'downtrend' | 'sideways' | null
  volatility: number | null
}

export interface TradeSuggestion {
  id: string
  symbol: string
  direction: 'CALL' | 'PUT'
  confidence: number // 0-100
  entry_price: number
  stop_loss: number | null
  take_profit: number | null
  reasoning: string[]
  indicators: TechnicalIndicators
  timestamp: number
  pattern?: DetectedPattern
}

export interface RiskWarning {
  id: string
  type: 'high_volatility' | 'consecutive_losses' | 'large_position' | 'low_confidence' | 'economic_event'
  severity: 'low' | 'medium' | 'high'
  message: string
  timestamp: number
  symbol?: string
}

interface AIState {
  // Technical Analysis
  currentIndicators: TechnicalIndicators
  detectedPattern: DetectedPattern | null
  supportResistanceLevels: SupportResistanceLevel[]
  
  // Trade Suggestions
  tradeSuggestions: TradeSuggestion[]
  lastSuggestionTime: number | null
  
  // Risk Warnings
  riskWarnings: RiskWarning[]
  consecutiveLosses: number
  
  // AI Status
  isAnalyzing: boolean
  lastAnalysisTime: number | null
  error: string | null
  
  // Actions
  setIndicators: (indicators: TechnicalIndicators) => void
  setDetectedPattern: (pattern: DetectedPattern | null) => void
  setSupportResistanceLevels: (levels: SupportResistanceLevel[]) => void
  addTradeSuggestion: (suggestion: TradeSuggestion) => void
  removeTradeSuggestion: (id: string) => void
  clearTradeSuggestions: () => void
  addRiskWarning: (warning: RiskWarning) => void
  removeRiskWarning: (id: string) => void
  clearRiskWarnings: () => void
  setConsecutiveLosses: (count: number) => void
  incrementConsecutiveLosses: () => void
  resetConsecutiveLosses: () => void
  setIsAnalyzing: (analyzing: boolean) => void
  setLastAnalysisTime: (time: number) => void
  setError: (error: string | null) => void
  clearState: () => void
}

const initialState = {
  currentIndicators: {
    rsi: null,
    macd: null,
    trend: null,
    volatility: null,
  },
  detectedPattern: null,
  supportResistanceLevels: [],
  tradeSuggestions: [],
  lastSuggestionTime: null,
  riskWarnings: [],
  consecutiveLosses: 0,
  isAnalyzing: false,
  lastAnalysisTime: null,
  error: null,
}

export const useAIStore = create<AIState>()(
  devtools(
    (set) => ({
      ...initialState,

      // Technical Analysis Actions
      setIndicators: (indicators) =>
        set({ currentIndicators: indicators, lastAnalysisTime: Date.now() }),

      setDetectedPattern: (pattern) =>
        set({ detectedPattern: pattern }),

      setSupportResistanceLevels: (levels) =>
        set({ supportResistanceLevels: levels }),

      // Trade Suggestions Actions
      addTradeSuggestion: (suggestion) =>
        set((state) => ({
          tradeSuggestions: [suggestion, ...state.tradeSuggestions].slice(0, 10), // Keep last 10
          lastSuggestionTime: Date.now(),
        })),

      removeTradeSuggestion: (id) =>
        set((state) => ({
          tradeSuggestions: state.tradeSuggestions.filter((s) => s.id !== id),
        })),

      clearTradeSuggestions: () =>
        set({ tradeSuggestions: [], lastSuggestionTime: null }),

      // Risk Warnings Actions
      addRiskWarning: (warning) =>
        set((state) => {
          // Check if similar warning already exists
          const exists = state.riskWarnings.some(
            (w) => w.type === warning.type && w.symbol === warning.symbol
          )
          
          if (exists) return state
          
          return {
            riskWarnings: [warning, ...state.riskWarnings].slice(0, 5), // Keep last 5
          }
        }),

      removeRiskWarning: (id) =>
        set((state) => ({
          riskWarnings: state.riskWarnings.filter((w) => w.id !== id),
        })),

      clearRiskWarnings: () =>
        set({ riskWarnings: [] }),

      // Consecutive Losses Tracking
      setConsecutiveLosses: (count) =>
        set({ consecutiveLosses: count }),

      incrementConsecutiveLosses: () =>
        set((state) => ({
          consecutiveLosses: state.consecutiveLosses + 1,
        })),

      resetConsecutiveLosses: () =>
        set({ consecutiveLosses: 0 }),

      // Status Actions
      setIsAnalyzing: (analyzing) =>
        set({ isAnalyzing: analyzing }),

      setLastAnalysisTime: (time) =>
        set({ lastAnalysisTime: time }),

      setError: (error) =>
        set({ error }),

      clearState: () =>
        set(initialState),
    }),
    { name: 'ai-store' }
  )
)

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate trade suggestion based on technical analysis
 */
export function generateTradeSuggestion(
  symbol: string,
  currentPrice: number,
  indicators: TechnicalIndicators,
  pattern: DetectedPattern | null,
  supportLevels: SupportResistanceLevel[]
): TradeSuggestion | null {
  const reasoning: string[] = []
  let direction: 'CALL' | 'PUT' | null = null
  let confidence = 50
  let stopLoss: number | null = null
  let takeProfit: number | null = null

  // Analyze RSI
  if (indicators.rsi !== null) {
    if (indicators.rsi > 70) {
      reasoning.push(`RSI is overbought (${indicators.rsi.toFixed(1)})`)
      direction = 'PUT'
      confidence += 10
    } else if (indicators.rsi < 30) {
      reasoning.push(`RSI is oversold (${indicators.rsi.toFixed(1)})`)
      direction = 'CALL'
      confidence += 10
    } else if (indicators.rsi >= 50 && indicators.rsi <= 60) {
      reasoning.push(`RSI shows bullish momentum (${indicators.rsi.toFixed(1)})`)
      if (direction === null) direction = 'CALL'
      confidence += 5
    } else if (indicators.rsi >= 40 && indicators.rsi < 50) {
      reasoning.push(`RSI shows bearish momentum (${indicators.rsi.toFixed(1)})`)
      if (direction === null) direction = 'PUT'
      confidence += 5
    }
  }

  // Analyze MACD
  if (indicators.macd !== null) {
    if (indicators.macd.histogram > 0) {
      reasoning.push('MACD histogram is positive (bullish)')
      if (direction === null) direction = 'CALL'
      else if (direction === 'CALL') confidence += 10
    } else {
      reasoning.push('MACD histogram is negative (bearish)')
      if (direction === null) direction = 'PUT'
      else if (direction === 'PUT') confidence += 10
    }
  }

  // Analyze Trend
  if (indicators.trend !== null) {
    if (indicators.trend === 'uptrend') {
      reasoning.push('Price is in an uptrend')
      if (direction === null) direction = 'CALL'
      else if (direction === 'CALL') confidence += 15
    } else if (indicators.trend === 'downtrend') {
      reasoning.push('Price is in a downtrend')
      if (direction === null) direction = 'PUT'
      else if (direction === 'PUT') confidence += 15
    } else {
      reasoning.push('Price is moving sideways - low confidence')
      confidence -= 10
    }
  }

  // Analyze Pattern
  if (pattern) {
    reasoning.push(`${pattern.description}`)
    if (pattern.signal === 'bullish') {
      if (direction === null) direction = 'CALL'
      else if (direction === 'CALL') confidence += 15
      else confidence -= 10 // Conflicting signal
    } else if (pattern.signal === 'bearish') {
      if (direction === null) direction = 'PUT'
      else if (direction === 'PUT') confidence += 15
      else confidence -= 10 // Conflicting signal
    }
    
    if (pattern.targetPrice) {
      takeProfit = pattern.targetPrice
    }
  }

  // Set stop loss based on support/resistance
  if (supportLevels.length > 0) {
    if (direction === 'CALL') {
      // Find nearest support below current price
      const supports = supportLevels
        .filter(l => l.type === 'support' && l.price < currentPrice)
        .sort((a, b) => b.price - a.price)
      
      if (supports.length > 0) {
        stopLoss = supports[0].price
        reasoning.push(`Support level at ${supports[0].price.toFixed(2)}`)
      }
      
      // Find resistance above for take profit
      if (!takeProfit) {
        const resistances = supportLevels
          .filter(l => l.type === 'resistance' && l.price > currentPrice)
          .sort((a, b) => a.price - b.price)
        
        if (resistances.length > 0) {
          takeProfit = resistances[0].price
        }
      }
    } else if (direction === 'PUT') {
      // Find nearest resistance above current price
      const resistances = supportLevels
        .filter(l => l.type === 'resistance' && l.price > currentPrice)
        .sort((a, b) => a.price - b.price)
      
      if (resistances.length > 0) {
        stopLoss = resistances[0].price
        reasoning.push(`Resistance level at ${resistances[0].price.toFixed(2)}`)
      }
      
      // Find support below for take profit
      if (!takeProfit) {
        const supports = supportLevels
          .filter(l => l.type === 'support' && l.price < currentPrice)
          .sort((a, b) => b.price - a.price)
        
        if (supports.length > 0) {
          takeProfit = supports[0].price
        }
      }
    }
  }

  // Need at least some signal to make suggestion
  if (direction === null || reasoning.length === 0) {
    return null
  }

  // Clamp confidence between 0-100
  confidence = Math.max(0, Math.min(100, confidence))

  // Only suggest if confidence is reasonable
  if (confidence < 40) {
    return null
  }

  return {
    id: `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    symbol,
    direction,
    confidence,
    entry_price: currentPrice,
    stop_loss: stopLoss,
    take_profit: takeProfit,
    reasoning,
    indicators,
    timestamp: Date.now(),
    pattern: pattern || undefined,
  }
}

/**
 * Check for risk conditions and generate warnings
 */
export function checkRiskConditions(
  volatility: number | null,
  consecutiveLosses: number,
  currentPrice: number,
  balance: number,
  tradeAmount: number,
  confidence: number | null
): RiskWarning[] {
  const warnings: RiskWarning[] = []

  // High Volatility Warning
  if (volatility !== null && volatility / currentPrice > 0.02) {
    warnings.push({
      id: `warning_volatility_${Date.now()}`,
      type: 'high_volatility',
      severity: 'medium',
      message: 'High volatility detected - prices are moving rapidly. Exercise caution.',
      timestamp: Date.now(),
    })
  }

  // Consecutive Losses Warning
  if (consecutiveLosses >= 3) {
    warnings.push({
      id: `warning_losses_${Date.now()}`,
      type: 'consecutive_losses',
      severity: consecutiveLosses >= 5 ? 'high' : 'medium',
      message: `You have ${consecutiveLosses} consecutive losses. Consider taking a break or reviewing your strategy.`,
      timestamp: Date.now(),
    })
  }

  // Large Position Size Warning
  if (balance > 0 && tradeAmount / balance > 0.1) {
    warnings.push({
      id: `warning_position_${Date.now()}`,
      type: 'large_position',
      severity: tradeAmount / balance > 0.2 ? 'high' : 'medium',
      message: `Trade amount (${((tradeAmount / balance) * 100).toFixed(1)}% of balance) is large. Consider proper risk management.`,
      timestamp: Date.now(),
    })
  }

  // Low Confidence Warning
  if (confidence !== null && confidence < 50) {
    warnings.push({
      id: `warning_confidence_${Date.now()}`,
      type: 'low_confidence',
      severity: 'low',
      message: `AI confidence is low (${confidence.toFixed(0)}%). Consider waiting for better conditions.`,
      timestamp: Date.now(),
    })
  }

  return warnings
}

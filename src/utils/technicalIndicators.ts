import type { OHLC, Tick } from "../types/deriv"

/**
 * Technical Indicators Utility
 * Provides calculations for RSI, MACD, Moving Averages, etc.
 */

// ==================== MOVING AVERAGES ====================

/**
 * Simple Moving Average (SMA)
 * @param data - Array of prices
 * @param period - Number of periods
 */
export function calculateSMA(data: number[], period: number): number[] {
  if (data.length < period) return []
  
  const sma: number[] = []
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
    sma.push(sum / period)
  }
  return sma
}

/**
 * Exponential Moving Average (EMA)
 * @param data - Array of prices
 * @param period - Number of periods
 */
export function calculateEMA(data: number[], period: number): number[] {
  if (data.length < period) return []
  
  const k = 2 / (period + 1)
  const ema: number[] = []
  
  // First EMA is SMA
  const firstSMA = data.slice(0, period).reduce((a, b) => a + b, 0) / period
  ema.push(firstSMA)
  
  // Calculate subsequent EMAs
  for (let i = period; i < data.length; i++) {
    const currentEMA = data[i] * k + ema[ema.length - 1] * (1 - k)
    ema.push(currentEMA)
  }
  
  return ema
}

// ==================== RSI ====================

/**
 * Relative Strength Index (RSI)
 * @param data - Array of prices
 * @param period - Period for RSI calculation (default: 14)
 * @returns Array of RSI values
 */
export function calculateRSI(data: number[], period: number = 14): number[] {
  if (data.length < period + 1) return []
  
  const rsi: number[] = []
  const gains: number[] = []
  const losses: number[] = []
  
  // Calculate price changes
  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1]
    gains.push(change > 0 ? change : 0)
    losses.push(change < 0 ? Math.abs(change) : 0)
  }
  
  // Calculate initial average gain/loss
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period
  
  // Calculate first RSI
  const rs = avgGain / avgLoss
  rsi.push(100 - (100 / (1 + rs)))
  
  // Calculate subsequent RSI values
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
    
    const rs = avgGain / avgLoss
    rsi.push(100 - (100 / (1 + rs)))
  }
  
  return rsi
}

/**
 * Get current RSI value
 */
export function getCurrentRSI(data: number[], period: number = 14): number | null {
  const rsiValues = calculateRSI(data, period)
  return rsiValues.length > 0 ? rsiValues[rsiValues.length - 1] : null
}

// ==================== MACD ====================

export interface MACDResult {
  macd: number[]
  signal: number[]
  histogram: number[]
}

/**
 * Moving Average Convergence Divergence (MACD)
 * @param data - Array of prices
 * @param fastPeriod - Fast EMA period (default: 12)
 * @param slowPeriod - Slow EMA period (default: 26)
 * @param signalPeriod - Signal line period (default: 9)
 */
export function calculateMACD(
  data: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult | null {
  if (data.length < slowPeriod + signalPeriod) return null
  
  const fastEMA = calculateEMA(data, fastPeriod)
  const slowEMA = calculateEMA(data, slowPeriod)
  
  // Align arrays (slowEMA starts later)
  const offset = fastEMA.length - slowEMA.length
  const macd = slowEMA.map((value, i) => fastEMA[i + offset] - value)
  
  // Calculate signal line (EMA of MACD)
  const signal = calculateEMA(macd, signalPeriod)
  
  // Calculate histogram
  const histogramOffset = macd.length - signal.length
  const histogram = signal.map((value, i) => macd[i + histogramOffset] - value)
  
  return { macd, signal, histogram }
}

/**
 * Get current MACD values
 */
export function getCurrentMACD(
  data: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number; signal: number; histogram: number } | null {
  const macdResult = calculateMACD(data, fastPeriod, slowPeriod, signalPeriod)
  if (!macdResult) return null
  
  const lastIndex = macdResult.histogram.length - 1
  return {
    macd: macdResult.macd[macdResult.macd.length - 1],
    signal: macdResult.signal[macdResult.signal.length - 1],
    histogram: macdResult.histogram[lastIndex]
  }
}

// ==================== BOLLINGER BANDS ====================

export interface BollingerBands {
  upper: number[]
  middle: number[]
  lower: number[]
}

/**
 * Bollinger Bands
 * @param data - Array of prices
 * @param period - Period for calculation (default: 20)
 * @param stdDev - Number of standard deviations (default: 2)
 */
export function calculateBollingerBands(
  data: number[],
  period: number = 20,
  stdDev: number = 2
): BollingerBands | null {
  if (data.length < period) return null
  
  const middle = calculateSMA(data, period)
  const upper: number[] = []
  const lower: number[] = []
  
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1)
    const sma = slice.reduce((a, b) => a + b, 0) / period
    
    // Calculate standard deviation
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period
    const sd = Math.sqrt(variance)
    
    upper.push(sma + stdDev * sd)
    lower.push(sma - stdDev * sd)
  }
  
  return { upper, middle, lower }
}

// ==================== SUPPORT & RESISTANCE ====================

export interface SupportResistanceLevel {
  price: number
  strength: number
  type: 'support' | 'resistance'
}

/**
 * Find support and resistance levels
 * @param ohlcData - OHLC data
 * @param lookback - Number of candles to analyze (default: 50)
 */
export function findSupportResistance(
  ohlcData: OHLC[],
  lookback: number = 50
): SupportResistanceLevel[] {
  if (ohlcData.length < lookback) return []
  
  const recentData = ohlcData.slice(-lookback)
  const levels: SupportResistanceLevel[] = []
  
  // Find local highs and lows
  for (let i = 2; i < recentData.length - 2; i++) {
    const current = recentData[i]
    const prev1 = recentData[i - 1]
    const prev2 = recentData[i - 2]
    const next1 = recentData[i + 1]
    const next2 = recentData[i + 2]
    
    // Local high (resistance)
    if (
      current.high > prev1.high &&
      current.high > prev2.high &&
      current.high > next1.high &&
      current.high > next2.high
    ) {
      levels.push({
        price: current.high,
        strength: 1,
        type: 'resistance'
      })
    }
    
    // Local low (support)
    if (
      current.low < prev1.low &&
      current.low < prev2.low &&
      current.low < next1.low &&
      current.low < next2.low
    ) {
      levels.push({
        price: current.low,
        strength: 1,
        type: 'support'
      })
    }
  }
  
  // Cluster nearby levels (within 0.1% of price)
  const clustered: SupportResistanceLevel[] = []
  levels.forEach(level => {
    const existing = clustered.find(
      l => Math.abs(l.price - level.price) / level.price < 0.001 && l.type === level.type
    )
    
    if (existing) {
      existing.strength += 1
    } else {
      clustered.push({ ...level })
    }
  })
  
  // Sort by strength and return top levels
  return clustered.sort((a, b) => b.strength - a.strength).slice(0, 5)
}

// ==================== VOLATILITY ====================

/**
 * Calculate Average True Range (ATR) - volatility indicator
 * @param ohlcData - OHLC data
 * @param period - Period for ATR (default: 14)
 */
export function calculateATR(ohlcData: OHLC[], period: number = 14): number[] {
  if (ohlcData.length < period) return []
  
  const trueRanges: number[] = []
  
  for (let i = 1; i < ohlcData.length; i++) {
    const current = ohlcData[i]
    const previous = ohlcData[i - 1]
    
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    )
    
    trueRanges.push(tr)
  }
  
  return calculateSMA(trueRanges, period)
}

/**
 * Calculate price volatility (standard deviation)
 * @param data - Array of prices
 * @param period - Period for calculation
 */
export function calculateVolatility(data: number[], period: number = 20): number | null {
  if (data.length < period) return null
  
  const recentData = data.slice(-period)
  const mean = recentData.reduce((a, b) => a + b, 0) / period
  const variance = recentData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period
  
  return Math.sqrt(variance)
}

// ==================== TREND DETECTION ====================

/**
 * Detect current trend
 * @param data - Array of prices
 * @param shortPeriod - Short MA period (default: 10)
 * @param longPeriod - Long MA period (default: 50)
 */
export function detectTrend(
  data: number[],
  shortPeriod: number = 10,
  longPeriod: number = 50
): 'uptrend' | 'downtrend' | 'sideways' | null {
  if (data.length < longPeriod) return null
  
  const shortMA = calculateSMA(data, shortPeriod)
  const longMA = calculateSMA(data, longPeriod)
  
  if (shortMA.length === 0 || longMA.length === 0) return null
  
  const currentShortMA = shortMA[shortMA.length - 1]
  const currentLongMA = longMA[longMA.length - 1]
  
  const diff = currentShortMA - currentLongMA
  const diffPercent = (diff / currentLongMA) * 100
  
  if (diffPercent > 0.5) return 'uptrend'
  if (diffPercent < -0.5) return 'downtrend'
  return 'sideways'
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Extract closing prices from OHLC data
 */
export function getClosePrices(ohlcData: OHLC[]): number[] {
  return ohlcData.map(candle => candle.close)
}

/**
 * Extract prices from tick data
 */
export function getTickPrices(tickData: Tick[]): number[] {
  return tickData.map(tick => tick.quote)
}

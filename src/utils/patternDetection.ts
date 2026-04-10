import type { OHLC } from "../types/deriv"

/**
 * Pattern Detection Utility
 * Algorithmic detection of chart patterns (no ML required)
 */

export type PatternType =
  | 'head_and_shoulders'
  | 'inverse_head_and_shoulders'
  | 'double_top'
  | 'double_bottom'
  | 'ascending_triangle'
  | 'descending_triangle'
  | 'symmetrical_triangle'
  | 'bullish_flag'
  | 'bearish_flag'
  | 'none'

export interface DetectedPattern {
  type: PatternType
  confidence: number // 0-100
  startIndex: number
  endIndex: number
  description: string
  signal: 'bullish' | 'bearish' | 'neutral'
  targetPrice?: number
}

// ==================== HEAD & SHOULDERS ====================

/**
 * Detect Head and Shoulders pattern
 * Pattern: Left shoulder -> Head (higher) -> Right shoulder
 */
export function detectHeadAndShoulders(ohlcData: OHLC[], lookback: number = 30): DetectedPattern | null {
  if (ohlcData.length < lookback) return null
  
  const recentData = ohlcData.slice(-lookback)
  const peaks: { index: number; price: number }[] = []
  
  // Find peaks (local maxima)
  for (let i = 2; i < recentData.length - 2; i++) {
    if (
      recentData[i].high > recentData[i - 1].high &&
      recentData[i].high > recentData[i - 2].high &&
      recentData[i].high > recentData[i + 1].high &&
      recentData[i].high > recentData[i + 2].high
    ) {
      peaks.push({ index: i, price: recentData[i].high })
    }
  }
  
  // Need at least 3 peaks for head and shoulders
  if (peaks.length < 3) return null
  
  // Check recent 3 peaks
  const lastThree = peaks.slice(-3)
  const [leftShoulder, head, rightShoulder] = lastThree
  
  // Head should be higher than both shoulders
  // Shoulders should be roughly equal (within 2%)
  const shoulderDiff = Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price
  
  if (
    head.price > leftShoulder.price &&
    head.price > rightShoulder.price &&
    shoulderDiff < 0.02
  ) {
    // Find neckline (support level between shoulders)
    const necklinePrice = Math.min(...recentData.slice(leftShoulder.index, rightShoulder.index + 1).map(c => c.low))
    
    return {
      type: 'head_and_shoulders',
      confidence: 75,
      startIndex: ohlcData.length - lookback + leftShoulder.index,
      endIndex: ohlcData.length - 1,
      description: 'Head and Shoulders - Bearish reversal pattern detected',
      signal: 'bearish',
      targetPrice: necklinePrice - (head.price - necklinePrice)
    }
  }
  
  return null
}

/**
 * Detect Inverse Head and Shoulders pattern
 */
export function detectInverseHeadAndShoulders(ohlcData: OHLC[], lookback: number = 30): DetectedPattern | null {
  if (ohlcData.length < lookback) return null
  
  const recentData = ohlcData.slice(-lookback)
  const troughs: { index: number; price: number }[] = []
  
  // Find troughs (local minima)
  for (let i = 2; i < recentData.length - 2; i++) {
    if (
      recentData[i].low < recentData[i - 1].low &&
      recentData[i].low < recentData[i - 2].low &&
      recentData[i].low < recentData[i + 1].low &&
      recentData[i].low < recentData[i + 2].low
    ) {
      troughs.push({ index: i, price: recentData[i].low })
    }
  }
  
  if (troughs.length < 3) return null
  
  const lastThree = troughs.slice(-3)
  const [leftShoulder, head, rightShoulder] = lastThree
  
  const shoulderDiff = Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price
  
  if (
    head.price < leftShoulder.price &&
    head.price < rightShoulder.price &&
    shoulderDiff < 0.02
  ) {
    const necklinePrice = Math.max(...recentData.slice(leftShoulder.index, rightShoulder.index + 1).map(c => c.high))
    
    return {
      type: 'inverse_head_and_shoulders',
      confidence: 75,
      startIndex: ohlcData.length - lookback + leftShoulder.index,
      endIndex: ohlcData.length - 1,
      description: 'Inverse Head and Shoulders - Bullish reversal pattern detected',
      signal: 'bullish',
      targetPrice: necklinePrice + (necklinePrice - head.price)
    }
  }
  
  return null
}

// ==================== DOUBLE TOP & BOTTOM ====================

/**
 * Detect Double Top pattern
 */
export function detectDoubleTop(ohlcData: OHLC[], lookback: number = 20): DetectedPattern | null {
  if (ohlcData.length < lookback) return null
  
  const recentData = ohlcData.slice(-lookback)
  const peaks: { index: number; price: number }[] = []
  
  for (let i = 2; i < recentData.length - 2; i++) {
    if (
      recentData[i].high > recentData[i - 1].high &&
      recentData[i].high > recentData[i - 2].high &&
      recentData[i].high > recentData[i + 1].high &&
      recentData[i].high > recentData[i + 2].high
    ) {
      peaks.push({ index: i, price: recentData[i].high })
    }
  }
  
  if (peaks.length < 2) return null
  
  const lastTwo = peaks.slice(-2)
  const [firstPeak, secondPeak] = lastTwo
  
  // Peaks should be roughly equal (within 1.5%)
  const priceDiff = Math.abs(firstPeak.price - secondPeak.price) / firstPeak.price
  
  if (priceDiff < 0.015 && secondPeak.index - firstPeak.index > 5) {
    const valleyPrice = Math.min(...recentData.slice(firstPeak.index, secondPeak.index + 1).map(c => c.low))
    
    return {
      type: 'double_top',
      confidence: 70,
      startIndex: ohlcData.length - lookback + firstPeak.index,
      endIndex: ohlcData.length - 1,
      description: 'Double Top - Bearish reversal pattern detected',
      signal: 'bearish',
      targetPrice: valleyPrice - (firstPeak.price - valleyPrice)
    }
  }
  
  return null
}

/**
 * Detect Double Bottom pattern
 */
export function detectDoubleBottom(ohlcData: OHLC[], lookback: number = 20): DetectedPattern | null {
  if (ohlcData.length < lookback) return null
  
  const recentData = ohlcData.slice(-lookback)
  const troughs: { index: number; price: number }[] = []
  
  for (let i = 2; i < recentData.length - 2; i++) {
    if (
      recentData[i].low < recentData[i - 1].low &&
      recentData[i].low < recentData[i - 2].low &&
      recentData[i].low < recentData[i + 1].low &&
      recentData[i].low < recentData[i + 2].low
    ) {
      troughs.push({ index: i, price: recentData[i].low })
    }
  }
  
  if (troughs.length < 2) return null
  
  const lastTwo = troughs.slice(-2)
  const [firstTrough, secondTrough] = lastTwo
  
  const priceDiff = Math.abs(firstTrough.price - secondTrough.price) / firstTrough.price
  
  if (priceDiff < 0.015 && secondTrough.index - firstTrough.index > 5) {
    const peakPrice = Math.max(...recentData.slice(firstTrough.index, secondTrough.index + 1).map(c => c.high))
    
    return {
      type: 'double_bottom',
      confidence: 70,
      startIndex: ohlcData.length - lookback + firstTrough.index,
      endIndex: ohlcData.length - 1,
      description: 'Double Bottom - Bullish reversal pattern detected',
      signal: 'bullish',
      targetPrice: peakPrice + (peakPrice - firstTrough.price)
    }
  }
  
  return null
}

// ==================== TRIANGLES ====================

/**
 * Detect Ascending Triangle pattern
 */
export function detectAscendingTriangle(ohlcData: OHLC[], lookback: number = 20): DetectedPattern | null {
  if (ohlcData.length < lookback) return null
  
  const recentData = ohlcData.slice(-lookback)
  
  // Find highs (should be relatively flat - resistance)
  const highs = recentData.map(c => c.high)
  const highsAvg = highs.reduce((a, b) => a + b, 0) / highs.length
  const highsVariance = highs.reduce((sum, val) => sum + Math.pow(val - highsAvg, 2), 0) / highs.length
  const highsStdDev = Math.sqrt(highsVariance)
  
  // Find lows (should be ascending)
  const lows = recentData.map(c => c.low)
  const firstHalfLows = lows.slice(0, Math.floor(lows.length / 2))
  const secondHalfLows = lows.slice(Math.floor(lows.length / 2))
  const firstHalfAvg = firstHalfLows.reduce((a, b) => a + b, 0) / firstHalfLows.length
  const secondHalfAvg = secondHalfLows.reduce((a, b) => a + b, 0) / secondHalfLows.length
  
  // Highs flat (low variance), Lows rising
  if (highsStdDev / highsAvg < 0.01 && secondHalfAvg > firstHalfAvg * 1.005) {
    return {
      type: 'ascending_triangle',
      confidence: 65,
      startIndex: ohlcData.length - lookback,
      endIndex: ohlcData.length - 1,
      description: 'Ascending Triangle - Bullish continuation pattern',
      signal: 'bullish',
      targetPrice: highsAvg + (highsAvg - firstHalfAvg)
    }
  }
  
  return null
}

/**
 * Detect Descending Triangle pattern
 */
export function detectDescendingTriangle(ohlcData: OHLC[], lookback: number = 20): DetectedPattern | null {
  if (ohlcData.length < lookback) return null
  
  const recentData = ohlcData.slice(-lookback)
  
  // Find lows (should be relatively flat - support)
  const lows = recentData.map(c => c.low)
  const lowsAvg = lows.reduce((a, b) => a + b, 0) / lows.length
  const lowsVariance = lows.reduce((sum, val) => sum + Math.pow(val - lowsAvg, 2), 0) / lows.length
  const lowsStdDev = Math.sqrt(lowsVariance)
  
  // Find highs (should be descending)
  const highs = recentData.map(c => c.high)
  const firstHalfHighs = highs.slice(0, Math.floor(highs.length / 2))
  const secondHalfHighs = highs.slice(Math.floor(highs.length / 2))
  const firstHalfAvg = firstHalfHighs.reduce((a, b) => a + b, 0) / firstHalfHighs.length
  const secondHalfAvg = secondHalfHighs.reduce((a, b) => a + b, 0) / secondHalfHighs.length
  
  // Lows flat (low variance), Highs falling
  if (lowsStdDev / lowsAvg < 0.01 && secondHalfAvg < firstHalfAvg * 0.995) {
    return {
      type: 'descending_triangle',
      confidence: 65,
      startIndex: ohlcData.length - lookback,
      endIndex: ohlcData.length - 1,
      description: 'Descending Triangle - Bearish continuation pattern',
      signal: 'bearish',
      targetPrice: lowsAvg - (firstHalfAvg - lowsAvg)
    }
  }
  
  return null
}

// ==================== FLAGS ====================

/**
 * Detect Bullish Flag pattern
 */
export function detectBullishFlag(ohlcData: OHLC[], lookback: number = 15): DetectedPattern | null {
  if (ohlcData.length < lookback + 5) return null
  
  // Need strong uptrend before flag
  const preData = ohlcData.slice(-(lookback + 5), -lookback)
  const flagData = ohlcData.slice(-lookback)
  
  const preStart = preData[0].close
  const preEnd = preData[preData.length - 1].close
  const priceIncrease = (preEnd - preStart) / preStart
  
  // Need at least 3% rise before flag
  if (priceIncrease < 0.03) return null
  
  // Flag should be sideways/slightly down consolidation
  const flagStart = flagData[0].close
  const flagEnd = flagData[flagData.length - 1].close
  const flagChange = (flagEnd - flagStart) / flagStart
  
  // Flag should be small consolidation (between -2% and +1%)
  if (flagChange >= -0.02 && flagChange <= 0.01) {
    return {
      type: 'bullish_flag',
      confidence: 60,
      startIndex: ohlcData.length - lookback,
      endIndex: ohlcData.length - 1,
      description: 'Bullish Flag - Continuation pattern, expect breakout upwards',
      signal: 'bullish',
      targetPrice: flagEnd + (preEnd - preStart)
    }
  }
  
  return null
}

/**
 * Detect Bearish Flag pattern
 */
export function detectBearishFlag(ohlcData: OHLC[], lookback: number = 15): DetectedPattern | null {
  if (ohlcData.length < lookback + 5) return null
  
  const preData = ohlcData.slice(-(lookback + 5), -lookback)
  const flagData = ohlcData.slice(-lookback)
  
  const preStart = preData[0].close
  const preEnd = preData[preData.length - 1].close
  const priceDecrease = (preStart - preEnd) / preStart
  
  // Need at least 3% fall before flag
  if (priceDecrease < 0.03) return null
  
  const flagStart = flagData[0].close
  const flagEnd = flagData[flagData.length - 1].close
  const flagChange = (flagEnd - flagStart) / flagStart
  
  // Flag should be small consolidation (between -1% and +2%)
  if (flagChange >= -0.01 && flagChange <= 0.02) {
    return {
      type: 'bearish_flag',
      confidence: 60,
      startIndex: ohlcData.length - lookback,
      endIndex: ohlcData.length - 1,
      description: 'Bearish Flag - Continuation pattern, expect breakout downwards',
      signal: 'bearish',
      targetPrice: flagEnd - (preStart - preEnd)
    }
  }
  
  return null
}

// ==================== MAIN DETECTION FUNCTION ====================

/**
 * Detect all patterns and return the most confident one
 */
export function detectPatterns(ohlcData: OHLC[]): DetectedPattern | null {
  if (ohlcData.length < 20) return null
  
  const patterns: (DetectedPattern | null)[] = [
    detectHeadAndShoulders(ohlcData),
    detectInverseHeadAndShoulders(ohlcData),
    detectDoubleTop(ohlcData),
    detectDoubleBottom(ohlcData),
    detectAscendingTriangle(ohlcData),
    detectDescendingTriangle(ohlcData),
    detectBullishFlag(ohlcData),
    detectBearishFlag(ohlcData),
  ]
  
  // Filter out nulls and sort by confidence
  const validPatterns = patterns.filter((p): p is DetectedPattern => p !== null)
  
  if (validPatterns.length === 0) return null
  
  // Return pattern with highest confidence
  return validPatterns.sort((a, b) => b.confidence - a.confidence)[0]
}

/**
 * Get all detected patterns (not just the best one)
 */
export function detectAllPatterns(ohlcData: OHLC[]): DetectedPattern[] {
  if (ohlcData.length < 20) return []
  
  const patterns: (DetectedPattern | null)[] = [
    detectHeadAndShoulders(ohlcData),
    detectInverseHeadAndShoulders(ohlcData),
    detectDoubleTop(ohlcData),
    detectDoubleBottom(ohlcData),
    detectAscendingTriangle(ohlcData),
    detectDescendingTriangle(ohlcData),
    detectBullishFlag(ohlcData),
    detectBearishFlag(ohlcData),
  ]
  
  return patterns.filter((p): p is DetectedPattern => p !== null)
}

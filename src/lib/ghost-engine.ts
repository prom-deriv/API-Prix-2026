/**
 * Ghost Engine - Virtual Matching Engine for Ghost Lab
 * 
 * This engine simulates trade settlement locally without making any API calls.
 * It monitors live tick data from the existing Deriv API subscription
 * and settles ghost trades based on price movement.
 */

import type { GhostTrade } from "../contexts/GhostContext"

export interface GhostSettlementResult {
  won: boolean
  exitPrice: number
  profit: number
  mochiPoints: number
}

/**
 * Calculate trade duration in milliseconds
 */
export function calculateDurationMs(duration: number, unit: string): number {
  switch (unit) {
    case "t":
      return duration * 1000 // 1 second per tick for ghost mode
    case "s":
      return duration * 1000
    case "m":
      return duration * 60 * 1000
    case "h":
      return duration * 60 * 60 * 1000
    case "d":
      return duration * 24 * 60 * 60 * 1000
    default:
      return duration * 1000
  }
}

/**
 * Determine if a trade should be settled based on current time
 */
export function shouldSettleTrade(
  trade: GhostTrade,
  currentTime: number
): boolean {
  const durationMs = calculateDurationMs(trade.duration, trade.durationUnit)
  const elapsed = currentTime - trade.timestamp
  return elapsed >= durationMs
}

/**
 * Calculate settlement result for a ghost trade
 */
export function calculateSettlement(
  trade: GhostTrade,
  exitPrice: number
): GhostSettlementResult {
  const { contractType, entryPrice, amount } = trade

  let won = false

  // Settlement logic based on contract type
  switch (contractType) {
    case "CALL":
      // RISE: wins if exit price is higher than entry
      won = exitPrice > entryPrice
      break
    case "PUT":
      // FALL: wins if exit price is lower than entry
      won = exitPrice < entryPrice
      break
    case "ONETOUCH":
      // TOUCH: wins if price touched the barrier (simplified)
      // In ghost mode, we check if price moved significantly from entry
      won = Math.abs(exitPrice - entryPrice) > entryPrice * 0.0005
      break
    case "NOTOUCH":
      // NO TOUCH: wins if price stayed close to entry
      won = Math.abs(exitPrice - entryPrice) <= entryPrice * 0.0005
      break
    default:
      // Default to CALL logic
      won = exitPrice > entryPrice
  }

  // Calculate profit (80% payout in ghost mode)
  const payout = amount * 1.8
  const profit = won ? payout - amount : -amount

  // Mochi Points: 10 points per $1 wagered on wins
  const mochiPoints = won ? Math.floor(amount * 10) : 0

  return { won, exitPrice, profit, mochiPoints }
}

/**
 * Format duration for display
 */
export function formatDuration(duration: number, unit: string): string {
  const unitLabels: Record<string, string> = {
    t: "ticks",
    s: "seconds",
    m: "minutes",
    h: "hours",
    d: "days",
  }
  return `${duration} ${unitLabels[unit] || unit}`
}

/**
 * Calculate progress percentage for an active trade
 */
export function calculateTradeProgress(trade: GhostTrade, currentTime: number): number {
  const durationMs = calculateDurationMs(trade.duration, trade.durationUnit)
  const elapsed = currentTime - trade.timestamp
  const progress = Math.min(100, (elapsed / durationMs) * 100)
  return Math.max(0, progress)
}

/**
 * Get time remaining for an active trade
 */
export function getTimeRemaining(trade: GhostTrade, currentTime: number): number {
  const durationMs = calculateDurationMs(trade.duration, trade.durationUnit)
  const elapsed = currentTime - trade.timestamp
  return Math.max(0, durationMs - elapsed)
}

/**
 * Format time remaining as human-readable string
 */
export function formatTimeRemaining(trade: GhostTrade, currentTime: number): string {
  const remainingMs = getTimeRemaining(trade, currentTime)
  const seconds = Math.ceil(remainingMs / 1000)
  
  if (seconds <= 0) return "Settling..."
  if (seconds < 60) return `${seconds}s remaining`
  
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}m ${secs}s remaining`
}
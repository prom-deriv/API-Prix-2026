import { useState } from "react"
import { useTradingStore } from "../../stores/tradingStore"
import { Card } from "../ui/card"
import { Button } from "../ui/button"
import { getDerivAPI } from "../../lib/deriv-api"
import { TrendingUp, TrendingDown, X, DollarSign, Clock } from "lucide-react"

const formatTimeLeft = (expiry: number, unit?: string, duration?: number, startTime?: number) => {
  const now = Math.floor(Date.now() / 1000)
  
  if (unit && duration && startTime) {
    const elapsed = now - startTime
    let remainingUnitValue = 0
    let unitLabel = ""

    switch (unit) {
      case "s":
        remainingUnitValue = Math.max(0, duration - elapsed)
        unitLabel = "s"
        break
      case "m":
        remainingUnitValue = Math.max(0, duration - Math.floor(elapsed / 60))
        unitLabel = "m"
        break
      case "h":
        remainingUnitValue = Math.max(0, duration - Math.floor(elapsed / 3600))
        unitLabel = "h"
        break
      case "d":
        remainingUnitValue = Math.max(0, duration - Math.floor(elapsed / 86400))
        unitLabel = "d"
        break
    }

    if (unitLabel) {
      return `${remainingUnitValue}${unitLabel} left`
    }
  }

  // Fallback to standard expiry countdown if unit/duration info is missing or invalid
  const diff = Math.max(0, expiry - now)
  if (diff === 0) return "00:00"
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = Math.floor(diff % 60)
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

import { useEffect } from "react"

export default function ActiveContractsPanel() {
  const activeContracts = useTradingStore((state) => state.activeContracts)
  const removeActiveContract = useTradingStore((state) => state.removeActiveContract)
  const addRecentTrade = useTradingStore((state) => state.addRecentTrade)
  
  const [sellLoading, setSellLoading] = useState<number | null>(null)
  
  // Force re-render every second to update the countdown
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1)
      
      // Sweep for expired mock or desynced real contracts
      const now = Math.floor(Date.now() / 1000)
      activeContracts.forEach(contract => {
        // Auto-close mock contracts that have reached 0 ticks
        if (contract.shortcode.includes("_demo_") && contract.duration_unit === "t") {
          const ticksElapsed = now - contract.date_start
          if (contract.duration && ticksElapsed >= contract.duration) {
            handleSellContract(contract.contract_id, contract.bid_price || 0)
          }
        } else if (contract.shortcode.includes("_demo_") && contract.date_expiry) {
          // Auto-close mock contracts that have reached expiry time
          if (now >= contract.date_expiry) {
            handleSellContract(contract.contract_id, contract.bid_price || 0)
          }
        }
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [activeContracts])

  const handleSellContract = async (contractId: number, sellPrice: number) => {
    setSellLoading(contractId)
    try {
      const contract = activeContracts.find(c => c.contract_id === contractId)
      
      // Check if it's a demo mock contract
      if (contract && contract.shortcode.includes("_demo_")) {
        console.log("[ActiveContracts] Mock contract sold:", contract)
        addRecentTrade({
          app_id: import.meta.env.VITE_DERIV_APP_ID || "1089",
          buy_price: contract.buy_price,
          contract_id: contractId,
          contract_type: contract.contract_type,
          currency: contract.currency,
          date_expiry: contract.date_expiry,
          date_start: contract.date_start,
          longcode: contract.longcode,
          payout: contract.payout,
          profit: contract.profit,
          sell_price: contract.bid_price || 0,
          sell_time: Date.now() / 1000,
          shortcode: contract.shortcode,
          transaction_id: Date.now(),
        })
        removeActiveContract(contractId)
        return
      }

      const api = getDerivAPI()
      const result = await api.sellContract(contractId, sellPrice)
      
      console.log("[ActiveContracts] Contract sold:", result)
      
      // Add to recent trades
      if (contract) {
        addRecentTrade({
          app_id: import.meta.env.VITE_DERIV_APP_ID || "1089",
          buy_price: contract.buy_price || 0,
          contract_id: contractId,
          contract_type: contract.contract_type,
          currency: contract.currency || "USD",
          date_expiry: contract.date_expiry || 0,
          date_start: contract.date_start || 0,
          longcode: contract.longcode || "",
          payout: contract.payout || 0,
          profit: contract.profit || 0,
          sell_price: result.sold_for || contract.bid_price || 0,
          sell_time: Date.now() / 1000,
          shortcode: contract.shortcode || "",
          transaction_id: result.transaction_id || contract.transaction_ids?.buy || 0,
          entry_tick: contract.entry_spot,
          exit_tick: contract.current_spot,
          entry_tick_display_value: contract.entry_spot_display_value,
          exit_tick_display_value: contract.current_spot_display_value,
        })
      }
      
      // Remove from active contracts
      removeActiveContract(contractId)
    } catch (error) {
      console.error("[ActiveContracts] Failed to sell contract:", error)
      alert("Failed to sell contract. Please try again.")
    } finally {
      setSellLoading(null)
    }
  }

  if (activeContracts.length === 0) {
    return (
      <Card className="p-6 h-full flex flex-col justify-center items-center">
        <div className="text-center text-gray-500">
          <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No active contracts</p>
          <p className="text-xs mt-1">Your open trades will appear here</p>
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card className="p-4 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            Active Contracts ({activeContracts.length})
          </h3>
        </div>

        <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2 scrollbar-thin">
          {activeContracts.map((contract) => {
            const isProfitable = Number(contract.profit) > 0
            const profitPercentage = ((Number(contract.profit) / Number(contract.buy_price)) * 100).toFixed(2)
            const isExpired = contract.is_expired === 1
            const isSold = contract.is_sold === 1

            return (
              <div
                key={contract.contract_id}
                className="border rounded-lg p-4 space-y-3 bg-muted/30 border-amber-500/10"
              >
                {/* Contract Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{contract.display_name}</h4>
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${
                          contract.contract_type.includes("CALL") || contract.contract_type.includes("RISE")
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                        }`}
                      >
                        {contract.contract_type}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {contract.shortcode}
                    </p>
                  </div>

                  {/* Status Badge & Timelapse */}
                  <div className="flex flex-col items-end gap-1">
                    {(isExpired || isSold) ? (
                      <span className="px-2 py-1 text-xs bg-muted rounded font-medium text-muted-foreground">
                        {contract.status.toUpperCase()}
                      </span>
                    ) : (
                      contract.duration_unit === "t" && contract.duration ? (
                        <div className="flex items-center gap-1.5 text-xs font-mono bg-background/50 border px-2 py-1 rounded shadow-sm text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {/* Live Ticks Countdown: Use real ticks if available, otherwise estimate for mock offline demo */}
                          {(() => {
                            let passedTicks = 0;
                            if (contract.tick_stream && contract.tick_stream.length > 0) {
                              passedTicks = contract.tick_stream.length;
                            } else if (contract.audit?.all_ticks?.length) {
                              passedTicks = contract.audit.all_ticks.length;
                            } else if (contract.shortcode.includes("_demo_")) {
                              passedTicks = Math.floor((Date.now() / 1000) - contract.date_start);
                            }
                            return `${Math.max(0, contract.duration - passedTicks)} Ticks left`;
                          })()}
                        </div>
                      ) : contract.date_expiry ? (
                        <div className="flex items-center gap-1.5 text-xs font-mono bg-background/50 border px-2 py-1 rounded shadow-sm text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatTimeLeft(contract.date_expiry, contract.duration_unit, contract.duration, contract.date_start)}
                        </div>
                      ) : null
                    )}
                  </div>
                </div>

                {/* Price Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Entry Price</p>
                    <p className="font-semibold tabular-nums">{contract.entry_spot_display_value || contract.entry_spot || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Current Price</p>
                    <p className="font-semibold tabular-nums">{contract.current_spot_display_value || contract.current_spot || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Buy Price</p>
                    <p className="font-semibold tabular-nums">${Number(contract.buy_price).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Payout</p>
                    <p className="font-semibold tabular-nums">${Number(contract.payout).toFixed(2)}</p>
                  </div>
                </div>

                {/* P&L Display */}
                <div
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isProfitable
                      ? "bg-profit/10 border-profit/20"
                      : "bg-loss/10 border-loss/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isProfitable ? (
                      <TrendingUp className="w-5 h-5 text-profit" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-loss" />
                    )}
                    <span className={`font-semibold tabular-nums ${isProfitable ? 'text-profit' : 'text-loss'}`}>
                      {isProfitable ? "+" : ""}${Number(contract.profit).toFixed(2)}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-medium tabular-nums ${
                      isProfitable
                        ? "text-profit"
                        : "text-loss"
                    }`}
                  >
                    {isProfitable ? "+" : ""}{profitPercentage}% ROI
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    onClick={() => handleSellContract(contract.contract_id, contract.bid_price)}
                    disabled={isExpired || isSold || sellLoading === contract.contract_id}
                  >
                    {sellLoading === contract.contract_id ? (
                      "Selling..."
                    ) : (
                      <>
                        <X className="w-4 h-4 mr-1" />
                        Sell Now
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </>
  )
}

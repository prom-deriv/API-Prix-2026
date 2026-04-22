import React, { useState, useCallback, useEffect } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Select } from "../ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { useTradingStore } from "../../stores/tradingStore"
import { useGhost } from "../../contexts/GhostContext"
import { useAccount } from "../../contexts/AccountContext"
import { getDerivAPI } from "../../lib/deriv-api"
import { formatCurrency, formatNumber } from "../../lib/utils"
import { calculateDurationMs, calculateTradeProgress, formatTimeRemaining } from "../../lib/ghost-engine"
import { TrendingUp, TrendingDown, Loader2, Sparkles } from "lucide-react"
import type { ContractType, DurationUnit, TradeParams } from "../../types/deriv"

const durationUnitOptions = [
  { value: "t", label: "Ticks" },
  { value: "s", label: "Seconds" },
  { value: "m", label: "Minutes" },
]

const contractCategoryOptions: { value: ContractCategory; label: string }[] = [
  { value: "RISE_FALL", label: "Rise/Fall" },
]

type ContractCategory = "RISE_FALL"

export interface GhostTradingPanelProps {
  onTradeStart?: (amount: number) => void
}

const GhostTradingPanel: React.FC<GhostTradingPanelProps> = ({ onTradeStart }) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const { currentSymbol, currentTick, addDerivPoints } = useTradingStore()
  const { balance, accountType, loginId, refreshBalance } = useAccount()
  const { addGhostTrade, settleGhostTrade, activeGhostTrade, mascotEmotion } = useGhost()
  
  const [amount, setAmount] = useState<string>("10")
  const [duration, setDuration] = useState<string>("5")
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("t")
  const [contractCategory, setContractCategory] = useState<ContractCategory>("RISE_FALL")
  const [error, setError] = useState<string | null>(null)
  const [isTrading, setIsTrading] = useState(false)
  const [tradeProgress, setTradeProgress] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState("")
  
  // Monitor active trade and settle when duration expires
  useEffect(() => {
    if (!activeGhostTrade || !currentTick) return

    const checkSettlement = () => {
      const now = Date.now()
      const progress = calculateTradeProgress(activeGhostTrade, now)
      setTradeProgress(progress)
      setTimeRemaining(formatTimeRemaining(activeGhostTrade, now))

      const durationMs = calculateDurationMs(activeGhostTrade.duration, activeGhostTrade.durationUnit)
      const elapsed = now - activeGhostTrade.timestamp

      if (elapsed >= durationMs) {
        // Settle the trade
        const exitPrice = currentTick.quote
        settleGhostTrade(activeGhostTrade.id, exitPrice)
        setIsTrading(false)
        setTradeProgress(0)
        setTimeRemaining("")
      }
    }

    // Check immediately
    checkSettlement()

    // Check every 100ms
    const interval = setInterval(checkSettlement, 100)

    return () => clearInterval(interval)
  }, [activeGhostTrade, currentTick, settleGhostTrade])

  // Clear error when account changes
  useEffect(() => {
    setError(null)
  }, [accountType, loginId])

  // Reset mascot emotion after 3 seconds
  useEffect(() => {
    if (mascotEmotion === "win" || mascotEmotion === "lose") {
      const timer = setTimeout(() => {
        // Emotion will reset when new trade starts
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [mascotEmotion])

  const executeGhostTrade = useCallback(async (contractType: ContractType) => {
    if (!currentTick) {
      setError("No price data available")
      return
    }

    const tradeAmount = parseFloat(amount)
    if (isNaN(tradeAmount) || tradeAmount <= 0) {
      setError("Invalid amount")
      return
    }

    if (tradeAmount > balance) {
      setError(`Insufficient ${accountType} balance`)
      return
    }

    setError(null)
    setIsTrading(true)

    try {
      const isConnectedDemo = localStorage.getItem("deriv_access_token") && localStorage.getItem("deriv_access_token") !== "null";
      if (accountType === "real" || (accountType === "demo" && isConnectedDemo)) {
        const api = getDerivAPI()
        const isReady = await api.waitUntilReady(5000)
        if (!isReady) throw new Error("API not ready")

        const params: TradeParams = {
          symbol: currentSymbol,
          amount: tradeAmount,
          basis: "stake",
          contract_type: contractType,
          duration: parseInt(duration),
          duration_unit: durationUnit,
          currency: "USD",
        }
        
        const proposal = await api.getProposal(params)
        const buyResult = await api.buyContract(proposal.id, proposal.ask_price)
        
        if (buyResult?.contract_id) {
          refreshBalance()
          const tradeId = `ghost-${buyResult.contract_id}`
          
          addGhostTrade({
            id: tradeId,
            symbol: currentSymbol,
            contractType,
            amount: tradeAmount,
            entryPrice: currentTick.quote,
            duration: parseInt(duration),
            durationUnit,
          })

          api.subscribeProposalOpenContract(buyResult.contract_id, (contract) => {
            if (contract.is_sold === 1 || contract.status === "sold") {
              const profit = contract.profit || 0
              settleGhostTrade(
                tradeId,
                contract.sell_spot || contract.current_spot || 0,
                profit,
                profit > 0 ? "win" : "loss"
              )
              setIsTrading(false)
              setTradeProgress(0)
              setTimeRemaining("")
            }
          })
        }
      } else {
        // Demo local simulation
        addGhostTrade({
          symbol: currentSymbol,
          contractType,
          amount: tradeAmount,
          entryPrice: currentTick.quote,
          duration: parseInt(duration),
          durationUnit,
        })
      }

      // Add Deriv Points based on the stake amount
      const pointsAwarded = Math.floor(tradeAmount)
      if (pointsAwarded > 0) {
        addDerivPoints(pointsAwarded)
      }

      // Minimize dashboard when trade starts
      setIsExpanded(false)

      if (onTradeStart) {
        onTradeStart(tradeAmount)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute trade")
      setIsTrading(false)
    }
  }, [currentTick, amount, duration, durationUnit, currentSymbol, addGhostTrade, balance, accountType, onTradeStart, settleGhostTrade, refreshBalance])

  const isDisabled = isTrading || !currentTick || !!activeGhostTrade

  if (!isExpanded) {
    return (
      <Button
        onClick={() => setIsExpanded(true)}
        className="w-full flex items-center justify-center gap-2 rounded-2xl py-6 shadow-xl"
        style={{
          backgroundColor: "#FFFFFF",
          border: "2px solid #F0E4D7",
          color: "#8B5E3C",
          fontFamily: "'Quicksand', 'Nunito', sans-serif",
          fontWeight: "bold",
          fontSize: "1.1rem"
        }}
      >
        <Sparkles className="h-5 w-5" style={{ color: "#FF6B9D" }} />
        Open Ghost Trade
        {activeGhostTrade && (
          <span className="ml-2 px-2 py-1 rounded-full text-xs" style={{ backgroundColor: "#FFE5F0" }}>
            Trade Active
          </span>
        )}
      </Button>
    )
  }

  return (
    <Card className="w-full relative transition-all" style={{
      borderRadius: "24px",
      border: "2px solid #F0E4D7",
      boxShadow: "0 10px 30px rgba(166, 123, 91, 0.08)",
      backgroundColor: "rgba(255, 255, 255, 0.95)",
      backdropFilter: "blur(10px)",
      transformOrigin: "bottom right"
    }}>
      <Button 
        variant="ghost" 
        size="sm" 
        className="absolute top-2 right-2 h-8 w-8 rounded-full p-0"
        onClick={() => setIsExpanded(false)}
        style={{ color: "#8B5E3C" }}
      >
        ✕
      </Button>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between pr-6" style={{
          fontFamily: "'Quicksand', 'Nunito', sans-serif",
          color: "#8B5E3C"
        }}>
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" style={{ color: "#FF6B9D" }} />
            Ghost Trade
          </span>
          {currentTick && (
            <span className="text-sm font-normal" style={{ color: "#8B5E3C", opacity: 0.7 }}>
              {formatNumber(currentTick.quote, 5)}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Active Trade Progress */}
        {activeGhostTrade && (
          <div className="p-4 rounded-2xl space-y-3" style={{
            backgroundColor: "#FFF9F2",
            border: "2px solid #B5C0D0"
          }}>
            <div className="flex items-center justify-between text-sm" style={{ color: "#8B5E3C" }}>
              <span className="font-medium">
                {activeGhostTrade.contractType === "CALL" ? "RISE" : "FALL"} Trade Active
              </span>
              <span className="font-mono">{timeRemaining}</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#F0E4D7" }}>
              <div 
                className="h-full rounded-full transition-all duration-100"
                style={{ 
                  width: `${tradeProgress}%`,
                  backgroundColor: "#B5C0D0"
                }}
              />
            </div>
            <div className="flex justify-between text-xs" style={{ color: "#8B5E3C", opacity: 0.7 }}>
              <span>Entry: {formatNumber(activeGhostTrade.entryPrice, 5)}</span>
              <span>Stake: {formatCurrency(activeGhostTrade.amount)}</span>
            </div>
          </div>
        )}

        {/* Contract Type */}
        <div className="space-y-2">
          <label className="text-sm font-medium" style={{ color: "#8B5E3C" }}>Contract Type</label>
          <div className="flex gap-2 p-1 rounded-2xl" style={{ backgroundColor: "#FFF9F2" }}>
            {contractCategoryOptions.map((option) => (
              <Button
                key={option.value}
                variant={contractCategory === option.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setContractCategory(option.value as ContractCategory)}
                disabled={isDisabled}
                className="flex-1 text-xs rounded-xl"
                style={{
                  backgroundColor: contractCategory === option.value ? "#B5C0D0" : "transparent",
                  color: contractCategory === option.value ? "#FFFFFF" : "#8B5E3C",
                  border: "none"
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Stake Amount */}
        <div className="space-y-2">
          <label className="text-sm font-medium" style={{ color: "#8B5E3C" }}>
            Stake Amount ({accountType === "demo" ? "Demo" : "Real"}: {formatCurrency(balance)})
          </label>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="10.00"
            value={amount}
            onChange={(e) => {
              if (/^\d*\.?\d*$/.test(e.target.value)) {
                setAmount(e.target.value)
              }
            }}
            disabled={isDisabled}
            className="text-lg rounded-xl"
            style={{
              backgroundColor: "#FFF9F2",
              border: "2px solid #F0E4D7",
              color: "#8B5E3C"
            }}
          />
        </div>

        {/* Duration */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "#8B5E3C" }}>Duration</label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="5"
              value={duration}
              onChange={(e) => {
                if (/^\d*$/.test(e.target.value)) {
                  setDuration(e.target.value)
                }
              }}
              disabled={isDisabled}
              className="rounded-xl"
              style={{
                backgroundColor: "#FFF9F2",
                border: "2px solid #F0E4D7",
                color: "#8B5E3C"
              }}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "#8B5E3C" }}>Unit</label>
            <Select
              options={durationUnitOptions}
              value={durationUnit}
              onChange={(e) => setDurationUnit(e.target.value as DurationUnit)}
              disabled={isDisabled}
            />
          </div>
        </div>

        {/* Payout Info */}
        <div className="p-3 rounded-2xl space-y-1" style={{ backgroundColor: "#FFF9F2" }}>
          <div className="flex justify-between text-sm">
            <span style={{ color: "#8B5E3C", opacity: 0.7 }}>Potential Payout:</span>
            <span className="font-medium" style={{ color: "#DFF2D8" }}>
              {formatCurrency(parseFloat(amount || "0") * 1.8)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: "#8B5E3C", opacity: 0.7 }}>Mochi Points:</span>
            <span className="font-medium" style={{ color: "#B5C0D0" }}>
              +{Math.floor(parseFloat(amount || "0") * 10)} pts
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-2xl text-sm" style={{
            backgroundColor: "#FFE5E5",
            color: "#8B5E3C"
          }}>
            {error}
          </div>
        )}

        {/* Trade Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="profit"
            size="xl"
            onClick={() => executeGhostTrade("CALL")}
            disabled={isDisabled}
            className="flex items-center gap-2 rounded-2xl font-bold"
            style={{
              backgroundColor: "#DFF2D8",
              color: "#8B5E3C",
              border: "2px solid #DFF2D8"
            }}
          >
            {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <TrendingUp className="h-5 w-5" />}
            <div className="flex flex-col">
              <span className="text-base font-bold">RISE</span>
              <span className="text-xs opacity-80">Price goes up</span>
            </div>
          </Button>
          <Button
            variant="loss"
            size="xl"
            onClick={() => executeGhostTrade("PUT")}
            disabled={isDisabled}
            className="flex items-center gap-2 rounded-2xl font-bold"
            style={{
              backgroundColor: "#FFE5E5",
              color: "#8B5E3C",
              border: "2px solid #FFE5E5"
            }}
          >
            {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <TrendingDown className="h-5 w-5" />}
            <div className="flex flex-col">
              <span className="text-base font-bold">FALL</span>
              <span className="text-xs opacity-80">Price goes down</span>
            </div>
          </Button>
        </div>

        {/* Quick Amount Buttons */}
        <div className="flex gap-2">
          {["5", "10", "25", "50"].map((quickAmount) => (
            <Button
              key={quickAmount}
              variant="outline"
              size="sm"
              onClick={() => setAmount(quickAmount)}
              disabled={isDisabled}
              className="flex-1 rounded-xl"
              style={{
                backgroundColor: amount === quickAmount ? "#B5C0D0" : "#FFF9F2",
                color: amount === quickAmount ? "#FFFFFF" : "#8B5E3C",
                border: "2px solid #F0E4D7"
              }}
            >
              ${quickAmount}
            </Button>
          ))}
        </div>

        {/* Ghost Mode Badge */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium" style={{
            backgroundColor: "#FFF9F2",
            color: "#8B5E3C",
            border: "2px solid #B5C0D0"
          }}>
            <Sparkles className="h-3 w-3" />
            Ghost Mode
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export default GhostTradingPanel
import React, { useState, useCallback, useEffect } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Select } from "../ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { useTradingStore } from "../../stores/tradingStore"
import { getDerivAPI } from "../../lib/deriv-api"
import { formatCurrency, formatNumber } from "../../lib/utils"
import { TrendingUp, TrendingDown, Loader2, Target } from "lucide-react"
import type { ContractType, DurationUnit, TradeParams } from "../../types/deriv"

const durationUnitOptions = [
  { value: "t", label: "Ticks" },
  { value: "s", label: "Seconds" },
  { value: "m", label: "Minutes" },
  { value: "h", label: "Hours" },
  { value: "d", label: "Days" },
]

type ContractCategory = "RISE_FALL" | "HIGHER_LOWER" | "TOUCH_NO_TOUCH"

const contractCategoryOptions: { value: ContractCategory; label: string }[] = [
  { value: "RISE_FALL", label: "Rise/Fall" },
  { value: "HIGHER_LOWER", label: "Higher/Lower" },
  { value: "TOUCH_NO_TOUCH", label: "Touch/No Touch" },
]

const TradingPanel: React.FC = () => {
  const { currentSymbol, currentTick, isTrading, setIsTrading, setBarrier, barrier } = useTradingStore()
  const [amount, setAmount] = useState<string>("10")
  const [duration, setDuration] = useState<string>("5")
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("t")
  const [proposal, setProposal] = useState<{ id: string; ask_price: number; payout: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [contractCategory, setContractCategory] = useState<ContractCategory>("RISE_FALL")

  // Calculate and set barrier based on contract category and current price
  useEffect(() => {
    if (!currentTick) {
      setBarrier(null)
      return
    }

    const currentPrice = currentTick.quote

    if (contractCategory === "RISE_FALL") {
      // Rise/Fall doesn't use a barrier
      setBarrier(null)
    } else if (contractCategory === "HIGHER_LOWER") {
      // Higher/Lower uses a barrier offset from current price
      // Set barrier 10 points above current price for demonstration
      setBarrier(currentPrice + 10)
    } else if (contractCategory === "TOUCH_NO_TOUCH") {
      // Touch/No Touch uses an absolute barrier price
      // Set barrier 20 points above current price for demonstration
      setBarrier(currentPrice + 20)
    }
  }, [contractCategory, currentTick, setBarrier])

  const getProposal = useCallback(async (contractType: ContractType) => {
    if (!currentSymbol || !amount || !duration) return
    setError(null)
    setIsTrading(true)
    try {
      const api = getDerivAPI()
      const params: TradeParams = {
        symbol: currentSymbol,
        amount: parseFloat(amount),
        basis: "stake",
        contract_type: contractType,
        duration: parseInt(duration),
        duration_unit: durationUnit,
        currency: "USD",
        ...(barrier !== null && { barrier: barrier.toString() }),
      }
      const result = await api.getProposal(params)
      setProposal({ id: result.id, ask_price: result.ask_price, payout: result.payout })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get proposal")
      setProposal(null)
    } finally {
      setIsTrading(false)
    }
  }, [currentSymbol, amount, duration, durationUnit, setIsTrading, barrier])

  const executeTrade = useCallback(async (contractType: ContractType) => {
    if (!proposal) {
      await getProposal(contractType)
      return
    }
    setError(null)
    setIsTrading(true)
    try {
      const api = getDerivAPI()
      await api.buyContract(proposal.id, proposal.ask_price)
      setProposal(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute trade")
    } finally {
      setIsTrading(false)
    }
  }, [proposal, setIsTrading, getProposal])

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Quick Trade</span>
          {currentTick && (
            <span className="text-sm font-normal text-muted-foreground">
              {formatNumber(currentTick.quote, 5)}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Contract Type</label>
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {contractCategoryOptions.map((option) => (
              <Button
                key={option.value}
                variant={contractCategory === option.value ? "default" : "ghost"}
                size="sm"
                onClick={() => { setContractCategory(option.value); setProposal(null) }}
                className="flex-1 text-xs"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Stake Amount (USD)</label>
          <Input type="text" inputMode="decimal" placeholder="10.00" value={amount}
            onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) { setAmount(e.target.value); setProposal(null) } }}
            className="text-lg" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Duration</label>
            <Input type="text" inputMode="numeric" placeholder="5" value={duration}
              onChange={(e) => { if (/^\d*$/.test(e.target.value)) { setDuration(e.target.value); setProposal(null) } }} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Unit</label>
            <Select options={durationUnitOptions} value={durationUnit}
              onChange={(e) => { setDurationUnit(e.target.value as DurationUnit); setProposal(null) }} />
          </div>
        </div>
        {proposal && (
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Potential Payout:</span>
              <span className="font-medium text-profit">{formatCurrency(proposal.payout)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cost:</span>
              <span className="font-medium">{formatCurrency(proposal.ask_price)}</span>
            </div>
          </div>
        )}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}
        <div className="grid grid-cols-2 gap-3">
          {contractCategory === "RISE_FALL" && (
            <>
              <Button variant="profit" size="xl" onClick={() => executeTrade("CALL")} disabled={isTrading || !currentSymbol} className="flex items-center gap-2">
                {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <TrendingUp className="h-5 w-5" />}
                <div className="flex flex-col"><span className="text-base font-bold">RISE</span><span className="text-xs opacity-80">Price goes up</span></div>
              </Button>
              <Button variant="loss" size="xl" onClick={() => executeTrade("PUT")} disabled={isTrading || !currentSymbol} className="flex items-center gap-2">
                {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <TrendingDown className="h-5 w-5" />}
                <div className="flex flex-col"><span className="text-base font-bold">FALL</span><span className="text-xs opacity-80">Price goes down</span></div>
              </Button>
            </>
          )}
          {contractCategory === "HIGHER_LOWER" && (
            <>
              <Button variant="profit" size="xl" onClick={() => executeTrade("CALL")} disabled={isTrading || !currentSymbol} className="flex items-center gap-2">
                {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <TrendingUp className="h-5 w-5" />}
                <div className="flex flex-col"><span className="text-base font-bold">HIGHER</span><span className="text-xs opacity-80">Above barrier</span></div>
              </Button>
              <Button variant="loss" size="xl" onClick={() => executeTrade("PUT")} disabled={isTrading || !currentSymbol} className="flex items-center gap-2">
                {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <TrendingDown className="h-5 w-5" />}
                <div className="flex flex-col"><span className="text-base font-bold">LOWER</span><span className="text-xs opacity-80">Below barrier</span></div>
              </Button>
            </>
          )}
          {contractCategory === "TOUCH_NO_TOUCH" && (
            <>
              <Button variant="profit" size="xl" onClick={() => executeTrade("ONETOUCH")} disabled={isTrading || !currentSymbol} className="flex items-center gap-2">
                {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Target className="h-5 w-5" />}
                <div className="flex flex-col"><span className="text-base font-bold">TOUCH</span><span className="text-xs opacity-80">Touches barrier</span></div>
              </Button>
              <Button variant="loss" size="xl" onClick={() => executeTrade("NOTOUCH")} disabled={isTrading || !currentSymbol} className="flex items-center gap-2">
                {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Target className="h-5 w-5" />}
                <div className="flex flex-col"><span className="text-base font-bold">NO TOUCH</span><span className="text-xs opacity-80">Won't touch</span></div>
              </Button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {["5", "10", "25", "50", "100"].map((quickAmount) => (
            <Button key={quickAmount} variant="outline" size="sm" onClick={() => { setAmount(quickAmount); setProposal(null) }} className="flex-1">
              ${quickAmount}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default TradingPanel

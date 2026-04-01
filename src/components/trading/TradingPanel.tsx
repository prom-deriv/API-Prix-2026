import React, { useState, useCallback } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Select } from "../ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { useTradingStore } from "../../stores/tradingStore"
import { getDerivAPI } from "../../lib/deriv-api"
import { formatCurrency, formatNumber } from "../../lib/utils"
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react"
import type { ContractType, DurationUnit, TradeParams } from "../../types/deriv"

const durationUnitOptions = [
  { value: "t", label: "Ticks" },
  { value: "s", label: "Seconds" },
  { value: "m", label: "Minutes" },
  { value: "h", label: "Hours" },
  { value: "d", label: "Days" },
]

const TradingPanel: React.FC = () => {
  const { currentSymbol, currentTick, isTrading, setIsTrading } = useTradingStore()
  const [amount, setAmount] = useState<string>("10")
  const [duration, setDuration] = useState<string>("5")
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("t")
  const [proposal, setProposal] = useState<{ id: string; ask_price: number; payout: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      }
      const result = await api.getProposal(params)
      setProposal({ id: result.id, ask_price: result.ask_price, payout: result.payout })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get proposal")
      setProposal(null)
    } finally {
      setIsTrading(false)
    }
  }, [currentSymbol, amount, duration, durationUnit, setIsTrading])

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
          <Button variant="profit" size="xl" onClick={() => executeTrade("CALL")} disabled={isTrading || !currentSymbol} className="flex items-center gap-2">
            {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <TrendingUp className="h-5 w-5" />}
            <div className="flex flex-col"><span className="text-base font-bold">RISE</span><span className="text-xs opacity-80">Higher</span></div>
          </Button>
          <Button variant="loss" size="xl" onClick={() => executeTrade("PUT")} disabled={isTrading || !currentSymbol} className="flex items-center gap-2">
            {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <TrendingDown className="h-5 w-5" />}
            <div className="flex flex-col"><span className="text-base font-bold">FALL</span><span className="text-xs opacity-80">Lower</span></div>
          </Button>
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

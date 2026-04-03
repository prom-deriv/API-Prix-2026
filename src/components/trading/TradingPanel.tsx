import React, { useState, useCallback, useEffect, useMemo } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Select } from "../ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { useTradingStore } from "../../stores/tradingStore"
import { getDerivAPI } from "../../lib/deriv-api"
import { formatCurrency, formatNumber, cn } from "../../lib/utils"
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
  const { 
    currentSymbol, 
    currentTick, 
    isTrading, 
    setIsTrading, 
    setBarrier, 
    setBarrierOffset, 
    setBarrierOffsetRange,
    setPipSize,
    barrierOffset,
    minBarrierOffset,
    maxBarrierOffset,
    symbols,
    isSymbolLoading,
  } = useTradingStore()
  const [amount, setAmount] = useState<string>("10")
  const [duration, setDuration] = useState<string>("5")
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("t")
  const [proposal, setProposal] = useState<{ id: string; ask_price: number; payout: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [contractCategory, setContractCategory] = useState<ContractCategory>("RISE_FALL")
  const [isPositiveOffset, setIsPositiveOffset] = useState<boolean>(true)
  const [availableContractTypes, setAvailableContractTypes] = useState<Set<ContractCategory>>(new Set(["RISE_FALL", "HIGHER_LOWER", "TOUCH_NO_TOUCH"]))

  // Derive pip size from active_symbols (primary) or tick data (fallback)
  const resolvedPipSize = useMemo(() => {
    // Primary: use active_symbols pip field
    const activeSymbol = symbols.find((s) => s.symbol === currentSymbol)
    if (activeSymbol && activeSymbol.pip) {
      return activeSymbol.pip
    }
    // Fallback: use tick data pip_size
    if (currentTick && currentTick.pip_size) {
      return currentTick.pip_size
    }
    return null
  }, [symbols, currentSymbol, currentTick])

  // Derive decimal precision from pip size
  const precision = useMemo(() => {
    if (resolvedPipSize) {
      return Math.max(0, Math.round(-Math.log10(resolvedPipSize)))
    }
    return 2 // default
  }, [resolvedPipSize])

  // Update store pip size when resolved
  useEffect(() => {
    if (resolvedPipSize !== null) {
      setPipSize(resolvedPipSize)
    }
  }, [resolvedPipSize, setPipSize])

  // Fetch contracts_for data when symbol changes
  useEffect(() => {
    const fetchContractsFor = async () => {
      if (!currentSymbol) return
      
      try {
        const api = getDerivAPI()
        
        // Wait for API to be ready before making requests
        const waitForReady = async (maxWait = 20000): Promise<boolean> => {
          const start = Date.now()
          while (Date.now() - start < maxWait) {
            if (api.isReady()) return true
            await new Promise(resolve => setTimeout(resolve, 100))
          }
          return false
        }
        
        const isReady = await waitForReady()
        if (!isReady) {
          console.warn("[TradingPanel] API not ready after waiting, using default offsets")
          setBarrierOffsetRange(0.1, 10)
          setBarrierOffset(0.5)
          return
        }
        
        const contracts = await api.getContractsFor(currentSymbol)
        
        // Determine which contract types are available
        const availableTypes = new Set<ContractCategory>()
        
        // Check for Rise/Fall availability
        const hasRiseFall = contracts.available.some(
          (c) => c.contract_type === "CALL" || c.contract_type === "PUT"
        )
        if (hasRiseFall) availableTypes.add("RISE_FALL")
        
        // Check for Higher/Lower availability (euro_non_atm barrier category)
        const hasHigherLower = contracts.available.some(
          (c) => c.barrier_category === "euro_non_atm"
        )
        if (hasHigherLower) availableTypes.add("HIGHER_LOWER")
        
        // Check for Touch/No Touch availability
        const hasTouchNoTouch = contracts.available.some(
          (c) => c.contract_type === "ONETOUCH" || c.contract_type === "NOTOUCH"
        )
        if (hasTouchNoTouch) availableTypes.add("TOUCH_NO_TOUCH")
        
        setAvailableContractTypes(availableTypes)
        
        // If current contract type is not available, switch to first available
        if (!availableTypes.has(contractCategory) && availableTypes.size > 0) {
          setContractCategory(Array.from(availableTypes)[0])
        }
        
        // Find contracts with barriers (Higher/Lower uses "euro_non_atm" barrier_category)
        // Also look for ONETOUCH/NOTOUCH contracts
        const barrierContracts = contracts.available.filter(
          (c) =>
            c.barrier_category === "euro_non_atm" ||
            c.contract_type === "ONETOUCH" ||
            c.contract_type === "NOTOUCH"
        )
        
        if (barrierContracts.length > 0) {
          // Collect all min/max offsets across matching contracts and find the widest range
          let globalMin = Infinity
          let globalMax = -Infinity
          
          for (const contract of barrierContracts) {
            const minVal = parseFloat(contract.min_barrier_offset)
            const maxVal = parseFloat(contract.max_barrier_offset)
            
            if (!isNaN(minVal) && minVal < globalMin) globalMin = minVal
            if (!isNaN(maxVal) && maxVal > globalMax) globalMax = maxVal
          }
          
          if (globalMin !== Infinity && globalMax !== -Infinity) {
            setBarrierOffsetRange(globalMin, globalMax)
            
            // Set default offset to a reasonable value (closer to min for better UX)
            const defaultOffset = Math.max(globalMin, globalMin + (globalMax - globalMin) * 0.1)
            setBarrierOffset(parseFloat(defaultOffset.toFixed(precision)))
          }
        } else {
          // Fallback: no barrier contracts found, use safe defaults
          setBarrierOffsetRange(0.1, 10)
          setBarrierOffset(0.5)
        }
      } catch (err) {
        console.warn("Failed to fetch contracts_for, using default offsets:", err)
        // Use safe defaults
        setBarrierOffsetRange(0.1, 10)
        setBarrierOffset(0.5)
      }
    }
    
    fetchContractsFor()
  }, [currentSymbol, setBarrierOffsetRange, setBarrierOffset, precision, contractCategory])

  // Calculate and set barrier based on contract category and current price
  useEffect(() => {
    if (!currentTick) {
      setBarrier(null)
      return
    }

    if (contractCategory === "RISE_FALL") {
      // Rise/Fall doesn't use a barrier
      setBarrier(null)
    } else if (contractCategory === "HIGHER_LOWER" || contractCategory === "TOUCH_NO_TOUCH") {
      // Barrier = current spot + signed offset
      if (barrierOffset !== null) {
        const signedOffset = isPositiveOffset ? Math.abs(barrierOffset) : -Math.abs(barrierOffset)
        setBarrier(currentTick.quote + signedOffset)
      }
    }
  }, [contractCategory, currentTick, setBarrier, barrierOffset, isPositiveOffset])

  // Handle barrier offset change from slider/input
  const handleOffsetChange = useCallback((value: number) => {
    const min = minBarrierOffset ?? 0.1
    const max = maxBarrierOffset ?? 10
    // Clamp to valid range (always store as positive, sign is separate)
    const clamped = Math.min(Math.max(Math.abs(value), min), max)
    const rounded = parseFloat(clamped.toFixed(precision))
    setBarrierOffset(rounded)
    setProposal(null)
  }, [minBarrierOffset, maxBarrierOffset, precision, setBarrierOffset])

  const getProposal = useCallback(async (contractType: ContractType) => {
    if (!currentSymbol || !amount || !duration) return
    setError(null)
    setIsTrading(true)
    try {
      const api = getDerivAPI()
      
      // Format barrier as relative offset string with +/- prefix
      // The Deriv API expects relative offsets like "+0.50" or "-0.50"
      let barrierString: string | undefined
      if (barrierOffset !== null && contractCategory !== "RISE_FALL") {
        const absOffset = Math.abs(barrierOffset)
        const formattedOffset = absOffset.toFixed(precision)
        barrierString = isPositiveOffset ? `+${formattedOffset}` : `-${formattedOffset}`
      }
      
      const params: TradeParams = {
        symbol: currentSymbol,
        amount: parseFloat(amount),
        basis: "stake",
        contract_type: contractType,
        duration: parseInt(duration),
        duration_unit: durationUnit,
        currency: "USD",
        ...(barrierString && { barrier: barrierString }),
      }
      const result = await api.getProposal(params)
      setProposal({ id: result.id, ask_price: result.ask_price, payout: result.payout })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to get proposal"
      // Handle specific barrier errors
      if (errorMessage.includes("barrier") || errorMessage.includes("Barrier")) {
        setError(`Invalid barrier: ${errorMessage}. Please adjust the barrier offset.`)
      } else {
        setError(errorMessage)
      }
      setProposal(null)
    } finally {
      setIsTrading(false)
    }
  }, [currentSymbol, amount, duration, durationUnit, setIsTrading, barrierOffset, precision, contractCategory, isPositiveOffset])

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

  // Whether to show barrier controls
  const showBarrierControls = contractCategory === "HIGHER_LOWER" || contractCategory === "TOUCH_NO_TOUCH"

  // Computed visual barrier price for display
  const visualBarrierPrice = useMemo(() => {
    if (!currentTick || barrierOffset === null) return null
    const signedOffset = isPositiveOffset ? Math.abs(barrierOffset) : -Math.abs(barrierOffset)
    return currentTick.quote + signedOffset
  }, [currentTick, barrierOffset, isPositiveOffset])

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Quick Trade</span>
          {currentTick && (
            <span className="text-sm font-normal text-muted-foreground">
              {formatNumber(currentTick.quote, precision)}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Contract Type</label>
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {contractCategoryOptions.map((option) => {
              const isAvailable = availableContractTypes.has(option.value)
              return (
                <Button
                  key={option.value}
                  variant={contractCategory === option.value ? "default" : "ghost"}
                  size="sm"
                  onClick={() => { 
                    if (isAvailable) {
                      setContractCategory(option.value)
                      setProposal(null)
                    }
                  }}
                  disabled={!isAvailable || isSymbolLoading}
                  className={cn(
                    "flex-1 text-xs",
                    !isAvailable && "opacity-50 cursor-not-allowed"
                  )}
                  title={!isAvailable ? "This contract type is not available for the current symbol" : undefined}
                >
                  {option.label}
                </Button>
              )
            })}
          </div>
        </div>

        {/* Barrier Offset Control - shown for Higher/Lower and Touch/No Touch */}
        {showBarrierControls && (
          <div className="space-y-2 p-3 rounded-lg border border-border/50 bg-muted/30">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-yellow-500" />
                Barrier Offset
              </label>
              {visualBarrierPrice !== null && (
                <span className="text-xs text-muted-foreground">
                  Barrier: {formatNumber(visualBarrierPrice, precision)}
                </span>
              )}
            </div>
            
            {/* Sign toggle + offset input */}
            <div className="flex items-center gap-2">
              <Button
                variant={isPositiveOffset ? "default" : "outline"}
                size="sm"
                onClick={() => { setIsPositiveOffset(true); setProposal(null) }}
                className="w-10 text-sm font-bold"
              >
                +
              </Button>
              <Button
                variant={!isPositiveOffset ? "default" : "outline"}
                size="sm"
                onClick={() => { setIsPositiveOffset(false); setProposal(null) }}
                className="w-10 text-sm font-bold"
              >
                −
              </Button>
              <Input
                type="text"
                inputMode="decimal"
                value={barrierOffset !== null ? barrierOffset.toFixed(precision) : "0"}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  if (!isNaN(val)) {
                    handleOffsetChange(val)
                  }
                }}
                className="flex-1 text-center font-mono"
              />
            </div>

            {/* Range slider */}
            {minBarrierOffset !== null && maxBarrierOffset !== null && (
              <div className="space-y-1">
                <input
                  type="range"
                  min={minBarrierOffset}
                  max={maxBarrierOffset}
                  step={resolvedPipSize ?? 0.01}
                  value={barrierOffset !== null ? Math.abs(barrierOffset) : minBarrierOffset}
                  onChange={(e) => handleOffsetChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-yellow-500"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{minBarrierOffset.toFixed(precision)}</span>
                  <span className="font-mono text-yellow-500">
                    {isPositiveOffset ? "+" : "−"}{barrierOffset !== null ? barrierOffset.toFixed(precision) : "0"}
                  </span>
                  <span>{maxBarrierOffset.toFixed(precision)}</span>
                </div>
              </div>
            )}
          </div>
        )}

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
              <Button variant="profit" size="xl" onClick={() => executeTrade("CALL")} disabled={isTrading || !currentSymbol || isSymbolLoading} className="flex items-center gap-2">
                {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <TrendingUp className="h-5 w-5" />}
                <div className="flex flex-col"><span className="text-base font-bold">RISE</span><span className="text-xs opacity-80">Price goes up</span></div>
              </Button>
              <Button variant="loss" size="xl" onClick={() => executeTrade("PUT")} disabled={isTrading || !currentSymbol || isSymbolLoading} className="flex items-center gap-2">
                {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <TrendingDown className="h-5 w-5" />}
                <div className="flex flex-col"><span className="text-base font-bold">FALL</span><span className="text-xs opacity-80">Price goes down</span></div>
              </Button>
            </>
          )}
          {contractCategory === "HIGHER_LOWER" && (
            <>
              <Button variant="profit" size="xl" onClick={() => executeTrade("CALL")} disabled={isTrading || !currentSymbol || isSymbolLoading} className="flex items-center gap-2">
                {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <TrendingUp className="h-5 w-5" />}
                <div className="flex flex-col"><span className="text-base font-bold">HIGHER</span><span className="text-xs opacity-80">Above barrier</span></div>
              </Button>
              <Button variant="loss" size="xl" onClick={() => executeTrade("PUT")} disabled={isTrading || !currentSymbol || isSymbolLoading} className="flex items-center gap-2">
                {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <TrendingDown className="h-5 w-5" />}
                <div className="flex flex-col"><span className="text-base font-bold">LOWER</span><span className="text-xs opacity-80">Below barrier</span></div>
              </Button>
            </>
          )}
          {contractCategory === "TOUCH_NO_TOUCH" && (
            <>
              <Button variant="profit" size="xl" onClick={() => executeTrade("ONETOUCH")} disabled={isTrading || !currentSymbol || isSymbolLoading} className="flex items-center gap-2">
                {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Target className="h-5 w-5" />}
                <div className="flex flex-col"><span className="text-base font-bold">TOUCH</span><span className="text-xs opacity-80">Touches barrier</span></div>
              </Button>
              <Button variant="loss" size="xl" onClick={() => executeTrade("NOTOUCH")} disabled={isTrading || !currentSymbol || isSymbolLoading} className="flex items-center gap-2">
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

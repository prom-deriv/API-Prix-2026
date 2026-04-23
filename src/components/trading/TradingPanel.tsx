import React, { useState, useCallback, useEffect, useMemo } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Select } from "../ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { useTradingStore } from "../../stores/tradingStore"
import { getDerivAPI } from "../../lib/deriv-api"
import { useAccount } from "../../contexts/AccountContext"
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
  const { accountType, loginId, balance: accountBalance, updateBalance, deductBalance, refreshBalance } = useAccount()
  const [amount, setAmount] = useState<string>("10")
  const [duration, setDuration] = useState<string>("5")
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("t")
  const [proposal, setProposal] = useState<{ id: string; ask_price: number; payout: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [contractCategory, setContractCategory] = useState<ContractCategory>("RISE_FALL")
  const [isPositiveOffset, setIsPositiveOffset] = useState<boolean>(true)
  const [availableContractTypes, setAvailableContractTypes] = useState<Set<ContractCategory>>(new Set(["RISE_FALL", "HIGHER_LOWER", "TOUCH_NO_TOUCH"]))
  const [availableContracts, setAvailableContracts] = useState<any[]>([])
  const [isTakeProfitEnabled, setIsTakeProfitEnabled] = useState<boolean>(false)
  const [takeProfitValue, setTakeProfitValue] = useState<string>("")
  const [isStopLossEnabled, setIsStopLossEnabled] = useState<boolean>(false)
  const [stopLossValue, setStopLossValue] = useState<string>("")

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

  // Clear error and proposal when account changes
  useEffect(() => {
    setError(null)
    setProposal(null)
  }, [accountType, loginId])

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
        setAvailableContracts(contracts.available)
        
        // 🔍 DIAGNOSTIC: Log contracts_for response for debugging
        console.log(`[TradingPanel] 📋 contracts_for response for ${currentSymbol}:`, contracts)
        console.log(`[TradingPanel] Available contract types:`, 
          contracts.available.map(c => ({
            type: c.contract_type,
            barrier_category: c.barrier_category,
            barrier: c.barrier,
            min_offset: c.min_barrier_offset,
            max_offset: c.max_barrier_offset
          }))
        )
        
        // Determine which contract types are available
        const availableTypes = new Set<ContractCategory>()
        
        // Check for Rise/Fall availability
        const hasRiseFall = contracts.available.some(
          (c) => c.contract_type === "CALL" || c.contract_type === "PUT"
        )
        if (hasRiseFall) availableTypes.add("RISE_FALL")
        console.log(`[TradingPanel] ${currentSymbol} - Rise/Fall available:`, hasRiseFall)
        
        // Check for Higher/Lower availability (contract_category: "callput")
        // Since Deriv's API v3 format can have different properties compared to v1
        const hasHigherLower = contracts.available.some(
          (c: any) => c.barrier_category === "euro_non_atm" || 
                 c.contract_category === "callput" ||
                 c.contract_category_display === "Higher/Lower" ||
                 (c.contract_type === "CALL" && c.barriers === 1) ||
                 (c.contract_type === "PUT" && c.barriers === 1)
        )
        if (hasHigherLower) availableTypes.add("HIGHER_LOWER")
        console.log(`[TradingPanel] ${currentSymbol} - Higher/Lower available:`, hasHigherLower)
        
        // Check for Touch/No Touch availability
        const hasTouchNoTouch = contracts.available.some(
          (c) => c.contract_type === "ONETOUCH" || c.contract_type === "NOTOUCH"
        )
        if (hasTouchNoTouch) availableTypes.add("TOUCH_NO_TOUCH")
        console.log(`[TradingPanel] ${currentSymbol} - Touch/No Touch available:`, hasTouchNoTouch)
        
        console.log(`[TradingPanel] ${currentSymbol} - Final available types:`, Array.from(availableTypes))
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

  // Calculate and set barriers based on contract category and current price
  useEffect(() => {
    if (!currentTick) {
      setBarrier(null)
      return
    }

    if (contractCategory === "RISE_FALL") {
      // Rise/Fall doesn't use a barrier - clear all barriers
      setBarrier(null)
      useTradingStore.getState().setBarrierHigh(null)
      useTradingStore.getState().setBarrierLow(null)
    } else if (contractCategory === "HIGHER_LOWER" || contractCategory === "TOUCH_NO_TOUCH") {
      // Show two barriers: Higher and Lower based on current price
      if (barrierOffset !== null) {
        const absOffset = Math.abs(barrierOffset)
        setBarrier(currentTick.quote + absOffset) // Higher barrier (also kept for compatibility)
        useTradingStore.getState().setBarrierHigh(currentTick.quote + absOffset)
        useTradingStore.getState().setBarrierLow(currentTick.quote - absOffset)
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

  const { addRecentTrade, addActiveContract, removeActiveContract, addDerivPoints } = useTradingStore()

  // Demo mode: simulate trade with real-time updates and SL/TP support
  const simulateDemoTrade = useCallback((contractType: ContractType): Promise<void> => {
    return new Promise((resolve) => {
      const tradeAmount = parseFloat(amount)
      const payout = proposal?.payout || tradeAmount * 1.8 // 80% payout for demo
      
      // Check balance
      if (tradeAmount > accountBalance) {
        setError(`Insufficient ${accountType} balance`)
        setIsTrading(false)
        return
      }

      // Deduct from balance
      deductBalance(tradeAmount)
      
      // Capture entry tick at the start of the trade
      const entryTick = useTradingStore.getState().currentTick
      const entryQuote = entryTick?.quote ?? 0
      
      // Convert duration to milliseconds based on unit
      let tradeDurationMs: number
      switch (durationUnit) {
        case 't': // ticks - simulate 1 second per tick for demo
          tradeDurationMs = parseInt(duration) * 1000
          break
        case 's': // seconds
          tradeDurationMs = parseInt(duration) * 1000
          break
        case 'm': // minutes
          tradeDurationMs = parseInt(duration) * 60 * 1000
          break
        case 'h': // hours
          tradeDurationMs = parseInt(duration) * 60 * 60 * 1000
          break
        case 'd': // days
          tradeDurationMs = parseInt(duration) * 24 * 60 * 60 * 1000
          break
        default:
          tradeDurationMs = parseInt(duration) * 1000
      }
      
      // Create unique contract ID for demo
      const demoContractId = Date.now()
      const startTime = Date.now()
      const expiryTime = startTime + tradeDurationMs
      
      // Store SL/TP if enabled
      const tp = isTakeProfitEnabled && takeProfitValue ? parseFloat(takeProfitValue) : undefined
      const sl = isStopLossEnabled && stopLossValue ? parseFloat(stopLossValue) : undefined
      if (tp || sl) {
        useTradingStore.getState().setContractSLTP(demoContractId, sl, tp)
      }

      // Add to active contracts immediately
      addActiveContract({
        contract_id: demoContractId,
        contract_type: contractType,
        currency: "USD",
        date_expiry: expiryTime / 1000,
        date_settlement: 0,
        date_start: startTime / 1000,
        display_name: currentSymbol,
        buy_price: tradeAmount,
        payout: payout,
        profit: 0,
        current_spot: entryQuote,
        entry_spot: entryQuote,
        entry_spot_display_value: entryQuote.toFixed(precision),
        is_sold: 0,
        status: "open",
        underlying: currentSymbol,
        longcode: `${contractType} ${currentSymbol} - Demo trade`,
        shortcode: `${contractType}_demo_${demoContractId}`,
        bid_price: tradeAmount,
        sell_price: 0,
        sell_spot: 0,
        sell_spot_display_value: "",
        sell_spot_time: 0,
        current_spot_display_value: entryQuote.toFixed(precision),
        current_spot_time: startTime / 1000,
        audit: { all_ticks: [] },
        barrier: 0,
        expiry_time: expiryTime / 1000,
        id: demoContractId.toString(),
        is_expired: 0,
        is_forward_starting: 0,
        is_intraday: 1,
        is_path_dependent: 0,
        is_settleable: 0,
        profit_percentage: 0,
        purchase_time: startTime / 1000,
        transaction_ids: { buy: demoContractId },
        duration: parseInt(duration),
        duration_unit: durationUnit,
      })
      
      // Resolve immediately so the user can place another trade concurrently
      resolve()
      
      // Real-time update interval (every 500ms)
      const updateInterval = setInterval(() => {
        const currentTick = useTradingStore.getState().currentTick
        if (!currentTick) return
        
        const currentQuote = currentTick.quote
        const elapsed = Date.now() - startTime
        const timeRemaining = Math.max(0, tradeDurationMs - elapsed)
        
        // Calculate current profit based on price movement
        // Simplified: profit scales with price movement and time elapsed
        const priceChange = currentQuote - entryQuote
        const isWinning = (contractType === "CALL" && priceChange > 0) || 
                          (contractType === "PUT" && priceChange < 0) ||
                          (contractType === "ONETOUCH" && Math.abs(priceChange) > (barrierOffset ?? 0)) ||
                          (contractType === "NOTOUCH" && Math.abs(priceChange) <= (barrierOffset ?? 0))
        
        // Current profit estimation (scales towards final payout/loss as time progresses)
        const progressRatio = elapsed / tradeDurationMs
        const currentProfit = isWinning 
          ? (payout - tradeAmount) * progressRatio - tradeAmount * (1 - progressRatio)
          : -tradeAmount * progressRatio
        
        const currentBidPrice = isWinning 
          ? tradeAmount + (payout - tradeAmount) * progressRatio
          : tradeAmount * (1 - progressRatio)
        
        // Update active contract with current values
        useTradingStore.getState().updateActiveContract(demoContractId, {
          current_spot: currentQuote,
          current_spot_display_value: currentQuote.toFixed(precision),
          current_spot_time: Date.now() / 1000,
          profit: currentProfit,
          bid_price: currentBidPrice,
          status: timeRemaining > 0 ? "open" : "won",
        })
        
        // Check SL/TP
        const sltp = useTradingStore.getState().getContractSLTP(demoContractId)
        let shouldClose = false
        let closeReason = ""
        
        if (sltp?.stopLoss && currentBidPrice <= sltp.stopLoss) {
          shouldClose = true
          closeReason = "Stop Loss hit"
        } else if (sltp?.takeProfit && currentBidPrice >= sltp.takeProfit) {
          shouldClose = true
          closeReason = "Take Profit hit"
        } else if (timeRemaining <= 0) {
          shouldClose = true
          closeReason = "Contract expired"
        }
        
        if (shouldClose) {
          clearInterval(updateInterval)
          
          // Final settlement
          const finalTick = useTradingStore.getState().currentTick
          const exitQuote = finalTick?.quote ?? currentQuote
          
          // Determine final outcome
          const finalProfit = closeReason.includes("Stop Loss") 
            ? sltp!.stopLoss! - tradeAmount
            : closeReason.includes("Take Profit")
            ? sltp!.takeProfit! - tradeAmount
            : currentProfit
          
          const finalBidPrice = closeReason.includes("Stop Loss")
            ? sltp!.stopLoss!
            : closeReason.includes("Take Profit")
            ? sltp!.takeProfit!
            : currentBidPrice
          
          const newBalance = accountBalance + finalProfit
          updateBalance(newBalance)
          
          // Remove from active contracts
          removeActiveContract(demoContractId)
          
          // Add Deriv Points
          const pointsAwarded = Math.floor(tradeAmount)
          if (pointsAwarded > 0) {
            addDerivPoints(pointsAwarded)
          }
          
          // Add to trade history
          addRecentTrade({
            app_id: import.meta.env.VITE_DERIV_APP_ID || "1089",
            buy_price: tradeAmount,
            contract_id: demoContractId,
            contract_type: contractType,
            currency: "USD",
            date_expiry: expiryTime / 1000,
            date_start: startTime / 1000,
            longcode: `${contractType} ${currentSymbol} - Demo trade (${closeReason})`,
            payout: payout,
            profit: finalProfit,
            sell_price: finalBidPrice,
            sell_time: Date.now() / 1000,
            shortcode: `${contractType}_demo_${demoContractId}`,
            transaction_id: demoContractId,
            entry_tick: entryQuote,
            exit_tick: exitQuote,
            entry_tick_display_value: entryQuote.toFixed(precision),
            exit_tick_display_value: exitQuote.toFixed(precision),
          })
          
          setProposal(null)
        }
      }, 500) // Update every 500ms
    })
  }, [amount, duration, durationUnit, proposal, accountBalance, updateBalance, addRecentTrade, currentSymbol, resolvedPipSize, addDerivPoints, addActiveContract, removeActiveContract, precision, barrierOffset])

  const executeTrade = useCallback(async (contractType: ContractType) => {
    setError(null)
    
    // Validate SL/TP
    if (isTakeProfitEnabled && (!takeProfitValue || isNaN(parseFloat(takeProfitValue)) || parseFloat(takeProfitValue) <= 0)) {
      setError("Please enter a valid positive amount for Take Profit.")
      return
    }
    if (isStopLossEnabled && (!stopLossValue || isNaN(parseFloat(stopLossValue)) || parseFloat(stopLossValue) <= 0)) {
      setError("Please enter a valid positive amount for Stop Loss.")
      return
    }
    
    setIsTrading(true)
    try {
      // Access token presence is a good proxy for whether we should use real API or local mock
      const isConnectedDemo = localStorage.getItem("deriv_access_token") && localStorage.getItem("deriv_access_token") !== "null";
      if (accountType === "demo" && !isConnectedDemo) {
        // Mock demo mode: simulate trade immediately without API proposal
        await simulateDemoTrade(contractType)
      } else {
        // Real or Connected Demo mode: fetch proposal if needed, then buy
        let currentProposal = proposal
        if (!currentProposal) {
          const api = getDerivAPI()
          const isReady = await api.waitUntilReady(5000)
          if (!isReady) {
            throw new Error("API not ready - please wait for connection")
          }
          
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
          currentProposal = { id: result.id, ask_price: result.ask_price, payout: result.payout }
          setProposal(currentProposal)
        }
        
        const api = getDerivAPI()
        
        // Check balance before buying real contract
        const tradeAmount = parseFloat(amount)
        if (tradeAmount > accountBalance) {
          setError(`Insufficient ${accountType} balance`)
          setIsTrading(false)
          return
        }

        const buyResult = await api.buyContract(currentProposal.id, currentProposal.ask_price)
        
        // For real accounts, do NOT manually deduct balance.
        // The balance subscription (subscribeBalance) receives real-time
        // updates from the server after each trade, which is authoritative.
        // Manual deduction causes stale closure issues leading to $NaN.

        // Track contract result for real accounts
        if (buyResult?.contract_id) {
          // Fetch real balance immediately after purchase to deduct stake
          api.getBalance().then((balanceRes) => {
            if (balanceRes && balanceRes.balance !== undefined) {
              updateBalance(Number(balanceRes.balance))
            }
          }).catch(console.error)

          // Store SL/TP if enabled
          const tp = isTakeProfitEnabled && takeProfitValue ? parseFloat(takeProfitValue) : undefined
          const sl = isStopLossEnabled && stopLossValue ? parseFloat(stopLossValue) : undefined
          if (tp || sl) {
            useTradingStore.getState().setContractSLTP(buyResult.contract_id, sl, tp)
          }

          // Add to active contracts
          addActiveContract({
            contract_id: buyResult.contract_id,
            contract_type: contractType,
            currency: "USD",
            date_expiry: 0,
            date_settlement: 0,
            date_start: Date.now() / 1000,
            display_name: currentSymbol,
            buy_price: parseFloat(amount),
            payout: currentProposal.payout,
            profit: 0,
            current_spot: currentTick?.quote || 0,
            entry_spot: currentTick?.quote || 0,
            entry_spot_display_value: currentTick?.quote?.toFixed(precision) || "",
            is_sold: 0,
            status: "open",
            underlying: currentSymbol,
            longcode: buyResult.longcode || "",
            shortcode: buyResult.shortcode || "",
            bid_price: 0,
            sell_price: 0,
            sell_spot: 0,
            sell_spot_display_value: "",
            sell_spot_time: 0,
            current_spot_display_value: "",
            current_spot_time: 0,
            audit: { all_ticks: [] },
            barrier: 0,
            expiry_time: 0,
            id: buyResult.contract_id.toString(),
            is_expired: 0,
            is_forward_starting: 0,
            is_intraday: 1,
            is_path_dependent: 0,
            is_settleable: 0,
            profit_percentage: 0,
            purchase_time: Date.now() / 1000,
            transaction_ids: { buy: buyResult.transaction_id || 0 },
            duration: parseInt(duration),
            duration_unit: durationUnit,
          })
          
          const unsubscribe = api.subscribeProposalOpenContract(buyResult.contract_id, (contract) => {
            if (contract.is_sold === 1 || contract.is_expired === 1 || ["sold", "won", "lost"].includes(contract.status || "")) {
              const profit = Number(contract.profit) || 0
              
              // Optimistically update balance immediately if profitable (won/sold at profit)
              // The stake was already deducted from balance at purchase.
              // If we win, the balance should increase by (Stake + Profit), which is Payout.
              // Wait, if balance currently reflects the post-purchase amount,
              // then on win, we just add the (Profit + Stake).
              // Let's use the exact contract payout if won, or profit if sold early.
              if (contract.status === "won" && contract.payout) {
                updateBalance(accountBalance + Number(contract.payout));
              } else if (contract.status === "sold" && profit > 0 && contract.buy_price) {
                 // Sold early at a profit: add back the current bid price which is Stake + Profit
                 updateBalance(accountBalance + Number(contract.bid_price || (contract.buy_price + profit)));
              }
              // We rely on `refreshBalance` and `subscribeBalance` to correct it if the optimistic update is slightly off.

              // Remove from active contracts
              removeActiveContract(buyResult.contract_id)
              
              // Fetch real balance after settlement
              // Add a small delay to ensure the backend has processed the balance update
              // Also add a second refresh a bit later to be absolutely sure
              setTimeout(() => {
                refreshBalance().catch(console.error)
              }, 500)
              
              setTimeout(() => {
                refreshBalance().catch(console.error)
              }, 2000)

              // Add Deriv Points for real trade
              const stakeAmount = contract.buy_price || parseFloat(amount)
              const pointsAwarded = Math.floor(stakeAmount)
              if (pointsAwarded > 0) {
                addDerivPoints(pointsAwarded)
              }
              
              // Add to trade history with entry/exit tick data
              addRecentTrade({
                app_id: import.meta.env.VITE_DERIV_APP_ID || "1089",
                buy_price: contract.buy_price || parseFloat(amount),
                contract_id: contract.contract_id,
                contract_type: contract.contract_type || contractType,
                currency: contract.currency || "USD",
                date_expiry: contract.date_expiry || 0,
                date_start: contract.date_start || 0,
                longcode: contract.longcode || "",
                payout: contract.payout || 0,
                profit,
                sell_price: contract.sell_price || 0,
                sell_time: contract.sell_spot_time || contract.date_expiry || (Date.now() / 1000),
                shortcode: contract.shortcode || "",
                transaction_id: buyResult.transaction_id || contract.transaction_ids?.buy || 0,
                entry_tick: contract.entry_spot,
                exit_tick: contract.sell_spot || contract.current_spot,
                entry_tick_display_value: contract.entry_spot_display_value,
                exit_tick_display_value: contract.sell_spot_display_value || contract.current_spot_display_value,
              })
              
              unsubscribe()
            } else {
              // Contract still open - update active contract with all available fields
              useTradingStore.getState().updateActiveContract(buyResult.contract_id, {
                current_spot: contract.current_spot,
                current_spot_display_value: contract.current_spot_display_value,
                profit: contract.profit,
                bid_price: contract.bid_price,
                status: contract.status,
                // Populate fields that were placeholders at purchase time
                date_expiry: contract.date_expiry,
                date_start: contract.date_start,
                display_name: contract.display_name || currentSymbol,
                payout: contract.payout,
                entry_spot: contract.entry_spot,
                entry_spot_display_value: contract.entry_spot_display_value,
                buy_price: contract.buy_price,
                expiry_time: contract.expiry_time,
                is_expired: contract.is_expired,
                tick_count: contract.tick_count,
                tick_stream: contract.tick_stream,
                audit: contract.audit,
              })

              // Check SL/TP
              const sltp = useTradingStore.getState().getContractSLTP(buyResult.contract_id)
              if (contract.bid_price !== undefined) {
                let shouldClose = false
                if (sltp?.stopLoss !== undefined && contract.bid_price <= sltp.stopLoss) {
                  shouldClose = true
                } else if (sltp?.takeProfit !== undefined && contract.bid_price >= sltp.takeProfit) {
                  shouldClose = true
                }
                
                if (shouldClose) {
                  api.sellContract(buyResult.contract_id, contract.bid_price).catch(console.error)
                }
              }
            }
          })
        }
      }
      setProposal(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute trade")
    } finally {
      setIsTrading(false)
    }
  }, [proposal, setIsTrading, accountType, simulateDemoTrade, accountBalance, updateBalance, addRecentTrade, amount, currentSymbol, barrierOffset, contractCategory, precision, isPositiveOffset, duration, durationUnit, addDerivPoints, addActiveContract, removeActiveContract])

  // Whether to show barrier controls
  const showBarrierControls = contractCategory === "HIGHER_LOWER" || contractCategory === "TOUCH_NO_TOUCH"

  // Set default barrier offset when switching to Higher/Lower or Touch/No Touch
  useEffect(() => {
    if (contractCategory === "HIGHER_LOWER" || contractCategory === "TOUCH_NO_TOUCH") {
      if (barrierOffset === null) {
        setBarrierOffset(0.5)
      }
    }
  }, [contractCategory, barrierOffset, setBarrierOffset])

  // Computed visual barrier price for display
  const visualBarrierPrice = useMemo(() => {
    if (!currentTick || barrierOffset === null) return null
    const signedOffset = isPositiveOffset ? Math.abs(barrierOffset) : -Math.abs(barrierOffset)
    return currentTick.quote + signedOffset
  }, [currentTick, barrierOffset, isPositiveOffset])

  // Validate duration
  const durationError = useMemo(() => {
    if (!availableContracts.length) return null;
    
    // Filter contracts by current category
    const relevantContracts = availableContracts.filter(c => {
      if (contractCategory === "RISE_FALL") {
        return (c.contract_type === "CALL" || c.contract_type === "PUT") && (!c.barrier_category || c.barrier_category === "euro_atm" || c.barriers === 0);
      } else if (contractCategory === "HIGHER_LOWER") {
        return (c.contract_type === "CALL" || c.contract_type === "PUT") && (c.barrier_category === "euro_non_atm" || c.barriers === 1);
      } else if (contractCategory === "TOUCH_NO_TOUCH") {
        return c.contract_type === "ONETOUCH" || c.contract_type === "NOTOUCH";
      }
      return false;
    });

    if (!relevantContracts.length) return null;

    const val = parseInt(duration);
    if (isNaN(val) || val <= 0) return "Please enter a valid duration.";

    if (durationUnit === "t") {
      let minTick = Infinity;
      let maxTick = -Infinity;
      let hasTick = false;
      
      for (const c of relevantContracts) {
        if (c.min_contract_duration && c.min_contract_duration.endsWith('t')) {
          hasTick = true;
          minTick = Math.min(minTick, parseInt(c.min_contract_duration));
        }
        if (c.max_contract_duration && c.max_contract_duration.endsWith('t')) {
          maxTick = Math.max(maxTick, parseInt(c.max_contract_duration));
        }
      }
      
      if (!hasTick) return "Trading is not offered for Ticks.";
      if (val < minTick) return `Minimum duration is ${minTick} ticks.`;
      if (val > maxTick) return `Maximum duration is ${maxTick} ticks.`;
      return null;
    } else {
      // Time-based duration
      let minTimeSec = Infinity;
      let maxTimeSec = -Infinity;
      let hasTime = false;
      
      const parseToSec = (str: string) => {
        if (!str) return Infinity;
        const num = parseInt(str);
        if (str.endsWith('s')) return num;
        if (str.endsWith('m')) return num * 60;
        if (str.endsWith('h')) return num * 3600;
        if (str.endsWith('d')) return num * 86400;
        return Infinity;
      };
      
      for (const c of relevantContracts) {
        if (c.min_contract_duration && !c.min_contract_duration.endsWith('t')) {
          hasTime = true;
          minTimeSec = Math.min(minTimeSec, parseToSec(c.min_contract_duration));
        }
        if (c.max_contract_duration && !c.max_contract_duration.endsWith('t')) {
          hasTime = true;
          maxTimeSec = Math.max(maxTimeSec, parseToSec(c.max_contract_duration));
        }
      }
      
      if (!hasTime) return "Trading is not offered for this duration.";
      
      let inputSec = val;
      if (durationUnit === 'm') inputSec *= 60;
      else if (durationUnit === 'h') inputSec *= 3600;
      else if (durationUnit === 'd') inputSec *= 86400;
      
      if (inputSec < minTimeSec) {
        if (minTimeSec < 60) return `Minimum duration is ${minTimeSec} seconds.`;
        if (minTimeSec < 3600) return `Minimum duration is ${minTimeSec / 60} minutes.`;
        if (minTimeSec < 86400) return `Minimum duration is ${minTimeSec / 3600} hours.`;
        return `Minimum duration is ${minTimeSec / 86400} days.`;
      }
      
      if (inputSec > maxTimeSec) {
        if (maxTimeSec % 86400 === 0) return `Maximum duration is ${maxTimeSec / 86400} days.`;
        if (maxTimeSec % 3600 === 0) return `Maximum duration is ${maxTimeSec / 3600} hours.`;
        if (maxTimeSec % 60 === 0) return `Maximum duration is ${maxTimeSec / 60} minutes.`;
        return `Maximum duration is ${maxTimeSec} seconds.`;
      }
      
      return null;
    }
  }, [availableContracts, contractCategory, duration, durationUnit]);

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
        {(proposal || (accountType === "demo" && parseFloat(amount) > 0)) && (
          <div className="p-3 rounded-lg bg-muted/50 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Potential Payout:</span>
              <span className="font-medium text-profit">
                {proposal 
                  ? formatCurrency(proposal.payout)
                  : formatCurrency(parseFloat(amount) * 1.8)
                }
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cost:</span>
              <span className="font-medium">
                {proposal 
                  ? formatCurrency(proposal.ask_price)
                  : formatCurrency(parseFloat(amount))
                }
              </span>
            </div>
          </div>
        )}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}
        {durationError && !error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{durationError}</div>
        )}
        
        {/* SL/TP Panel */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="take-profit-cb"
                className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
                checked={isTakeProfitEnabled}
                onChange={(e) => setIsTakeProfitEnabled(e.target.checked)}
              />
              <label htmlFor="take-profit-cb" className="text-sm font-medium cursor-pointer flex items-center gap-1">
                Take profit
                <div className="relative group">
                  <span className="text-muted-foreground cursor-help text-xs ml-1 border border-muted-foreground rounded-full w-4 h-4 flex items-center justify-center">i</span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg border z-10 text-center">
                    Contract will close automatically if bid price reaches this level.
                  </div>
                </div>
              </label>
            </div>
            <div className="flex relative">
              <Input 
                type="text" 
                inputMode="decimal" 
                placeholder="Amount" 
                value={takeProfitValue}
                onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setTakeProfitValue(e.target.value) }}
                disabled={!isTakeProfitEnabled}
                className="pr-12 text-center"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">USD</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="stop-loss-cb"
                className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
                checked={isStopLossEnabled}
                onChange={(e) => setIsStopLossEnabled(e.target.checked)}
              />
              <label htmlFor="stop-loss-cb" className="text-sm font-medium cursor-pointer flex items-center gap-1">
                Stop loss
                <div className="relative group">
                  <span className="text-muted-foreground cursor-help text-xs ml-1 border border-muted-foreground rounded-full w-4 h-4 flex items-center justify-center">i</span>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg border z-10 text-center">
                    Contract will close automatically if bid price falls to this level.
                  </div>
                </div>
              </label>
            </div>
            <div className="flex relative">
              <Input 
                type="text" 
                inputMode="decimal" 
                placeholder="Amount" 
                value={stopLossValue}
                onChange={(e) => { if (/^\d*\.?\d*$/.test(e.target.value)) setStopLossValue(e.target.value) }}
                disabled={!isStopLossEnabled}
                className="pr-12 text-center"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">USD</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {contractCategory === "RISE_FALL" && (
            <>
              <Button variant="profit" size="xl" onClick={() => executeTrade("CALL")} disabled={isTrading || !currentSymbol || isSymbolLoading || !!durationError} className="flex items-center gap-2">
                {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <TrendingUp className="h-5 w-5" />}
                <div className="flex flex-col"><span className="text-base font-bold">RISE</span><span className="text-xs opacity-80">Price goes up</span></div>
              </Button>
              <Button variant="loss" size="xl" onClick={() => executeTrade("PUT")} disabled={isTrading || !currentSymbol || isSymbolLoading || !!durationError} className="flex items-center gap-2">
                {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <TrendingDown className="h-5 w-5" />}
                <div className="flex flex-col"><span className="text-base font-bold">FALL</span><span className="text-xs opacity-80">Price goes down</span></div>
              </Button>
            </>
          )}
          {contractCategory === "HIGHER_LOWER" && (
            <>
              <Button variant="profit" size="xl" onClick={() => executeTrade("CALL")} disabled={isTrading || !currentSymbol || isSymbolLoading || !!durationError} className="flex items-center gap-2">
                {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <TrendingUp className="h-5 w-5" />}
                <div className="flex flex-col"><span className="text-base font-bold">HIGHER</span><span className="text-xs opacity-80">Above barrier</span></div>
              </Button>
              <Button variant="loss" size="xl" onClick={() => executeTrade("PUT")} disabled={isTrading || !currentSymbol || isSymbolLoading || !!durationError} className="flex items-center gap-2">
                {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <TrendingDown className="h-5 w-5" />}
                <div className="flex flex-col"><span className="text-base font-bold">LOWER</span><span className="text-xs opacity-80">Below barrier</span></div>
              </Button>
            </>
          )}
          {contractCategory === "TOUCH_NO_TOUCH" && (
            <>
              <Button variant="profit" size="xl" onClick={() => executeTrade("ONETOUCH")} disabled={isTrading || !currentSymbol || isSymbolLoading || !!durationError} className="flex items-center gap-2">
                {isTrading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Target className="h-5 w-5" />}
                <div className="flex flex-col"><span className="text-base font-bold">TOUCH</span><span className="text-xs opacity-80">Touches barrier</span></div>
              </Button>
              <Button variant="loss" size="xl" onClick={() => executeTrade("NOTOUCH")} disabled={isTrading || !currentSymbol || isSymbolLoading || !!durationError} className="flex items-center gap-2">
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

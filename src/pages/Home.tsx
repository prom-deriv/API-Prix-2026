import { useEffect, useCallback, useRef } from "react"
import { getDerivAPI } from "../lib/deriv-api"
import { useTradingStore } from "../stores/tradingStore"
import TradingChart from "../components/charts/TradingChart"
import TradingPanel from "../components/trading/TradingPanel"
import TradeHistory from "../components/trading/TradeHistory"
import ActiveContractsPanel from "../components/trading/ActiveContractsPanel"
import AlertSystem from "../components/trading/AlertSystem"
import SocialTrading from "../components/social/SocialTrading"
import AccountSnapshot from "../components/account/AccountSnapshot"
import AccountSwitcher from "../components/account/AccountSwitcher"
import DepositWithdraw from "../components/account/DepositWithdraw"
import DerivPoints from "../components/trading/DerivPoints"
import AssetSelector from "../components/trading/AssetSelector"
import ChartStyleSelector from "../components/charts/ChartStyleSelector"
import ErrorBoundary from "../components/ui/ErrorBoundary"
import { AIAssistant } from "../components/ai/AIAssistant"
import { Card, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { formatNumber, formatPercentage } from "../lib/utils"
import { Wifi, WifiOff, RefreshCw, TrendingUp, TrendingDown, Gamepad2, Home as HomeIcon, Waves } from "lucide-react"
import { Link } from "react-router-dom"
import { ThemeToggle } from "../components/ui/ThemeToggle"
import Watchlist from "../components/trading/Watchlist"

function Home() {
  const {
    symbols,
    currentSymbol,
    currentTick,
    tickHistory,
    ohlcHistory,
    isConnected,
    isConnecting,
    error,
    chartStyle,
    setCurrentTick,
    setTickHistory,
    setCurrentOHLC,
    setOHLCHistory,
    setConnectionState,
    setIsSymbolLoading,
    fetchSymbols,
    clearState,
  } = useTradingStore()

  // Store the unsubscribe function for ticks and OHLC
  const tickUnsubscribeRef = useRef<(() => void) | null>(null)
  const ohlcUnsubscribeRef = useRef<(() => void) | null>(null)
  // Track the current symbol being loaded to prevent race conditions
  const loadingSymbolRef = useRef<string | null>(null)
  // CRITICAL: Track whether initial setup is complete to prevent overlapping subscriptions
  const hasInitializedRef = useRef(false)
  // Track the currently active stream type to prevent duplicate subscriptions
  const activeStreamRef = useRef<'ticks' | 'ohlc' | null>(null)
  // MUTEX: Prevent concurrent subscription operations
  const isSubscribingRef = useRef(false)

  // Helper: Subscribe to the correct stream based on chart style
  const subscribeToStream = useCallback(async (symbol: string, style: string) => {
    // Wait for any in-progress subscription to complete (with reasonable timeout)
    let waited = 0
    while (isSubscribingRef.current && waited < 5000) {
      await new Promise(resolve => setTimeout(resolve, 100))
      waited += 100
    }
    
    isSubscribingRef.current = true
    
    try {
      const api = getDerivAPI()

      // Check if API is ready (connected + authorized)
      if (!api.isReady()) {
        console.warn("[Home] API not ready, waiting...")
        // Wait for API to be ready with timeout
        let apiWaited = 0
        while (!api.isReady() && apiWaited < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100))
          apiWaited += 100
        }
        if (!api.isReady()) {
          console.error("[Home] API timed out waiting for readiness")
          return
        }
      }

      if (style === 'area' || style === 'line') {
        activeStreamRef.current = 'ticks'
        // Unsubscribe from OHLC first if active
        if (ohlcUnsubscribeRef.current) {
          try { ohlcUnsubscribeRef.current() } catch {}
          ohlcUnsubscribeRef.current = null
        }
        tickUnsubscribeRef.current = await api.subscribeTicks(symbol, (tick) => {
          if (loadingSymbolRef.current === symbol || loadingSymbolRef.current === null) {
            // NUMERIC VALIDATION - Prevent chart freeze from non-Number values
            const quote = Number(tick.quote)
            const epoch = Number(tick.epoch)
            if (isNaN(quote) || isNaN(epoch)) return
            setCurrentTick({ epoch, quote, symbol: tick.symbol })
          }
        })
        console.log("[Home] Tick subscription successful for:", symbol)
      } else {
        // 'ohlc' and 'candlestick' both use real OHLC data with proper candles
        activeStreamRef.current = 'ohlc'
        // Unsubscribe from ticks first if active
        if (tickUnsubscribeRef.current) {
          try { tickUnsubscribeRef.current() } catch {}
          tickUnsubscribeRef.current = null
        }
        ohlcUnsubscribeRef.current = await api.subscribeOHLC(symbol, 60, (ohlc) => {
          if (loadingSymbolRef.current === symbol || loadingSymbolRef.current === null) {
            // NUMERIC VALIDATION - Prevent chart freeze from non-Number values
            const open = Number(ohlc.open)
            const high = Number(ohlc.high)
            const low = Number(ohlc.low)
            const close = Number(ohlc.close)
            const epoch = Number(ohlc.epoch)
            const granularity = Number(ohlc.granularity)
            if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close) || isNaN(epoch)) return
            setCurrentOHLC({ open, high, low, close, epoch, granularity, symbol: ohlc.symbol })
          }
        })
        console.log("[Home] OHLC subscription successful for:", symbol)
      }
    } finally {
      // MUTEX: Release lock
      isSubscribingRef.current = false
    }
  }, [setCurrentTick, setCurrentOHLC])

  // Helper: Clean up all subscriptions and handlers
  const cleanupSubscriptions = useCallback(async () => {
    // Call unsubscribe refs - they already handle forgetAll() internally
    // Don't call unsubscribeAll() again to avoid nested forget_all deadlock
    if (tickUnsubscribeRef.current) {
      try {
        tickUnsubscribeRef.current()
      } catch {}
      tickUnsubscribeRef.current = null
    }
    if (ohlcUnsubscribeRef.current) {
      try {
        ohlcUnsubscribeRef.current()
      } catch {}
      ohlcUnsubscribeRef.current = null
    }
    activeStreamRef.current = null
    // Clear handlers directly instead of calling unsubscribeAll (avoid deadlock)
    const api = getDerivAPI()
    api.clearAllHandlers()
  }, [])

  const initializeAPI = useCallback(async () => {
    setConnectionState({ isConnecting: true, error: null })
    try {
      const api = getDerivAPI()
      
      // Set the authentication token from environment variable
      const token = import.meta.env.VITE_DERIV_API_TOKEN
      if (token) {
        api.setToken(token)
      }
      
      // Re-enable reconnection for manual refresh
      api.enableReconnection()
      
      // Initialize the connection
      await api.initialize()
      
      // CLEAN SLATE: Force termination of ALL ghost subscriptions before any new ones
      // This prevents the "logic deadlock" where stale subscriptions block new data
      // Run AFTER connection is established to ensure API is ready
      console.log("[Home] Running clean slate startup...")
      await api.cleanSlateStartup()
      
      // Clear local state to ensure fresh start (done AFTER clean slate)
      clearState()
      
      // Set connection state AFTER clearState (which resets isConnected to false)
      setConnectionState({ isConnected: true, isConnecting: false, lastConnected: Date.now() })

      // Fetch symbols and wait for it to complete
      await fetchSymbols()

      // Set the loading symbol ref
      loadingSymbolRef.current = currentSymbol

      // Fetch appropriate history based on chart style
      if (chartStyle === 'area' || chartStyle === 'line') {
        const history = await api.getTickHistory(currentSymbol, 1000)
        const ticks = history.prices.map((price, i) => ({
          epoch: history.times[i],
          quote: price,
          symbol: currentSymbol,
        }))
        setTickHistory(ticks)
      } else {
        // Fetch OHLC history for OHLC and candlestick chart styles (real candles)
        try {
          const ohlcData = await api.getOHLCHistory(currentSymbol, 60, 500)
          const ohlcHistory = ohlcData.candles.map((c) => ({
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            epoch: c.epoch,
            granularity: 60,
            symbol: currentSymbol,
          }))
          setOHLCHistory(ohlcHistory)
        } catch (err) {
          console.warn("[Home] Failed to fetch OHLC history, falling back to tick history:", err)
          const history = await api.getTickHistory(currentSymbol, 1000)
          const ticks = history.prices.map((price, i) => ({
            epoch: history.times[i],
            quote: price,
            symbol: currentSymbol,
          }))
          setTickHistory(ticks)
        }
      }
      
       // Subscribe to the correct stream
      await subscribeToStream(currentSymbol, chartStyle)
      
      // Mark initialization complete AFTER subscribing
      hasInitializedRef.current = true
    } catch (err) {
      setConnectionState({
        isConnected: false,
        isConnecting: false,
        error: err instanceof Error ? err.message : "Connection failed",
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - only run once on mount

  // Run initializeAPI once on mount
  useEffect(() => {
    initializeAPI()
  }, [initializeAPI])

  // Cleanup only on unmount
  useEffect(() => {
    return () => { 
      if (tickUnsubscribeRef.current) {
        tickUnsubscribeRef.current()
      }
      if (ohlcUnsubscribeRef.current) {
        ohlcUnsubscribeRef.current()
      }
      getDerivAPI().disconnect() 
    }
  }, [])

  // Handle symbol changes after initialization
  useEffect(() => {
    // CRITICAL: Skip if initialization hasn't completed yet
    if (!hasInitializedRef.current) return
    if (!isConnected) return
    
    const handleSymbolChange = async () => {
      const symbolToLoad = currentSymbol
      loadingSymbolRef.current = symbolToLoad
      setIsSymbolLoading(true)
      
      // Clean up ALL previous subscriptions (handlers + API)
      await cleanupSubscriptions()
      
      // Check if we're still loading the same symbol
      if (loadingSymbolRef.current !== symbolToLoad) {
        console.log("[Home] Symbol changed during load, aborting:", symbolToLoad)
        return
      }
      
      const api = getDerivAPI()
      
      try {
        // Fetch appropriate history based on chart style
        if (chartStyle === 'area' || chartStyle === 'line') {
          const history = await api.getTickHistory(symbolToLoad, 1000)
          if (loadingSymbolRef.current !== symbolToLoad) return
          const ticks = history.prices.map((price, i) => ({
            epoch: history.times[i],
            quote: price,
            symbol: symbolToLoad,
          }))
          setTickHistory(ticks)
        } else {
          // 'ohlc' and 'candlestick' both use real OHLC data
          try {
            const ohlcData = await api.getOHLCHistory(symbolToLoad, 60, 500)
            if (loadingSymbolRef.current !== symbolToLoad) return
            const ohlcHistory = ohlcData.candles.map((c) => ({
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close),
              epoch: c.epoch,
              granularity: 60,
              symbol: symbolToLoad,
            }))
            setOHLCHistory(ohlcHistory)
          } catch {
            const history = await api.getTickHistory(symbolToLoad, 1000)
            if (loadingSymbolRef.current !== symbolToLoad) return
            const ticks = history.prices.map((price, i) => ({
              epoch: history.times[i],
              quote: price,
              symbol: symbolToLoad,
            }))
            setTickHistory(ticks)
          }
        }
        
         // Subscribe to the correct stream for the new symbol
        await subscribeToStream(symbolToLoad, chartStyle)
      } catch (err) {
        console.error("[Home] Failed to switch symbol:", err)
      } finally {
        if (loadingSymbolRef.current === symbolToLoad) {
          setIsSymbolLoading(false)
        }
      }
    }
    
    handleSymbolChange()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSymbol]) // Only react to symbol changes

    // Listen for account connection changes to force re-subscribe
    useEffect(() => {
      const handleAccountConnected = async () => {
        console.log("[Home] Account connected event received, re-subscribing...")
        if (currentSymbol) {
          // Force complete cleanup
          await cleanupSubscriptions()
          // Re-subscribe
          await subscribeToStream(currentSymbol, chartStyle)
        }
      }
      
      window.addEventListener('account_connected', handleAccountConnected)
      return () => window.removeEventListener('account_connected', handleAccountConnected)
    }, [currentSymbol, chartStyle, subscribeToStream, cleanupSubscriptions])

    // Handle chart style changes - switch between tick and OHLC streams
    useEffect(() => {
      // CRITICAL: Skip if initialization hasn't completed yet
      if (!hasInitializedRef.current) return
      if (!isConnected) return
      
      const handleChartStyleChange = async () => {
      console.log("[Home] Chart style changed to:", chartStyle)
      
      // Clean up ALL previous subscriptions (handlers + API)
      await cleanupSubscriptions()
      
      const api = getDerivAPI()
      
      // Fetch appropriate history for the new chart style
      try {
        if (chartStyle === 'area' || chartStyle === 'line') {
          const history = await api.getTickHistory(currentSymbol, 1000)
          const ticks = history.prices.map((price, i) => ({
            epoch: history.times[i],
            quote: price,
            symbol: currentSymbol,
          }))
          setTickHistory(ticks)
        } else {
          // 'ohlc' and 'candlestick' both use real OHLC data
          try {
            const ohlcData = await api.getOHLCHistory(currentSymbol, 60, 500)
            const ohlcHistory = ohlcData.candles.map((c) => ({
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close),
              epoch: c.epoch,
              granularity: 60,
              symbol: currentSymbol,
            }))
            setOHLCHistory(ohlcHistory)
          } catch (err) {
            console.warn("[Home] Failed to fetch OHLC history, falling back to tick history:", err)
            const history = await api.getTickHistory(currentSymbol, 1000)
            const ticks = history.prices.map((price, i) => ({
              epoch: history.times[i],
              quote: price,
              symbol: currentSymbol,
            }))
            setTickHistory(ticks)
          }
        }
      } catch (err) {
        console.error("[Home] Failed to fetch history for chart style change:", err)
      }
      
      // Subscribe to the correct stream
      await subscribeToStream(currentSymbol, chartStyle)
    }
    
    handleChartStyleChange()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartStyle]) // Only react to chart style changes

  const currentSymbolData = symbols.find((s) => s.symbol === currentSymbol)
  const lastTick = tickHistory?.[tickHistory.length - 1]
  const secondLastTick = tickHistory?.[tickHistory.length - 2]
  const firstTick = tickHistory?.[0]
  
  // Calculate High/Low based on chart style
  // For 'ohlc' and 'candlestick', use OHLC high/low; for 'area'/'line', use tick quotes
  const useOhlcData = chartStyle === 'ohlc' || chartStyle === 'candlestick'
  
  const highValue = useOhlcData
    ? (ohlcHistory?.length > 0 ? Math.max(...ohlcHistory.map((c) => c?.high ?? 0)) : null)
    : (tickHistory?.length > 0 ? Math.max(...tickHistory.map((t) => t?.quote ?? 0)) : null)
  
  const lowValue = useOhlcData
    ? (ohlcHistory?.length > 0 ? Math.min(...ohlcHistory.map((c) => c?.low ?? 0)) : null)
    : (tickHistory?.length > 0 ? Math.min(...tickHistory.map((t) => t?.quote ?? 0)) : null)
  
  const priceChange = lastTick && secondLastTick
    ? lastTick.quote - secondLastTick.quote
    : 0
  const priceChangePercent = lastTick && firstTick && firstTick.quote !== 0
    ? ((lastTick.quote - firstTick.quote) / firstTick.quote) * 100
    : 0

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="hover:opacity-80 transition-opacity flex items-center gap-2">
                <HomeIcon className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold text-primary">PROMO Trade</h1>
              </Link>
              <div className="flex items-center gap-2 text-sm">
                {isConnected ? <Wifi className="h-4 w-4 text-profit" /> : <WifiOff className="h-4 w-4 text-loss" />}
                <span className={isConnected ? "text-profit" : "text-loss"}>
                  {isConnecting ? "Connecting..." : isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Link to="/mochi-moto">
                <Button variant="outline" size="sm" className="gap-2" style={{
                  backgroundColor: "#FFE5F0",
                  border: "2px solid #FFB8D0",
                  color: "#8B5E3C"
                }}>
                  <Gamepad2 className="h-4 w-4" />
                  Mochi Moto
                </Button>
              </Link>
              <Link to="/surf-the-waves">
                <Button variant="outline" size="sm" className="gap-2" style={{
                  backgroundColor: "#E0F2FE",
                  border: "2px solid #0EA5E9",
                  color: "#0C4A6E"
                }}>
                  <Waves className="h-4 w-4" />
                  Surf Waves
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => { clearState(); initializeAPI() }} disabled={isConnecting}>
                <RefreshCw className={`h-4 w-4 ${isConnecting ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {error && !error.includes("WebSocket closed immediately after opening") && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2">
          <p className="text-destructive text-sm text-center">{error}</p>
        </div>
      )}

      <main className="container mx-auto px-4 py-4 md:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Watchlist />
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div className="w-full sm:w-auto flex-1 max-w-sm">
                <AssetSelector className="w-full" />
                <p className="text-sm text-muted-foreground mt-1 px-1">{currentSymbolData?.market_display_name}</p>
              </div>
              <div className="text-right w-full sm:w-auto bg-card rounded-lg p-3 border shadow-sm flex items-center gap-4">
                <div>
                  <div className="text-2xl font-bold">{currentTick ? formatNumber(currentTick.quote, 5) : "---"}</div>
                  <div className={`flex items-center gap-1 text-sm justify-end ${priceChange >= 0 ? "text-profit" : "text-loss"}`}>
                    {priceChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <span>{formatPercentage(priceChangePercent)}</span>
                  </div>
                </div>
                <div className="h-10 w-px bg-border mx-2 hidden sm:block"></div>
                <div className="hidden sm:flex flex-col gap-1 text-xs text-right min-w-[80px]">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">H:</span>
                    <span className="text-profit font-medium">{highValue !== null ? formatNumber(highValue, 5) : "---"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">L:</span>
                    <span className="text-loss font-medium">{lowValue !== null ? formatNumber(lowValue, 5) : "---"}</span>
                  </div>
                </div>
              </div>
            </div>

            <Card className="overflow-hidden flex flex-col border shadow-sm">
              <div className="border-b bg-muted/20 p-2 flex justify-between items-center">
                <span className="text-sm font-medium px-2 text-muted-foreground flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4" /> Chart
                </span>
                <ChartStyleSelector />
              </div>
              <CardContent className="p-0 h-[450px]">
                <ErrorBoundary>
                  <TradingChart className="h-full" />
                </ErrorBoundary>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ActiveContractsPanel />
              <DerivPoints />
            </div>

             <AlertSystem />
             <SocialTrading />
             <TradeHistory />
          </div>

          <div className="lg:col-span-1 space-y-4">
            <TradingPanel />
            <div className="border-t pt-4 mt-2 space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground px-1 uppercase tracking-wider">Account & Wallet</h3>
              <AccountSwitcher />
              <DepositWithdraw />
              <AccountSnapshot />
            </div>
            <div className="border-t pt-4 mt-2">
              <h3 className="text-sm font-medium text-muted-foreground px-1 uppercase tracking-wider mb-3">AI Assistant</h3>
              <AIAssistant />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Home

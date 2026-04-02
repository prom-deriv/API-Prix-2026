import { useEffect, useCallback, useRef } from "react"
import { getDerivAPI } from "./lib/deriv-api"
import { useTradingStore } from "./stores/tradingStore"
import TickChart from "./components/charts/TickChart"
import TradingPanel from "./components/trading/TradingPanel"
import AccountSnapshot from "./components/account/AccountSnapshot"
import AssetSelector from "./components/trading/AssetSelector"
import ErrorBoundary from "./components/ui/ErrorBoundary"
import { Card, CardContent } from "./components/ui/card"
import { Button } from "./components/ui/button"
import { formatNumber, formatPercentage } from "./lib/utils"
import { Wifi, WifiOff, RefreshCw, TrendingUp, TrendingDown } from "lucide-react"

function App() {
  const {
    symbols,
    currentSymbol,
    currentTick,
    tickHistory,
    totalTicksReceived,
    isConnected,
    isConnecting,
    error,
    setSymbols,
    setCurrentTick,
    setTickHistory,
    setConnectionState,
    setIsSymbolLoading,
  } = useTradingStore()

  // Store the unsubscribe function for ticks
  const tickUnsubscribeRef = useRef<(() => void) | null>(null)
  // Track the current symbol being loaded to prevent race conditions
  const loadingSymbolRef = useRef<string | null>(null)

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
      
      // Initialize the connection (this is now explicit, not auto-connected in constructor)
      await api.initialize()
      
      setConnectionState({ isConnected: true, isConnecting: false, lastConnected: Date.now() })
      
      const activeSymbols = await api.getActiveSymbols()
      setSymbols(activeSymbols)
      const history = await api.getTickHistory(currentSymbol, 1000)
      const ticks = history.prices.map((price, i) => ({
        epoch: history.times[i],
        quote: price,
        symbol: currentSymbol,
      }))
      setTickHistory(ticks)
      
      // Store the unsubscribe function
      tickUnsubscribeRef.current = api.subscribeTicks(currentSymbol, (tick) => {
        setCurrentTick({ epoch: tick.epoch, quote: tick.quote, symbol: tick.symbol })
      })
    } catch (err) {
      setConnectionState({
        isConnected: false,
        isConnecting: false,
        error: err instanceof Error ? err.message : "Connection failed",
      })
    }
  }, [currentSymbol, setSymbols, setCurrentTick, setTickHistory, setConnectionState])

  // Handle reconnection events
  useEffect(() => {
    const api = getDerivAPI()
    
    const handleResubscribed = () => {
      console.log("[App] Resubscribed after reconnection")
      // Refresh tick history after reconnection
      api.getTickHistory(currentSymbol, 1000).then((history) => {
        const ticks = history.prices.map((price, i) => ({
          epoch: history.times[i],
          quote: price,
          symbol: currentSymbol,
        }))
        setTickHistory(ticks)
      }).catch(console.error)
    }

    const unsubscribe = api.on("resubscribed", handleResubscribed)
    
    return () => {
      unsubscribe()
    }
  }, [currentSymbol, setTickHistory])

  useEffect(() => {
    initializeAPI()
  }, [initializeAPI])

  // Cleanup only on unmount
  useEffect(() => {
    return () => { 
      // Clean up tick subscription
      if (tickUnsubscribeRef.current) {
        tickUnsubscribeRef.current()
      }
      getDerivAPI().disconnect() 
    }
  }, [])

  // Handle symbol changes after initialization
  useEffect(() => {
    const handleSymbolChange = async () => {
      // Skip if this is the initial load (handled by initializeAPI)
      if (!isConnected) return
      
      // Prevent race conditions - track which symbol we're loading
      const symbolToLoad = currentSymbol
      loadingSymbolRef.current = symbolToLoad
      
      // Set loading state
      setIsSymbolLoading(true)
      
      const api = getDerivAPI()
      
      // Clean up previous tick subscription
      if (tickUnsubscribeRef.current) {
        tickUnsubscribeRef.current()
        tickUnsubscribeRef.current = null
      }
      
      // Unsubscribe from all ticks to ensure clean state
      await api.unsubscribeTicks()
      
      // Check if we're still loading the same symbol (user didn't click again)
      if (loadingSymbolRef.current !== symbolToLoad) {
        console.log("[App] Symbol changed during load, aborting:", symbolToLoad)
        return
      }
      
      try {
        // Fetch new tick history
        const history = await api.getTickHistory(symbolToLoad, 1000)
        
        // Check again if we're still loading the same symbol
        if (loadingSymbolRef.current !== symbolToLoad) {
          console.log("[App] Symbol changed during history fetch, aborting:", symbolToLoad)
          return
        }
        
        const ticks = history.prices.map((price, i) => ({
          epoch: history.times[i],
          quote: price,
          symbol: symbolToLoad,
        }))
        setTickHistory(ticks)
        
        // Subscribe to new symbol's ticks
        tickUnsubscribeRef.current = api.subscribeTicks(symbolToLoad, (tick) => {
          // Only update if this is still the current symbol
          if (loadingSymbolRef.current === symbolToLoad) {
            setCurrentTick({ epoch: tick.epoch, quote: tick.quote, symbol: tick.symbol })
          }
        })
      } catch (err) {
        console.error("[App] Failed to switch symbol:", err)
      } finally {
        // Only clear loading if this is still the current symbol
        if (loadingSymbolRef.current === symbolToLoad) {
          setIsSymbolLoading(false)
        }
      }
    }
    
    handleSymbolChange()
  }, [currentSymbol, isConnected, setIsSymbolLoading, setTickHistory, setCurrentTick])

  const currentSymbolData = symbols.find((s) => s.symbol === currentSymbol)
  // Safe data access with optional chaining
  const lastTick = tickHistory?.[tickHistory.length - 1]
  const secondLastTick = tickHistory?.[tickHistory.length - 2]
  const firstTick = tickHistory?.[0]
  
  const priceChange = lastTick && secondLastTick
    ? lastTick.quote - secondLastTick.quote
    : 0
  const priceChangePercent = lastTick && firstTick && firstTick.quote !== 0
    ? ((lastTick.quote - firstTick.quote) / firstTick.quote) * 100
    : 0

  return (
    <div className="min-h-screen bg-background text-foreground dark">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-primary">PROMO Trade</h1>
              <div className="flex items-center gap-2 text-sm">
                {isConnected ? <Wifi className="h-4 w-4 text-profit" /> : <WifiOff className="h-4 w-4 text-loss" />}
                <span className={isConnected ? "text-profit" : "text-loss"}>
                  {isConnecting ? "Connecting..." : isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <AssetSelector className="w-64" />
              <Button variant="outline" size="sm" onClick={initializeAPI} disabled={isConnecting}>
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
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">{currentSymbolData?.display_name || currentSymbol}</h2>
                    <p className="text-sm text-muted-foreground">{currentSymbolData?.market_display_name}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">{currentTick ? formatNumber(currentTick.quote, 5) : "---"}</div>
                    <div className={`flex items-center gap-1 text-sm ${priceChange >= 0 ? "text-profit" : "text-loss"}`}>
                      {priceChange >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      <span>{formatPercentage(priceChangePercent)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="h-[400px]">
              <CardContent className="p-0 h-full">
                <ErrorBoundary>
                  <TickChart className="h-full" />
                </ErrorBoundary>
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">High</p>
                  <p className="text-lg font-semibold text-profit">
                    {tickHistory?.length > 0 ? formatNumber(Math.max(...tickHistory.map((t) => t?.quote ?? 0)), 5) : "---"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Low</p>
                  <p className="text-lg font-semibold text-loss">
                    {tickHistory?.length > 0 ? formatNumber(Math.min(...tickHistory.map((t) => t?.quote ?? 0)), 5) : "---"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Ticks</p>
                  <p className="text-lg font-semibold">{totalTicksReceived}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-4">
            <TradingPanel />
            <AccountSnapshot />
          </div>
        </div>
      </main>
    </div>
  )
}

export default App

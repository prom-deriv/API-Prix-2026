import React, { useEffect, useCallback } from "react"
import { getDerivAPI } from "./lib/deriv-api"
import { useTradingStore } from "./stores/tradingStore"
import TickChart from "./components/charts/TickChart"
import TradingPanel from "./components/trading/TradingPanel"
import AccountSnapshot from "./components/account/AccountSnapshot"
import { Card, CardContent } from "./components/ui/card"
import { Button } from "./components/ui/button"
import { Select } from "./components/ui/select"
import { formatNumber, formatPercentage } from "./lib/utils"
import { Wifi, WifiOff, RefreshCw, TrendingUp, TrendingDown } from "lucide-react"

function App() {
  const {
    symbols,
    currentSymbol,
    currentTick,
    tickHistory,
    isConnected,
    isConnecting,
    error,
    setSymbols,
    setCurrentSymbol,
    setCurrentTick,
    setTickHistory,
    setConnectionState,
  } = useTradingStore()

  const initializeAPI = useCallback(async () => {
    setConnectionState({ isConnecting: true, error: null })
    try {
      const api = getDerivAPI()
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Connection timeout")), 10000)
        const unsubscribe = api.on("connection", (data: any) => {
          if (data.connected) {
            clearTimeout(timeout)
            unsubscribe()
            resolve()
          }
        })
      })
      setConnectionState({ isConnected: true, isConnecting: false, lastConnected: Date.now() })
      const activeSymbols = await api.getActiveSymbols()
      setSymbols(activeSymbols)
      const history = await api.getTickHistory(currentSymbol, 100)
      const ticks = history.prices.map((price, i) => ({
        epoch: history.times[i],
        quote: price,
        symbol: currentSymbol,
      }))
      setTickHistory(ticks)
      api.subscribeTicks(currentSymbol, (tick) => {
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

  useEffect(() => {
    initializeAPI()
    return () => { getDerivAPI().disconnect() }
  }, [initializeAPI])

  const handleSymbolChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSymbol = e.target.value
    setCurrentSymbol(newSymbol)
    const api = getDerivAPI()
    api.subscribeTicks(newSymbol, (tick) => {
      setCurrentTick({ epoch: tick.epoch, quote: tick.quote, symbol: tick.symbol })
    })
    api.getTickHistory(newSymbol, 100).then((history) => {
      const ticks = history.prices.map((price, i) => ({
        epoch: history.times[i],
        quote: price,
        symbol: newSymbol,
      }))
      setTickHistory(ticks)
    })
  }, [setCurrentSymbol, setCurrentTick, setTickHistory])

  const symbolOptions = symbols.map((s) => ({ value: s.symbol, label: s.display_name }))
  const currentSymbolData = symbols.find((s) => s.symbol === currentSymbol)
  const priceChange = tickHistory.length >= 2
    ? tickHistory[tickHistory.length - 1].quote - tickHistory[tickHistory.length - 2].quote
    : 0
  const priceChangePercent = tickHistory.length >= 2
    ? ((tickHistory[tickHistory.length - 1].quote - tickHistory[0].quote) / tickHistory[0].quote) * 100
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
              {symbolOptions.length > 0 && (
                <Select options={symbolOptions} value={currentSymbol} onChange={handleSymbolChange} className="w-48" />
              )}
              <Button variant="outline" size="sm" onClick={initializeAPI} disabled={isConnecting}>
                <RefreshCw className={`h-4 w-4 ${isConnecting ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {error && (
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
                <TickChart className="h-full" />
              </CardContent>
            </Card>

            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">High</p>
                  <p className="text-lg font-semibold text-profit">
                    {tickHistory.length > 0 ? formatNumber(Math.max(...tickHistory.map((t) => t.quote)), 5) : "---"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Low</p>
                  <p className="text-lg font-semibold text-loss">
                    {tickHistory.length > 0 ? formatNumber(Math.min(...tickHistory.map((t) => t.quote)), 5) : "---"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Ticks</p>
                  <p className="text-lg font-semibold">{tickHistory.length}</p>
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

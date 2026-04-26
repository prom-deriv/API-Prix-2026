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
import DerivPoints from "../components/trading/DerivPoints"
import DerivGiftCard from "../components/trading/DerivGiftCard"
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
import { useAccount } from "../contexts/AccountContext"
import { Volume2, VolumeX } from "lucide-react"
import { getSoundManager } from "../utils/soundManager"
import { useState } from "react"

function Home() {
  const { isConnected, isConnecting } = useAccount()
  const [isSoundEnabled, setIsSoundEnabled] = useState(false)

  const {
    symbols,
    currentSymbol,
    currentTick,
    tickHistory,
    ohlcHistory,
    error: tradingError,
    chartStyle,
    setCurrentTick,
    setTickHistory,
    setCurrentOHLC,
    setOHLCHistory,
    setConnectionState,
    isSymbolLoading,
    setIsSymbolLoading,
    fetchSymbols,
    clearState,
  } = useTradingStore()

  const error = tradingError

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
            // STRICT FILTERING: Only process ticks for the currently requested symbol
            if (tick.symbol !== symbol) return;

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
            // STRICT FILTERING: Only process OHLC for the currently requested symbol
            if (ohlc.symbol !== symbol) return;

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
    // DO NOT clear handlers directly here.
    // The unsubscribe functions (called above) specifically remove their own handlers via this.off().
    // Calling api.clearAllHandlers() blindly wipes out the NEW subscription's handler
    // if the new stream was already started by a concurrent effect.
    // const api = getDerivAPI()
    // api.clearAllHandlers()
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
      // Removed getDerivAPI().disconnect() so auth persists across pages
    }
  }, [])

  // Handle symbol changes after initialization
  useEffect(() => {
    // CRITICAL: Skip if initialization hasn't completed yet
    if (!hasInitializedRef.current) return
    if (!isConnected) return
    
    // Check if we're already processing this exact symbol to avoid redundant API calls
    if (loadingSymbolRef.current === currentSymbol && !isSymbolLoading) return
    
    const handleSymbolChange = async () => {
      const symbolToLoad = currentSymbol
      loadingSymbolRef.current = symbolToLoad
      setIsSymbolLoading(true)
      
      // Clean up ALL previous subscriptions (handlers + API)
      await cleanupSubscriptions()
      
      const api = getDerivAPI()

      // ✅ CRITICAL FIX for "chart starts from 0" after symbol switch:
      // Explicitly await the server-side termination of the PREVIOUS symbol's
      // tick/candle streams before we fetch history for the NEW symbol.
      //
      // Without this await, the server may still be pushing the old symbol's
      // ticks into the shared WebSocket at the same moment we issue the new
      // `ticks_history` request. Because responses on a single WS can arrive
      // out-of-order after a subscription change, the new symbol's history
      // response could race against leaked old-symbol ticks, leaving the
      // chart with only a handful of fresh live ticks (the "starts from 0"
      // symptom seen on BTC/USD).
      //
      // The cleanupSubscriptions() above fires forget_all but does NOT await
      // it (the unsubscribe closures are fire-and-forget). Awaiting here
      // guarantees the server has acknowledged termination before we proceed.
      try {
        await Promise.all([
          api.forgetAll("ticks").catch(() => undefined),
          api.forgetAll("candles").catch(() => undefined),
        ])
      } catch {
        // Non-fatal: if forget_all fails the store-layer symbol guard in
        // tradingStore.setCurrentTick/setCurrentOHLC will still drop any
        // stale cross-symbol ticks.
      }

      // Wait a tiny bit to ensure WebSocket state fully settles after unsubscribe
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Check if we're still loading the same symbol
      if (loadingSymbolRef.current !== symbolToLoad) {
        console.log("[Home] Symbol changed during load, aborting:", symbolToLoad)
        return
      }
      
      // Give UI a tick to clear existing chart data visually
      // setTickHistory([])
      // setOHLCHistory([])
      await new Promise(resolve => setTimeout(resolve, 50))

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
      } catch (err: any) {
        console.error("[Home] Failed to switch symbol:", err)
        if (err?.message?.includes('market is presently closed')) {
          import('react-hot-toast').then(({ default: toast }) => {
            toast.error(err.message || 'This market is presently closed.');
          });
        }
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
      // ✅ Re-entrancy guard local to this effect instance. Prevents the
      // handler from running concurrently with itself when the
      // `account_connected` window event fires more than once in quick
      // succession (observed in prod during the OAuth/OTP swap — two
      // dispatches within ~20ms because AccountContext's auto-reconnect
      // and initial-connect paths can both fire). Two concurrent runs
      // would otherwise issue duplicate ticks_history + ticks subscribe
      // for the SAME symbol, racing each other.
      let isHandling = false

      const handleAccountConnected = async () => {
        if (isHandling) {
          console.log("[Home] account_connected re-entry ignored")
          return
        }
        isHandling = true
        try {
          console.log("[Home] Account connected event received, re-subscribing...")

          // Clear any lingering connection errors (e.g. Request timeout)
          // caused by the initial public connection being dropped
          setConnectionState({ error: null })

          if (!currentSymbol) return

          const api = getDerivAPI()
          const symbolToLoad = currentSymbol
          loadingSymbolRef.current = symbolToLoad

          // 1. Force complete cleanup of anything left over from the pre-OAuth
          //    public connection (handlers, local refs).
          await cleanupSubscriptions()

          // 2. Wait for the newly-authenticated WebSocket to have fully torn
          //    down any server-side market-data streams that may still be
          //    running for a DIFFERENT symbol than the one the user is now
          //    viewing. Without this, zombie ticks from the previous symbol
          //    can race with the fresh history response below and leave the
          //    chart header showing stale data.
          try {
            await Promise.all([
              api.forgetAll("ticks").catch(() => undefined),
              api.forgetAll("candles").catch(() => undefined),
            ])
          } catch {
            // Non-fatal — the store-layer guards still protect against leaks.
          }

          // Give the WS a moment to settle after forget_all.
          await new Promise((r) => setTimeout(r, 100))

          // Abort if the user switched symbols while we were waiting.
          if (loadingSymbolRef.current !== symbolToLoad) return

          // 3. Re-fetch the chart history for the current symbol. This is the
          //    critical step that was missing before — previously this handler
          //    only called `subscribeToStream`, so after account_connected the
          //    live stream would start but no historical candles/ticks were
          //    ever re-seeded, producing an empty chart.
          try {
            if (chartStyle === "area" || chartStyle === "line") {
              const history = await api.getTickHistory(symbolToLoad, 1000)
              if (loadingSymbolRef.current !== symbolToLoad) return
              const ticks = history.prices.map((price, i) => ({
                epoch: history.times[i],
                quote: price,
                symbol: symbolToLoad,
              }))
              setTickHistory(ticks)
            } else {
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
          } catch (err) {
            console.warn("[Home] Re-fetching history after account_connected failed:", err)
          }

          // 4. Re-subscribe to the live stream last, so the history is already
          //    in place before live ticks start arriving.
          if (loadingSymbolRef.current !== symbolToLoad) return
          await subscribeToStream(symbolToLoad, chartStyle)
        } finally {
          // Release the re-entrancy guard whether we exited via early-return,
          // an intermediate symbol-change abort, or completed the full
          // re-subscribe flow.
          isHandling = false
        }
      }

      window.addEventListener('account_connected', handleAccountConnected)
      return () => window.removeEventListener('account_connected', handleAccountConnected)
    }, [currentSymbol, chartStyle, subscribeToStream, cleanupSubscriptions, setConnectionState, setTickHistory, setOHLCHistory])

    // Handle chart style changes - switch between tick and OHLC streams
    useEffect(() => {
      // CRITICAL: Skip if initialization hasn't completed yet
      if (!hasInitializedRef.current) return
      if (!isConnected) return
      
      const handleChartStyleChange = async () => {
      console.log("[Home] Chart style changed to:", chartStyle)
      
      // Clean up ALL previous subscriptions (handlers + API)
      await cleanupSubscriptions()

      // NOTE: We intentionally do NOT clear tickHistory / ohlcHistory here.
      // Together with the matching change in tradingStore.setChartStyle and
      // the series-seed logic in TradingChart, keeping the existing history
      // means the chart re-renders the FULL history on the new series
      // immediately — no "chart starts from 0" flash.
      await new Promise(resolve => setTimeout(resolve, 50))
      
      const api = getDerivAPI()
      
      // Helper to handle API requests and specifically ignore "Connection replaced" errors
      const fetchWithRetry = async (fetchFn: () => Promise<any>) => {
        try {
          return await fetchFn()
        } catch (err: any) {
          if (err.message === "Connection replaced") {
            console.log("[Home] Ignoring 'Connection replaced' error during chart style change")
            return null
          }
          throw err
        }
      }

      // Read the latest store state so we can decide whether a re-fetch is
      // actually needed for the current symbol. If the relevant history
      // array is already populated AND belongs to the current symbol, we
      // skip the network round-trip entirely — the chart already has data.
      const storeState = useTradingStore.getState()
      const hasTickHistoryForSymbol =
        storeState.tickHistory.length > 0 &&
        storeState.tickHistory[storeState.tickHistory.length - 1]?.symbol === currentSymbol
      const hasOhlcHistoryForSymbol =
        storeState.ohlcHistory.length > 0 &&
        storeState.ohlcHistory[storeState.ohlcHistory.length - 1]?.symbol === currentSymbol

      // Fetch appropriate history for the new chart style (only if missing)
      try {
        if (chartStyle === 'area' || chartStyle === 'line') {
          if (!hasTickHistoryForSymbol) {
            const history = await fetchWithRetry(() => api.getTickHistory(currentSymbol, 1000))
            if (history) {
              const ticks = history.prices.map((price: number, i: number) => ({
                epoch: history.times[i],
                quote: price,
                symbol: currentSymbol,
              }))
              setTickHistory(ticks)
            }
          }
        } else {
          // Fetch OHLC history for OHLC and candlestick chart styles (real candles)
          if (!hasOhlcHistoryForSymbol) {
            try {
              const ohlcData = await fetchWithRetry(() => api.getOHLCHistory(currentSymbol, 60, 500))
              if (ohlcData) {
                const ohlcHistory = ohlcData.candles.map((c: any) => ({
                  open: Number(c.open),
                  high: Number(c.high),
                  low: Number(c.low),
                  close: Number(c.close),
                  epoch: c.epoch,
                  granularity: 60,
                  symbol: currentSymbol,
                }))
                setOHLCHistory(ohlcHistory)
              }
            } catch (err: any) {
              if (err.message !== "Connection replaced") {
                console.warn("[Home] Failed to fetch OHLC history, falling back to tick history:", err)
                const history = await fetchWithRetry(() => api.getTickHistory(currentSymbol, 1000))
                if (history) {
                  const ticks = history.prices.map((price: number, i: number) => ({
                    epoch: history.times[i],
                    quote: price,
                    symbol: currentSymbol,
                  }))
                  setTickHistory(ticks)
                }
              }
            }
          }
        }
      } catch (err: any) {
        if (err.message === "Connection replaced") {
          console.log("[Home] Ignoring 'Connection replaced' error during chart style change")
        } else {
          console.error("[Home] Failed to fetch history for chart style change:", err)
        }
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

  // Play heartbeat on new tick
  useEffect(() => {
    if (isSoundEnabled && currentTick) {
      const soundManager = getSoundManager()
      // Only play if audio is actually enabled in the manager
      if (soundManager.isAudioEnabled()) {
        soundManager.playHeartbeat()
      }
    }
  }, [currentTick, isSoundEnabled])

  const toggleSound = () => {
    const newState = !isSoundEnabled
    setIsSoundEnabled(newState)
    const soundManager = getSoundManager()
    soundManager.setEnabled(newState)
  }

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
              <Button variant="outline" size="sm" onClick={toggleSound}>
                {isSoundEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
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

            <div className="flex flex-col gap-4">
              <ActiveContractsPanel />
              <DerivPoints />
              <DerivGiftCard />
            </div>

             <AlertSystem />
             <SocialTrading />
             <TradeHistory />
          </div>

          <div className="lg:col-span-1 space-y-4">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground px-1 uppercase tracking-wider">Account & Wallet</h3>
              <AccountSwitcher />
            </div>
            <div className="border-t pt-4 mt-2">
              <TradingPanel />
            </div>
            <div className="border-t pt-4 mt-2">
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

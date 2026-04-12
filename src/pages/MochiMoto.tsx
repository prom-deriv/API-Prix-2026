import { useEffect, useCallback, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { getDerivAPI } from "../lib/deriv-api"
import { useTradingStore } from "../stores/tradingStore"
import { GhostProvider, useGhost } from "../contexts/GhostContext"
import { AccountProvider, useAccount } from "../contexts/AccountContext"
import { getSoundManager } from "../utils/soundManager"
import ProceduralTrack from "../components/mochi/ProceduralTrack"
import CharacterController from "../components/mochi/CharacterController"
import ParallaxBackground from "../components/mochi/ParallaxBackground"
import MiniMap from "../components/mochi/MiniMap"
import AssetSelector from "../components/trading/AssetSelector"
import GhostTradingPanel from "../components/ghost/GhostTradingPanel"
import ErrorBoundary from "../components/ui/ErrorBoundary"
import { Card, CardContent } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { formatNumber, formatCurrency } from "../lib/utils"
import { Wifi, WifiOff, RefreshCw, ArrowLeft, Gamepad2, Trophy, Zap, ArrowUp, ArrowDown } from "lucide-react"

function MochiMotoContent() {
  const {
    currentSymbol,
    currentTick,
    tickHistory,
    isConnected,
    isConnecting,
    error,
    setCurrentTick,
    setTickHistory,
    setConnectionState,
    setIsSymbolLoading,
    fetchSymbols,
    clearState,
  } = useTradingStore()

  const { mascotEmotion, activeGhostTrade, mochiPoints } = useGhost()
  const { balance, addBalance, deductBalance, accountType } = useAccount()

  const tickUnsubscribeRef = useRef<(() => void) | null>(null)
  const loadingSymbolRef = useRef<string | null>(null)
  const hasInitializedRef = useRef(false)
  const isSubscribingRef = useRef(false)
  
  const [raceState, setRaceState] = useState<"idle" | "revving" | "racing" | "finished">("idle")
  const [scrollOffset, setScrollOffset] = useState(0)
  const [slope, setSlope] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [roadY, setRoadY] = useState(0)
  const getRoadYRef = useRef<((x: number) => number) | null>(null)
  
  const stopDrivingSoundRef = useRef<(() => void) | null>(null)

  // Calculate slope from recent ticks
  const calculateSlope = useCallback((ticks: typeof tickHistory) => {
    if (ticks.length < 2) return 0
    const recent = ticks.slice(-5)
    const priceDiff = recent[recent.length - 1].quote - recent[0].quote
    const timeDiff = recent.length
    return Math.atan2(priceDiff, timeDiff) * (180 / Math.PI) / 45 // Normalize to ~±15 degrees
  }, [])

  // Subscribe to ticks
  const subscribeToStream = useCallback(async (symbol: string) => {
    let waited = 0
    while (isSubscribingRef.current && waited < 5000) {
      await new Promise(resolve => setTimeout(resolve, 100))
      waited += 100
    }
    
    isSubscribingRef.current = true
    
    try {
      const api = getDerivAPI()

      if (!api.isReady()) {
        console.warn("[MochiMoto] API not ready, waiting...")
        let apiWaited = 0
        while (!api.isReady() && apiWaited < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100))
          apiWaited += 100
        }
        if (!api.isReady()) {
          console.error("[MochiMoto] API timed out waiting for readiness")
          return
        }
      }

      tickUnsubscribeRef.current = await api.subscribeTicks(symbol, (tick) => {
        if (loadingSymbolRef.current === symbol || loadingSymbolRef.current === null) {
          const quote = Number(tick.quote)
          const epoch = Number(tick.epoch)
          if (isNaN(quote) || isNaN(epoch)) return
          setCurrentTick({ epoch, quote, symbol: tick.symbol })
        }
      })
      console.log("[MochiMoto] Tick subscription successful for:", symbol)
    } finally {
      isSubscribingRef.current = false
    }
  }, [setCurrentTick])

  // Clean up subscriptions - ONLY cleanup tick subscriptions, not all handlers
  const cleanupSubscriptions = useCallback(async () => {
    if (tickUnsubscribeRef.current) {
      try { tickUnsubscribeRef.current() } catch {}
      tickUnsubscribeRef.current = null
    }
    // Don't clear all handlers - this was causing the connection loop
    // Only clear tick-specific handlers via the unsubscribe function above
  }, [])

  // Initialize API
  const initializeAPI = useCallback(async () => {
    setConnectionState({ isConnecting: true, error: null })
    try {
      const api = getDerivAPI()
      
      const token = import.meta.env.VITE_DERIV_API_TOKEN
      if (token) {
        api.setToken(token)
      }
      
      api.enableReconnection()
      await api.initialize()
      
      console.log("[MochiMoto] Running clean slate startup...")
      await api.cleanSlateStartup()
      
      clearState()
      setConnectionState({ isConnected: true, isConnecting: false, lastConnected: Date.now() })
      await fetchSymbols()

      loadingSymbolRef.current = currentSymbol

      const history = await api.getTickHistory(currentSymbol, 20)
      const ticks = history.prices.map((price, i) => ({
        epoch: history.times[i],
        quote: price,
        symbol: currentSymbol,
      }))
      setTickHistory(ticks)
      
      await subscribeToStream(currentSymbol)
      hasInitializedRef.current = true
    } catch (err) {
      setConnectionState({
        isConnected: false,
        isConnecting: false,
        error: err instanceof Error ? err.message : "Connection failed",
      })
    }
  }, [])

  useEffect(() => {
    initializeAPI()
  }, [initializeAPI])

  useEffect(() => {
    return () => { 
      if (tickUnsubscribeRef.current) tickUnsubscribeRef.current()
      getDerivAPI().disconnect() 
    }
  }, [])

  // Update race state based on active trade
  useEffect(() => {
    const sm = getSoundManager()

    if (activeGhostTrade) {
      setRaceState("revving")
      sm.playEngineRev()
      
      const timer = setTimeout(() => {
        setRaceState("racing")
        stopDrivingSoundRef.current = sm.playEngineDriving()
      }, 1000)
      
      return () => clearTimeout(timer)
    } else if (raceState === "racing") {
      setRaceState("finished")
      
      if (stopDrivingSoundRef.current) {
        stopDrivingSoundRef.current()
        stopDrivingSoundRef.current = null
      }
      
      if (mascotEmotion === "win") {
        sm.playSessionEnd(true)
      } else if (mascotEmotion === "lose") {
        sm.playSessionEnd(false)
      }

      const timer = setTimeout(() => setRaceState("idle"), 3000)
      return () => clearTimeout(timer)
    }
  }, [activeGhostTrade, mascotEmotion])

  // Game loop for scrolling and slope calculation
  useEffect(() => {
    if (!isConnected || tickHistory.length < 2) return

    const gameLoop = () => {
      setScrollOffset(prev => prev + (raceState === "racing" ? 2 : 0.5))
      setSlope(calculateSlope(tickHistory))
      setSpeed(raceState === "racing" ? 60 : raceState === "revving" ? 0 : 20)
      
      // Update road Y position for center of screen
      if (getRoadYRef.current) {
        const centerScreenX = window.innerWidth / 2
        setRoadY(getRoadYRef.current(centerScreenX))
      }
    }

    const interval = setInterval(gameLoop, 1000 / 60) // 60fps
    return () => clearInterval(interval)
  }, [isConnected, tickHistory, raceState, calculateSlope])

  // Handle symbol change
  useEffect(() => {
    if (!hasInitializedRef.current) return
    if (!isConnected) return
    
    const handleSymbolChange = async () => {
      const symbolToLoad = currentSymbol
      loadingSymbolRef.current = symbolToLoad
      setIsSymbolLoading(true)
      
      // Clear tick history immediately to prevent ghost data
      setTickHistory([])
      
      await cleanupSubscriptions()
      
      if (loadingSymbolRef.current !== symbolToLoad) return
      
      const api = getDerivAPI()
      
      try {
        const history = await api.getTickHistory(symbolToLoad, 20)
        if (loadingSymbolRef.current !== symbolToLoad) return
        const ticks = history.prices.map((price, i) => ({
          epoch: history.times[i],
          quote: price,
          symbol: symbolToLoad,
        }))
        setTickHistory(ticks)
        
        await subscribeToStream(symbolToLoad)
      } catch (err) {
        console.error("[MochiMoto] Failed to switch symbol:", err)
      } finally {
        if (loadingSymbolRef.current === symbolToLoad) {
          setIsSymbolLoading(false)
        }
      }
    }
    
    handleSymbolChange()
  }, [currentSymbol])

  const lastTick = tickHistory?.[tickHistory.length - 1]
  const secondLastTick = tickHistory?.[tickHistory.length - 2]
  const priceChange = lastTick && secondLastTick ? lastTick.quote - secondLastTick.quote : 0
  const priceChangePercent = secondLastTick ? (Math.abs(priceChange) / secondLastTick.quote) * 100 : 0

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ backgroundColor: "#FFF9F2" }}>
      {/* Google Font */}
      <link 
        href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap" 
        rel="stylesheet" 
      />

      {/* Header */}
      <header className="flex-shrink-0 border-b-2 relative z-50 backdrop-blur-sm" style={{ 
        backgroundColor: "rgba(255, 249, 242, 0.9)",
        borderColor: "#F0E4D7"
      }}>
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="outline" size="sm" className="gap-2 rounded-xl" style={{
                  backgroundColor: "#FFF9F2",
                  border: "2px solid #F0E4D7",
                  color: "#8B5E3C"
                }}>
                  <ArrowLeft className="h-4 w-4" />
                  Live Trade
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Gamepad2 className="h-6 w-6" style={{ color: "#FF6B9D" }} />
                <h1 className="text-xl font-bold" style={{ 
                  fontFamily: "'Quicksand', 'Nunito', sans-serif",
                  color: "#8B5E3C"
                }}>
                  Mochi Moto
                </h1>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {isConnected ? <Wifi className="h-4 w-4" style={{ color: "#DFF2D8" }} /> : <WifiOff className="h-4 w-4" style={{ color: "#FFE5E5" }} />}
                <span style={{ color: isConnected ? "#DFF2D8" : "#FFE5E5" }}>
                  {isConnecting ? "Connecting..." : isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium" style={{
                backgroundColor: "#FFE5F0",
                color: "#8B5E3C",
                border: "2px solid #FFB8D0"
              }}>
                <Zap className="h-4 w-4" style={{ color: "#FF6B9D" }} />
                {mochiPoints} pts
              </div>
              <div className="px-3 py-1 rounded-full text-sm font-medium" style={{
                backgroundColor: "#DFF2D8",
                color: "#8B5E3C",
                border: "2px solid #DFF2D8"
              }}>
                {accountType === "demo" ? "Demo" : "Real"}: {formatCurrency(balance)}
              </div>
              <AssetSelector className="w-48" disabled={!!activeGhostTrade} />
              <Button variant="outline" size="sm" onClick={() => { clearState(); initializeAPI() }} disabled={isConnecting}
                className="rounded-xl" style={{
                  backgroundColor: "#FFF9F2",
                  border: "2px solid #F0E4D7",
                  color: "#8B5E3C"
                }}>
                <RefreshCw className={`h-4 w-4 ${isConnecting ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Error */}
      {error && !error.includes("WebSocket closed immediately after opening") && (
        <div className="border-b-2 px-4 py-2" style={{ 
          backgroundColor: "#FFE5E5",
          borderColor: "#FFE5E5"
        }}>
          <p className="text-sm text-center" style={{ color: "#8B5E3C" }}>{error}</p>
        </div>
      )}

      {/* Main Game Area */}
      <main className="flex-1 relative w-full">
        {/* Parallax Background - Layer 0 */}
        <div style={{ zIndex: 0 }}>
          <ParallaxBackground scrollOffset={scrollOffset} />
        </div>

        {/* Game Canvas - Layer 10 (Track) and Layer 20 (Characters) */}
        <div className="absolute inset-0">
          <ErrorBoundary>
            <ProceduralTrack 
              tickHistory={tickHistory}
              scrollOffset={scrollOffset}
              raceState={raceState}
              onRoadPositionChange={(getRoadY) => {
                getRoadYRef.current = getRoadY
              }}
            />
            <CharacterController
              emotion={mascotEmotion}
              slope={slope}
              raceState={raceState}
              priceChange={priceChange}
              tickHistory={tickHistory}
              roadY={roadY}
            />
          </ErrorBoundary>
        </div>

        {/* Race State Indicator */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30">
          <Card style={{
            borderRadius: "24px",
            border: "2px solid #F0E4D7",
            boxShadow: "0 10px 30px rgba(166, 123, 91, 0.08)",
            backgroundColor: "rgba(255, 255, 255, 0.9)"
          }}>
            <CardContent className="px-6 py-3">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xs" style={{ color: "#8B5E3C", opacity: 0.6 }}>Price</p>
                  <div className="flex items-center justify-center gap-1">
                    <p className="text-lg font-bold" style={{ color: "#8B5E3C" }}>
                      {currentTick ? formatNumber(currentTick.quote, 5) : "---"}
                    </p>
                    {currentTick && secondLastTick && priceChange !== 0 && (
                      <div className={`flex items-center text-sm font-bold ${priceChange > 0 ? "text-green-600" : "text-red-500"}`}>
                        {priceChange > 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                        <span>{priceChangePercent.toFixed(4)}%</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-8 w-px" style={{ backgroundColor: "#F0E4D7" }} />
                <div className="text-center">
                  <p className="text-xs" style={{ color: "#8B5E3C", opacity: 0.6 }}>Race</p>
                  <p className="text-lg font-bold capitalize" style={{ 
                    color: raceState === "racing" ? "#2E7D32" : 
                           raceState === "revving" ? "#FF6B9D" : 
                           raceState === "finished" ? "#64748B" : "#8B5E3C"
                  }}>
                    {raceState}
                  </p>
                </div>
                <div className="h-8 w-px" style={{ backgroundColor: "#F0E4D7" }} />
                <div className="text-center">
                  <p className="text-xs" style={{ color: "#8B5E3C", opacity: 0.6 }}>Speed</p>
                  <p className="text-lg font-bold" style={{ color: "#8B5E3C" }}>
                    {speed} mph
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mini Map */}
        <div className="absolute bottom-4 left-4 z-30 w-full max-w-sm px-4">
          <MiniMap tickHistory={tickHistory} currentSymbol={currentSymbol} />
        </div>

        {/* Trophy for finished state */}
        {raceState === "finished" && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40">
            <div className="animate-bounce">
              <Trophy className="h-24 w-24" style={{ color: "#FFD700" }} />
            </div>
          </div>
        )}

        {/* Decorative Meadow Between Map and Trade Panel */}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-[calc(100%-32rem)] max-w-2xl h-24 z-20 pointer-events-none flex items-end justify-center overflow-hidden">
          <div className="relative w-full h-full flex items-end justify-center">
            {/* Back Grass Layer */}
            <div className="absolute bottom-1 flex justify-center w-full gap-4 text-3xl opacity-60">
              <span>🌾</span><span>🌿</span><span>🌾</span><span>🍀</span><span>🌾</span><span>🌿</span><span>🌾</span>
            </div>
            
            {/* Middle Flower Layer */}
            <div className="absolute bottom-2 flex justify-center w-full gap-6 text-5xl opacity-90 drop-shadow-md pb-2">
              <span className="transform -rotate-12">🌸</span>
              <span className="transform translate-y-2">🌷</span>
              <span className="transform rotate-6">🌼</span>
              <span className="transform -translate-y-1 -rotate-6">🌺</span>
              <span className="transform rotate-12">🌻</span>
              <span className="transform translate-y-1">🌸</span>
            </div>
            
            {/* Front Grass Layer */}
            <div className="absolute -bottom-1 flex justify-center w-full gap-2 text-4xl opacity-80">
              <span>🌿</span><span>🪴</span><span>🍀</span><span>🌿</span><span>🪴</span><span>🍀</span><span>🌿</span>
            </div>
          </div>
        </div>

        {/* Ghost Trading Panel */}
        <div className="absolute bottom-4 right-4 z-40 w-96">
          <GhostTradingPanel />
        </div>
      </main>
    </div>
  )
}

function MochiMoto() {
  return (
    <AccountProvider>
      <GhostProviderWithAccount>
        <MochiMotoContent />
      </GhostProviderWithAccount>
    </AccountProvider>
  )
}

function GhostProviderWithAccount({ children }: { children: React.ReactNode }) {
  const { addBalance, deductBalance } = useAccount()
  return (
    <GhostProvider onTradeSettle={(profit) => {
      if (profit > 0) {
        addBalance(profit)
      } else if (profit < 0) {
        deductBalance(Math.abs(profit))
      }
    }}>
      {children}
    </GhostProvider>
  )
}

export default MochiMoto
import { useEffect, useCallback, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { getDerivAPI } from "../lib/deriv-api"
import { useTradingStore } from "../stores/tradingStore"
import { SurfProvider, useSurf } from "../contexts/SurfContext"
import { AccountProvider, useAccount } from "../contexts/AccountContext"
import OceanBackground from "../components/surf/OceanBackground"
import WaveFormation from "../components/surf/WaveFormation"
import SurferCharacter from "../components/surf/SurferCharacter"
import PowerUpCollector from "../components/surf/PowerUpCollector"
import ScoreBoard from "../components/surf/ScoreBoard"
import SurfLeaderboard from "../components/surf/SurfLeaderboard"
import AssetSelector from "../components/trading/AssetSelector"
import ErrorBoundary from "../components/ui/ErrorBoundary"
import { Button } from "../components/ui/button"
import { formatCurrency } from "../lib/utils"
import { Wifi, WifiOff, RefreshCw, ArrowLeft, Waves, Play, Square, Volume2, VolumeX } from "lucide-react"
import { calculateVolatility, getCurrentRSI, getCurrentMACD } from "../utils/technicalIndicators"
import { getTickPrices } from "../utils/technicalIndicators"
import { getSoundManager } from "../utils/soundManager"

function SurfTheWavesContent() {
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

  const {
    currentSession,
    surferState,
    currentScore,
    currentCombo,
    powerUps,
    sessions,
    totalWaves,
    bestRide,
    surfPoints,
    startSession,
    endSession,
    updateScore,
    addCombo,
    setSurferState,
    addPowerUp,
    performTrick,
  } = useSurf()

  const { balance: demoBalance } = useAccount()

  const tickUnsubscribeRef = useRef<(() => void) | null>(null)
  const loadingSymbolRef = useRef<string | null>(null)
  const hasInitializedRef = useRef(false)
  const isSubscribingRef = useRef(false)
  const sessionDurationRef = useRef(0)
  const lastPriceRef = useRef(0)
  const lastPowerUpSpawnRef = useRef<{[key: string]: number}>({})
  const isTrickActiveRef = useRef(false)
  const scoreAccumulatorRef = useRef(0)
  const oceanAmbientCleanupRef = useRef<(() => void) | null>(null)
  
  const [scrollOffset, setScrollOffset] = useState(0)
  const [volatility, setVolatility] = useState(0.5)
  const [sessionDuration, setSessionDuration] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(true)

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
        console.warn("[SurfTheWaves] API not ready, waiting...")
        let apiWaited = 0
        while (!api.isReady() && apiWaited < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100))
          apiWaited += 100
        }
        if (!api.isReady()) {
          console.error("[SurfTheWaves] API timed out waiting for readiness")
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
      console.log("[SurfTheWaves] Tick subscription successful for:", symbol)
    } finally {
      isSubscribingRef.current = false
    }
  }, [setCurrentTick])

  // Clean up subscriptions
  const cleanupSubscriptions = useCallback(async () => {
    if (tickUnsubscribeRef.current) {
      try { tickUnsubscribeRef.current() } catch {}
      tickUnsubscribeRef.current = null
    }
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
      
      console.log("[SurfTheWaves] Running clean slate startup...")
      await api.cleanSlateStartup()
      
      clearState()
      setConnectionState({ isConnected: true, isConnecting: false, lastConnected: Date.now() })
      await fetchSymbols()

      loadingSymbolRef.current = currentSymbol

      const history = await api.getTickHistory(currentSymbol, 50)
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
  }, [currentSymbol, setConnectionState, clearState, fetchSymbols, setTickHistory, subscribeToStream])

  useEffect(() => {
    initializeAPI()
  }, [initializeAPI])

  useEffect(() => {
    return () => { 
      if (tickUnsubscribeRef.current) tickUnsubscribeRef.current()
      getDerivAPI().disconnect() 
    }
  }, [])

  // Handle symbol change
  useEffect(() => {
    if (!hasInitializedRef.current) return
    if (!isConnected) return
    
    const handleSymbolChange = async () => {
      const symbolToLoad = currentSymbol
      loadingSymbolRef.current = symbolToLoad
      setIsSymbolLoading(true)
      
      await cleanupSubscriptions()
      
      if (loadingSymbolRef.current !== symbolToLoad) return
      
      const api = getDerivAPI()
      
      try {
        const history = await api.getTickHistory(symbolToLoad, 50)
        if (loadingSymbolRef.current !== symbolToLoad) return
        const ticks = history.prices.map((price, i) => ({
          epoch: history.times[i],
          quote: price,
          symbol: symbolToLoad,
        }))
        setTickHistory(ticks)
        
        await subscribeToStream(symbolToLoad)
      } catch (err) {
        console.error("[SurfTheWaves] Failed to switch symbol:", err)
      } finally {
        if (loadingSymbolRef.current === symbolToLoad) {
          setIsSymbolLoading(false)
        }
      }
    }
    
    handleSymbolChange()
  }, [currentSymbol, isConnected, cleanupSubscriptions, setIsSymbolLoading, setTickHistory, subscribeToStream])

  // Calculate volatility and spawn power-ups (with throttling to prevent infinite loops)
  useEffect(() => {
    if (tickHistory.length < 20 || !currentSession) return

    const prices = getTickPrices(tickHistory)
    const vol = calculateVolatility(prices, 20)
    setVolatility(vol ? Math.min(vol / prices[prices.length - 1], 1) : 0.5)

    const now = Date.now()
    const SPAWN_COOLDOWN = 5000 // 5 seconds between spawns of same type

    // Spawn RSI power-ups (throttled)
    const rsi = getCurrentRSI(prices)
    if (rsi && (rsi < 30 || rsi > 70)) {
      const lastSpawn = lastPowerUpSpawnRef.current['rsi'] || 0
      if (now - lastSpawn > SPAWN_COOLDOWN) {
        const existing = powerUps.find(p => p.type === "rsi" && !p.collected)
        if (!existing && Math.random() < 0.3) {
          addPowerUp({
            type: "rsi",
            position: Math.random() * 0.8 + 0.2,
            points: 50,
          })
          lastPowerUpSpawnRef.current['rsi'] = now
        }
      }
    }

    // Spawn MACD power-ups (throttled)
    const macd = getCurrentMACD(prices)
    if (macd && Math.abs(macd.histogram) > 0.0001) {
      const lastSpawn = lastPowerUpSpawnRef.current['macd'] || 0
      if (now - lastSpawn > SPAWN_COOLDOWN) {
        const existing = powerUps.find(p => p.type === "macd" && !p.collected)
        if (!existing && Math.random() < 0.2) {
          addPowerUp({
            type: "macd",
            position: Math.random() * 0.8 + 0.2,
            points: 100,
          })
          lastPowerUpSpawnRef.current['macd'] = now
        }
      }
    }

    // Spawn volatility power-ups (throttled)
    if (vol && vol > prices[prices.length - 1] * 0.005) {
      const lastSpawn = lastPowerUpSpawnRef.current['volatility'] || 0
      if (now - lastSpawn > SPAWN_COOLDOWN) {
        const existing = powerUps.find(p => p.type === "volatility" && !p.collected)
        if (!existing && Math.random() < 0.25) {
          addPowerUp({
            type: "volatility",
            position: Math.random() * 0.8 + 0.2,
            points: 75,
          })
          lastPowerUpSpawnRef.current['volatility'] = now
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickHistory.length, currentSession])

  // Optimized game loop (batch updates to reduce re-renders)
  useEffect(() => {
    if (!isConnected || !currentSession) return

    let frameCount = 0
    const gameLoop = setInterval(() => {
      setScrollOffset(prev => prev + 2)
      frameCount++

      // Update score accumulator every frame but only push to state every 30 frames (~0.5s)
      if (currentSession.status === "riding") {
        scoreAccumulatorRef.current += 1
        if (frameCount % 30 === 0) {
          updateScore(scoreAccumulatorRef.current)
          scoreAccumulatorRef.current = 0
        }
      }
    }, 1000 / 60) // 60fps

    return () => {
      clearInterval(gameLoop)
      // Flush any remaining score
      if (scoreAccumulatorRef.current > 0) {
        updateScore(scoreAccumulatorRef.current)
        scoreAccumulatorRef.current = 0
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, currentSession?.id])

  // Detect tricks based on price volatility (with cooldown to prevent spam)
  useEffect(() => {
    if (!currentSession || tickHistory.length < 2 || isTrickActiveRef.current) return

    const lastTick = tickHistory[tickHistory.length - 1]
    const prevTick = tickHistory[tickHistory.length - 2]
    const priceChange = Math.abs(lastTick.quote - prevTick.quote)
    const priceChangePercent = (priceChange / prevTick.quote) * 100

    if (priceChangePercent > 0.05) {
      isTrickActiveRef.current = true
      setSurferState("trick")
      const trickPoints = Math.floor(priceChangePercent * 500)
      performTrick(trickPoints)
      addCombo()
      
      // Play trick sound
      const soundMgr = getSoundManager()
      if (soundEnabled) {
        soundMgr.playTrick(Math.min(priceChangePercent / 0.1, 3))
        soundMgr.playCombo(currentCombo + 1)
      }

      setTimeout(() => {
        setSurferState("riding")
        isTrickActiveRef.current = false
      }, 1000)
    }

    lastPriceRef.current = lastTick.quote
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickHistory.length, currentSession?.id])

  // Session timer (separate from game loop to keep it simple)
  useEffect(() => {
    if (!currentSession) return

    const timer = setInterval(() => {
      setSessionDuration(prev => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [currentSession])

  // Sound effects for ocean ambient and whoosh
  useEffect(() => {
    if (!currentSession || !soundEnabled) {
      if (oceanAmbientCleanupRef.current) {
        oceanAmbientCleanupRef.current()
        oceanAmbientCleanupRef.current = null
      }
      return
    }

    const soundMgr = getSoundManager()
    oceanAmbientCleanupRef.current = soundMgr.playOceanAmbient()

    // Add periodic whoosh sounds during riding
    const whooshInterval = setInterval(() => {
      if (currentSession?.status === "riding" && Math.random() < 0.6) {
        soundMgr.playWhoosh()
      }
    }, 2500) // Every 2.5 seconds

    return () => {
      clearInterval(whooshInterval)
      if (oceanAmbientCleanupRef.current) {
        oceanAmbientCleanupRef.current()
        oceanAmbientCleanupRef.current = null
      }
    }
  }, [currentSession, soundEnabled])

  const handleStartSession = () => {
    if (tickHistory.length > 0) {
      const startPrice = tickHistory[tickHistory.length - 1].quote
      startSession(currentSymbol, startPrice)
      setSurferState("riding")
      sessionDurationRef.current = 0
      setSessionDuration(0)
      
      // Play session start sound
      const soundMgr = getSoundManager()
      soundMgr.playSessionStart()
    }
  }

  const handleEndSession = () => {
    if (currentSession && tickHistory.length > 0) {
      const endPrice = tickHistory[tickHistory.length - 1].quote
      endSession(currentSession.id, endPrice, "finished")
      setSurferState("celebrate")
      
      // Play session end sound
      const soundMgr = getSoundManager()
      soundMgr.playSessionEnd(true)
      
      setTimeout(() => setSurferState("idle"), 3000)
    }
  }

  const toggleSound = () => {
    const newSoundEnabled = !soundEnabled
    setSoundEnabled(newSoundEnabled)
    const soundMgr = getSoundManager()
    soundMgr.setEnabled(newSoundEnabled)
  }

  const lastTick = tickHistory?.[tickHistory.length - 1]
  const secondLastTick = tickHistory?.[tickHistory.length - 2]
  const priceChange = lastTick && secondLastTick ? lastTick.quote - secondLastTick.quote : 0

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: "#87CEEB" }}>
      {/* Header */}
      <header className="border-b-2 sticky top-0 z-50 backdrop-blur-sm" style={{ 
        backgroundColor: "rgba(135, 206, 235, 0.9)",
        borderColor: "#0EA5E9"
      }}>
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="outline" size="sm" className="gap-2 rounded-xl" style={{
                  backgroundColor: "#FFFFFF",
                  border: "2px solid #0EA5E9",
                  color: "#0C4A6E"
                }}>
                  <ArrowLeft className="h-4 w-4" />
                  Home
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Waves className="h-6 w-6" style={{ color: "#0EA5E9" }} />
                <h1 className="text-xl font-bold" style={{ color: "#0C4A6E" }}>
                  Surf the Market Waves
                </h1>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {isConnected ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
                <span style={{ color: isConnected ? "#10B981" : "#EF4444" }}>
                  {isConnecting ? "Connecting..." : isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="px-3 py-1 rounded-full text-sm font-medium" style={{
                backgroundColor: "#DBEAFE",
                color: "#0C4A6E",
                border: "2px solid #0EA5E9"
              }}>
                Demo: {formatCurrency(demoBalance)}
              </div>
              <AssetSelector className="w-48" />
              {!currentSession ? (
                <Button
                  onClick={handleStartSession}
                  disabled={!isConnected || tickHistory.length === 0}
                  className="gap-2 rounded-xl"
                  style={{
                    backgroundColor: "#10B981",
                    color: "white",
                  }}
                >
                  <Play className="h-4 w-4" />
                  Start Surfing
                </Button>
              ) : (
                <Button
                  onClick={handleEndSession}
                  className="gap-2 rounded-xl"
                  style={{
                    backgroundColor: "#EF4444",
                    color: "white",
                  }}
                >
                  <Square className="h-4 w-4" />
                  End Session
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={toggleSound}
                className="rounded-xl" 
                style={{
                  backgroundColor: soundEnabled ? "#DBEAFE" : "#F3F4F6",
                  border: "2px solid #0EA5E9",
                  color: "#0C4A6E"
                }}
                title={soundEnabled ? "Mute sounds" : "Enable sounds"}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { clearState(); initializeAPI() }} disabled={isConnecting}
                className="rounded-xl" style={{
                  backgroundColor: "#FFFFFF",
                  border: "2px solid #0EA5E9",
                  color: "#0C4A6E"
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
          backgroundColor: "#FEE2E2",
          borderColor: "#EF4444"
        }}>
          <p className="text-sm text-center" style={{ color: "#991B1B" }}>{error}</p>
        </div>
      )}

      {/* Main Game Area */}
      <main className="relative" style={{ height: "calc(100vh - 140px)" }}>
        {/* Ocean Background - Layer 0 */}
        <ErrorBoundary>
          <OceanBackground volatility={volatility} scrollOffset={scrollOffset} />
        </ErrorBoundary>

        {/* Wave Formation - Layer 10 */}
        <ErrorBoundary>
          <WaveFormation 
            tickHistory={tickHistory}
            scrollOffset={scrollOffset}
            currentPrice={currentTick?.quote || 0}
          />
        </ErrorBoundary>

        {/* Power-Ups - Layer 15 */}
        {currentSession && (
          <ErrorBoundary>
            <PowerUpCollector powerUps={powerUps} scrollOffset={scrollOffset} />
          </ErrorBoundary>
        )}

        {/* Surfer Character - Layer 20 */}
        <ErrorBoundary>
          <SurferCharacter 
            state={surferState}
            tickHistory={tickHistory}
            priceChange={priceChange}
          />
        </ErrorBoundary>

        {/* ScoreBoard - Layer 30 */}
        {currentSession && (
          <ErrorBoundary>
            <ScoreBoard
              score={currentScore}
              combo={currentCombo}
              duration={sessionDuration}
              bestRide={bestRide}
            />
          </ErrorBoundary>
        )}

        {/* Leaderboard - Layer 30 */}
        <ErrorBoundary>
          <SurfLeaderboard
            sessions={sessions}
            totalWaves={totalWaves}
            surfPoints={surfPoints}
          />
        </ErrorBoundary>
      </main>
    </div>
  )
}

function SurfTheWaves() {
  return (
    <AccountProvider>
      <SurfProvider>
        <SurfTheWavesContent />
      </SurfProvider>
    </AccountProvider>
  )
}

export default SurfTheWaves

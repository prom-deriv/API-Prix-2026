import { useEffect, useCallback, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { getDerivAPI } from "../lib/deriv-api"
import { useTradingStore } from "../stores/tradingStore"
import { SurfProvider, useSurf } from "../contexts/SurfContext"
import { useAccount } from "../contexts/AccountContext"
import OceanBackground from "../components/surf/OceanBackground"
import WaveFormation from "../components/surf/WaveFormation"
import SurferCharacter from "../components/surf/SurferCharacter"
import PowerUpCollector from "../components/surf/PowerUpCollector"
import ScoreBoard from "../components/surf/ScoreBoard"
import SurfLeaderboard from "../components/surf/SurfLeaderboard"
import TradingSetupModal from "../components/surf/TradingSetupModal"
import type { TradingSetup } from "../components/surf/TradingSetupModal"
import AssetSelector from "../components/trading/AssetSelector"
import ErrorBoundary from "../components/ui/ErrorBoundary"
import { Button } from "../components/ui/button"
import { formatCurrency } from "../lib/utils"
import { Wifi, WifiOff, RefreshCw, ArrowLeft, Waves, Play, Square, Volume2, VolumeX, TrendingUp, TrendingDown } from "lucide-react"
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

  const { balance, addBalance, deductBalance, accountType } = useAccount()

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
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [activeSetup, setActiveSetup] = useState<TradingSetup | null>(null)

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
      
      // Preserve current symbol before clearing state
      const savedSymbol = currentSymbol
      clearState()
      setConnectionState({ isConnected: true, isConnecting: false, lastConnected: Date.now() })
      
      // Restore the symbol after clearState (which sets it to R_100)
      if (savedSymbol && savedSymbol !== "R_100") {
        useTradingStore.getState().setCurrentSymbol(savedSymbol)
      }
      
      await fetchSymbols()

      // Use the restored symbol
      const symbolToLoad = useTradingStore.getState().currentSymbol
      loadingSymbolRef.current = symbolToLoad

      const history = await api.getTickHistory(symbolToLoad, 50)
      const ticks = history.prices.map((price, i) => ({
        epoch: history.times[i],
        quote: price,
        symbol: symbolToLoad,
      }))
      setTickHistory(ticks)
      if (ticks.length > 0) {
        setCurrentTick(ticks[ticks.length - 1])
      }
      
      await subscribeToStream(symbolToLoad)
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
      
      // If we're already loading this symbol, don't restart the process
      if (loadingSymbolRef.current === symbolToLoad && tickHistory.length > 0 && tickHistory[0].symbol === symbolToLoad) {
        return
      }
      
      loadingSymbolRef.current = symbolToLoad
      setIsSymbolLoading(true)
      
      // Clear tick history immediately to prevent ghost data
      setTickHistory([])
      
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
        if (ticks.length > 0) {
          setCurrentTick(ticks[ticks.length - 1])
        }
        
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSymbol, isConnected])

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
      setSessionDuration(prev => {
        const newDuration = prev + 1
        
        // Check if duration has reached the setup duration
        if (activeSetup && newDuration >= activeSetup.duration) {
          handleEndSession()
        }
        
        return newDuration
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [currentSession, activeSetup])

  // Background ocean ambient sound (continuous)
  useEffect(() => {
    if (!soundEnabled) {
      if (oceanAmbientCleanupRef.current) {
        oceanAmbientCleanupRef.current()
        oceanAmbientCleanupRef.current = null
      }
      return
    }

    const soundMgr = getSoundManager()

    const startAmbient = () => {
      if (!oceanAmbientCleanupRef.current) {
        const cleanup = soundMgr.playOceanAmbient()
        if (cleanup) {
          oceanAmbientCleanupRef.current = cleanup
          console.log("[SurfTheWaves] Ocean ambient started")
        }
      }
    }

    // Attempt to start immediately
    startAmbient()

    // Browsers block autoplay without interaction. 
    // Listen to user interaction events to start audio context.
    const handleInteraction = () => {
      startAmbient()
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
    }

    window.addEventListener('click', handleInteraction)
    window.addEventListener('keydown', handleInteraction)

    return () => {
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
      if (oceanAmbientCleanupRef.current) {
        oceanAmbientCleanupRef.current()
        oceanAmbientCleanupRef.current = null
      }
    }
  }, [soundEnabled])

  // Sound effects for whoosh, and wave crashes during session
  useEffect(() => {
    if (!currentSession || !soundEnabled) {
      return
    }

    const soundMgr = getSoundManager()

    // Add periodic whoosh sounds during riding
    const whooshInterval = setInterval(() => {
      if (currentSession?.status === "riding" && Math.random() < 0.6) {
        soundMgr.playWhoosh()
      }
    }, 2500) // Every 2.5 seconds

    // Add periodic wave crash sounds
    const waveCrashInterval = setInterval(() => {
      if (currentSession?.status === "riding" && Math.random() < 0.5) {
        soundMgr.playWaveCrash()
      }
    }, 4000) // Every 4 seconds

    return () => {
      clearInterval(whooshInterval)
      clearInterval(waveCrashInterval)
    }
  }, [currentSession, soundEnabled])

  const handleStartSetup = () => {
    if (tickHistory.length > 0) {
      setShowSetupModal(true)
    }
  }

  const handleConfirmSetup = async (setup: TradingSetup) => {
    setActiveSetup(setup)
    
    if (tickHistory.length > 0) {
      const startPrice = tickHistory[tickHistory.length - 1].quote
      
      try {
        if (accountType === "real") {
          const api = getDerivAPI()
          const isReady = await api.waitUntilReady(5000)
          if (!isReady) throw new Error("API not ready")

          const params = {
            symbol: currentSymbol,
            amount: setup.stake,
            basis: "stake" as const,
            contract_type: setup.prediction === "UP" ? "CALL" as const : "PUT" as const,
            duration: setup.duration,
            duration_unit: "s" as const,
            currency: "USD",
          }
          
          const proposal = await api.getProposal(params)
          const buyResult = await api.buyContract(proposal.id, proposal.ask_price)
          
          if (buyResult?.contract_id) {
            startSession(currentSymbol, startPrice, setup.stake, {
              contractId: buyResult.contract_id.toString(),
              prediction: setup.prediction,
              targetDuration: setup.duration
            })
            
            api.subscribeProposalOpenContract(buyResult.contract_id, (contract) => {
              if (contract.is_sold === 1 || contract.status === "sold") {
                const profit = contract.profit || 0
                endSession(
                  `surf-${buyResult.contract_id}`,
                  contract.sell_spot || contract.current_spot || 0,
                  "finished",
                  profit
                )
                setSurferState(profit > 0 ? "celebrate" : "wipeout")
                const soundMgr = getSoundManager()
                soundMgr.playSessionEnd(profit > 0)
                setTimeout(() => {
                  setSurferState("idle")
                  setActiveSetup(null)
                }, 3000)
              }
            })
          }
        } else {
          // Demo local simulation
          deductBalance(setup.stake)
          startSession(currentSymbol, startPrice, setup.stake, {
            prediction: setup.prediction,
            targetDuration: setup.duration
          })
        }
        
        setSurferState("riding")
        sessionDurationRef.current = 0
        setSessionDuration(0)
        
        // Play session start sound
        const soundMgr = getSoundManager()
        soundMgr.playSessionStart()
      } catch (err) {
        console.error("Failed to execute real surf trade", err)
      }
    }
  }

  const handleEndSession = useCallback(() => {
    if (currentSession && tickHistory.length > 0 && activeSetup) {
      // Do not manually end real account trades, let the contract update handle it
      if (accountType === "real" && currentSession.contractId) {
        return
      }

      const endPrice = tickHistory[tickHistory.length - 1].quote
      const startPrice = currentSession.startPrice
      
      let isWin = false
      if (activeSetup.prediction === "UP") {
        isWin = endPrice > startPrice
      } else {
        isWin = endPrice < startPrice
      }

      const profit = isWin ? activeSetup.stake * 0.85 : -activeSetup.stake

      if (isWin) {
        addBalance(activeSetup.stake * 1.85)
      }

      endSession(currentSession.id, endPrice, "finished", profit)
      setSurferState(isWin ? "celebrate" : "wipeout")
      
      // Play session end sound
      const soundMgr = getSoundManager()
      soundMgr.playSessionEnd(isWin)
      
      setTimeout(() => {
        setSurferState("idle")
        setActiveSetup(null)
      }, 3000)
    }
  }, [currentSession, tickHistory, activeSetup, addBalance, endSession, setSurferState, accountType])

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
                {accountType === "demo" ? "Demo" : "Real"}: {formatCurrency(balance)}
              </div>
              <AssetSelector className="w-48" disabled={!!currentSession} />
              {!currentSession ? (
                <Button
                  onClick={handleStartSetup}
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
            scrollOffset={scrollOffset}
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
              activeSetup={activeSetup}
              currentPrice={currentTick?.quote || 0}
              startPrice={currentSession.startPrice}
            />
          </ErrorBoundary>
        )}

        <TradingSetupModal
          isOpen={showSetupModal}
          onClose={() => setShowSetupModal(false)}
          onConfirm={handleConfirmSetup}
          currentBalance={balance}
          currentPrice={currentTick?.quote || 0}
          symbol={currentSymbol}
        />

        {/* Leaderboard - Layer 30 */}
        <ErrorBoundary>
          <SurfLeaderboard
            sessions={sessions}
            totalWaves={totalWaves}
            surfPoints={surfPoints}
          />
        </ErrorBoundary>

        {/* Live Market Price - Bottom Middle */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-[#4A6B82] border-2 border-[#1E293B] px-6 py-2 rounded-[20px] shadow-2xl flex flex-col items-start gap-1 min-w-[180px]">
            <span className="font-bold text-white text-2xl tabular-nums tracking-wide">
              {currentTick?.quote ? currentTick.quote.toFixed(5) : (lastTick?.quote ? lastTick.quote.toFixed(5) : "Loading...")}
            </span>
            {(currentTick?.quote || lastTick?.quote) && secondLastTick?.quote && (
              <div className={`flex items-center gap-1 text-base font-bold ${priceChange >= 0 ? "text-[#F87171]" : "text-[#4ADE80]"}`}>
                {priceChange >= 0 ? (
                  <TrendingDown className="w-5 h-5" strokeWidth={3} />
                ) : (
                  <TrendingUp className="w-5 h-5" strokeWidth={3} />
                )}
                <span>
                  {priceChange > 0 ? "+" : ""}{((priceChange / secondLastTick.quote) * 100).toFixed(2)}%
                </span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function SurfTheWaves() {
  return (
    <SurfProvider>
      <SurfTheWavesContent />
    </SurfProvider>
  )
}

export default SurfTheWaves

import { useEffect, useState } from "react"
import { useTradingStore } from "../../stores/tradingStore"
import { useAIStore, generateTradeSuggestion, checkRiskConditions } from "../../stores/aiStore"
import {
  getCurrentRSI,
  getCurrentMACD,
  detectTrend,
  calculateVolatility,
  findSupportResistance,
  getClosePrices,
  getTickPrices,
} from "../../utils/technicalIndicators"
import { detectPatterns } from "../../utils/patternDetection"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Brain, TrendingUp, TrendingDown, Activity, AlertTriangle, Sparkles, ChevronDown, ChevronUp } from "lucide-react"

/**
 * AI-Powered Trading Assistant
 * Provides real-time technical analysis, pattern detection, and trade suggestions
 */

export function AIAssistant() {
  const [isExpanded, setIsExpanded] = useState(true)
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0)

  // Trading Store
  const { ohlcHistory, tickHistory, currentTick, currentSymbol, chartStyle } = useTradingStore()

  // AI Store
  const {
    currentIndicators,
    detectedPattern,
    supportResistanceLevels,
    tradeSuggestions,
    riskWarnings,
    isAnalyzing,
    setIndicators,
    setDetectedPattern,
    setSupportResistanceLevels,
    addTradeSuggestion,
    addRiskWarning,
    setIsAnalyzing,
  } = useAIStore()

  // Perform AI analysis
  useEffect(() => {
    // Check if we have enough data - support both OHLC and tick data
    const hasEnoughOHLC = ohlcHistory.length >= 50
    const hasEnoughTicks = tickHistory.length >= 100
    
    if (!hasEnoughOHLC && !hasEnoughTicks) {
      return
    }

    // Throttle analysis to every 5 seconds
    const now = Date.now()
    if (now - lastUpdateTime < 5000) {
      return
    }

    const analyzeMarket = async () => {
      try {
        setIsAnalyzing(true)
        setLastUpdateTime(now)

        // Use OHLC data if available, otherwise use tick data
        const prices = hasEnoughOHLC 
          ? getClosePrices(ohlcHistory)
          : getTickPrices(tickHistory)

        // Calculate Technical Indicators
        const rsi = getCurrentRSI(prices, 14)
        const macd = getCurrentMACD(prices, 12, 26, 9)
        const trend = detectTrend(prices, 10, 50)
        const volatility = calculateVolatility(prices, 20)

        const indicators = {
          rsi,
          macd,
          trend,
          volatility,
        }

        setIndicators(indicators)

        // Detect Patterns
        const pattern = detectPatterns(ohlcHistory)
        setDetectedPattern(pattern)

        // Find Support & Resistance
        const levels = findSupportResistance(ohlcHistory, 50)
        setSupportResistanceLevels(levels)

        // Generate Trade Suggestion
        if (currentTick) {
          const suggestion = generateTradeSuggestion(
            currentSymbol,
            currentTick.quote,
            indicators,
            pattern,
            levels
          )

          if (suggestion) {
            // Only add if we don't have a recent suggestion
            const recentSuggestion = tradeSuggestions[0]
            if (
              !recentSuggestion ||
              now - recentSuggestion.timestamp > 60000 // 1 minute
            ) {
              addTradeSuggestion(suggestion)
            }
          }

          // Check Risk Conditions
          const warnings = checkRiskConditions(
            volatility,
            0, // We'll track this from actual trades later
            currentTick.quote,
            10000, // Placeholder balance
            100, // Placeholder trade amount
            suggestion?.confidence || null
          )

          warnings.forEach((warning) => addRiskWarning(warning))
        }
      } catch (error) {
        console.error('[AIAssistant] Analysis error:', error)
      } finally {
        setIsAnalyzing(false)
      }
    }

    analyzeMarket()
  }, [
    ohlcHistory,
    tickHistory,
    currentTick,
    currentSymbol,
    chartStyle,
    lastUpdateTime,
    setIndicators,
    setDetectedPattern,
    setSupportResistanceLevels,
    addTradeSuggestion,
    addRiskWarning,
    setIsAnalyzing,
    tradeSuggestions,
  ])

  // Show message if not enough data
  const hasEnoughOHLC = ohlcHistory.length >= 50
  const hasEnoughTicks = tickHistory.length >= 100
  
  if (!hasEnoughOHLC && !hasEnoughTicks) {
    return (
      <Card className="bg-card border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Brain className="w-4 h-4 text-primary" />
            AI Trading Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Gathering data... Need at least 50 candles (OHLC/Candlestick) or 100 ticks (Area/Line) for AI analysis.
          </p>
        </CardContent>
      </Card>
    )
  }

  const latestSuggestion = tradeSuggestions[0]

  return (
    <Card className="bg-card border-primary/20">
      <CardHeader
        className="cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            AI Trading Assistant
            {isAnalyzing && (
              <Sparkles className="w-3 h-3 text-yellow-500 animate-pulse" />
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </CardTitle>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Technical Indicators */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Technical Indicators
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* RSI */}
              <div className="bg-muted/30 border border-border rounded p-2">
                <div className="text-muted-foreground text-[10px]">RSI (14)</div>
                <div className="font-bold text-lg">
                  {currentIndicators.rsi !== null ? (
                    <span
                      className={
                        currentIndicators.rsi > 70
                          ? "text-loss"
                          : currentIndicators.rsi < 30
                          ? "text-profit"
                          : "text-foreground"
                      }
                    >
                      {currentIndicators.rsi.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </div>
                {currentIndicators.rsi !== null && (
                  <div className="text-[10px] text-muted-foreground">
                    {currentIndicators.rsi > 70
                      ? "Overbought"
                      : currentIndicators.rsi < 30
                      ? "Oversold"
                      : "Neutral"}
                  </div>
                )}
              </div>

              {/* MACD */}
              <div className="bg-muted/30 border border-border rounded p-2">
                <div className="text-muted-foreground text-[10px]">MACD</div>
                <div className="font-bold text-lg">
                  {currentIndicators.macd !== null ? (
                    <span
                      className={
                        currentIndicators.macd.histogram > 0
                          ? "text-profit"
                          : "text-loss"
                      }
                    >
                      {currentIndicators.macd.histogram > 0 ? "+" : ""}
                      {currentIndicators.macd.histogram.toFixed(4)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </div>
                {currentIndicators.macd !== null && (
                  <div className="text-[10px] text-muted-foreground">
                    {currentIndicators.macd.histogram > 0 ? "Bullish" : "Bearish"}
                  </div>
                )}
              </div>

              {/* Trend */}
              <div className="bg-muted/30 border border-border rounded p-2">
                <div className="text-muted-foreground text-[10px]">Trend</div>
                <div className="font-bold text-sm flex items-center gap-1">
                  {currentIndicators.trend === "uptrend" ? (
                    <>
                      <TrendingUp className="w-3 h-3 text-profit" />
                      <span className="text-profit">Uptrend</span>
                    </>
                  ) : currentIndicators.trend === "downtrend" ? (
                    <>
                      <TrendingDown className="w-3 h-3 text-loss" />
                      <span className="text-loss">Downtrend</span>
                    </>
                  ) : currentIndicators.trend === "sideways" ? (
                    <span className="text-foreground">Sideways</span>
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </div>
              </div>

              {/* Volatility */}
              <div className="bg-muted/30 border border-border rounded p-2">
                <div className="text-muted-foreground text-[10px]">Volatility</div>
                <div className="font-bold text-lg">
                  {currentIndicators.volatility !== null ? (
                    <span className="text-foreground">
                      {currentIndicators.volatility.toFixed(4)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">--</span>
                  )}
                </div>
                {currentIndicators.volatility !== null && currentTick && (
                  <div className="text-[10px] text-muted-foreground">
                    {((currentIndicators.volatility / currentTick.quote) * 100).toFixed(2)}% of price
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Detected Pattern */}
          {detectedPattern && (
            <div className="bg-muted/30 border border-border rounded p-3 space-y-1">
              <h4 className="text-xs font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-primary" />
                Pattern Detected
              </h4>
              <div className="text-xs">
                <div className="font-medium text-foreground">{detectedPattern.type.replace(/_/g, " ").toUpperCase()}</div>
                <div className="text-muted-foreground text-[10px]">{detectedPattern.description}</div>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded ${
                      detectedPattern.signal === "bullish"
                        ? "bg-profit/20 text-profit border border-profit/30"
                        : "bg-loss/20 text-loss border border-loss/30"
                    }`}
                  >
                    {detectedPattern.signal.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Confidence: {detectedPattern.confidence}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Trade Suggestion */}
          {latestSuggestion && (
            <div
              className={`rounded p-3 space-y-2 border ${
                latestSuggestion.direction === "CALL"
                  ? "bg-profit/10 border-profit/30"
                  : "bg-loss/10 border-loss/30"
              }`}
            >
              <h4 className="text-xs font-semibold flex items-center justify-between">
                <span className="text-foreground">AI Trade Suggestion</span>
                <span className="text-[10px] font-normal text-muted-foreground">
                  {new Date(latestSuggestion.timestamp).toLocaleTimeString()}
                </span>
              </h4>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">Direction:</span>
                  <span
                    className={`font-bold ${
                      latestSuggestion.direction === "CALL" ? "text-profit" : "text-loss"
                    }`}
                  >
                    {latestSuggestion.direction}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">Confidence:</span>
                  <span className="font-bold text-foreground">{latestSuggestion.confidence}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">Entry:</span>
                  <span className="font-mono text-foreground">{latestSuggestion.entry_price.toFixed(4)}</span>
                </div>
                {latestSuggestion.stop_loss && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Stop Loss:</span>
                    <span className="font-mono text-foreground">{latestSuggestion.stop_loss.toFixed(4)}</span>
                  </div>
                )}
                {latestSuggestion.take_profit && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Take Profit:</span>
                    <span className="font-mono text-foreground">{latestSuggestion.take_profit.toFixed(4)}</span>
                  </div>
                )}
              </div>
              <div className="pt-2 border-t border-border">
                <div className="text-[10px] text-muted-foreground">Reasoning:</div>
                <ul className="text-[10px] space-y-0.5 mt-1 text-muted-foreground">
                  {latestSuggestion.reasoning.map((reason, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span>•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Risk Warnings */}
          {riskWarnings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold flex items-center gap-1 text-orange-500">
                <AlertTriangle className="w-3 h-3" />
                Risk Warnings
              </h4>
              {riskWarnings.slice(0, 3).map((warning) => (
                <div
                  key={warning.id}
                  className={`text-xs p-2 rounded border ${
                    warning.severity === "high"
                      ? "bg-loss/10 border-loss/30 text-foreground"
                      : warning.severity === "medium"
                      ? "bg-orange-500/10 border-orange-500/30 text-foreground"
                      : "bg-yellow-500/10 border-yellow-500/30 text-foreground"
                  }`}
                >
                  {warning.message}
                </div>
              ))}
            </div>
          )}

          {/* Support & Resistance Levels */}
          {supportResistanceLevels.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold">Support & Resistance</h4>
              <div className="space-y-1">
                {supportResistanceLevels.slice(0, 3).map((level, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs bg-muted/30 border border-border rounded p-2"
                  >
                    <span
                      className={`font-medium ${
                        level.type === "resistance" ? "text-loss" : "text-profit"
                      }`}
                    >
                      {level.type === "resistance" ? "Resistance" : "Support"}
                    </span>
                    <span className="font-mono text-foreground">{level.price.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="pt-2 border-t border-border">
            <p className="text-[9px] text-muted-foreground italic">
              ⚠️ AI suggestions are for informational purposes only. Always conduct your own analysis and manage risk appropriately.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

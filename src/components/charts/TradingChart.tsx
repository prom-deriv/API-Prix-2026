import React, { useEffect, useRef, memo } from "react"
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
} from "lightweight-charts"
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  AreaData,
  Time,
} from "lightweight-charts"
import { useTradingStore } from "../../stores/tradingStore"
import { useTheme } from "../../contexts/ThemeContext"
import { cn } from "../../lib/utils"

interface TradingChartProps {
  className?: string
}

const TradingChart: React.FC<TradingChartProps> = memo(({ className }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | ISeriesApi<"Area"> | null>(null)
  const barrierHighLineRef = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]> | null>(null)
  const barrierLowLineRef = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]> | null>(null)
  const { theme } = useTheme()
  const {
    tickHistory,
    ohlcHistory,
    barrierHigh,
    barrierLow,
    isSymbolLoading,
    chartStyle,
  } = useTradingStore()

  // Get theme-aware colors
  const getChartColors = () => {
    if (theme === 'light') {
      return {
        textColor: "hsl(222.2, 84%, 4.9%)",
        gridColor: "hsl(214.3, 31.8%, 91.4%)",
        borderColor: "hsl(214.3, 31.8%, 91.4%)",
      }
    }
    return {
      textColor: "hsl(210, 40%, 98%)",
      gridColor: "hsl(217.2, 32.6%, 17.5%)",
      borderColor: "hsl(217.2, 32.6%, 17.5%)",
    }
  }

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    const colors = getChartColors()
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: colors.textColor,
      },
      grid: {
        vertLines: { color: colors.gridColor },
        horzLines: { color: colors.gridColor },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: colors.borderColor,
      },
      timeScale: {
        borderColor: colors.borderColor,
        timeVisible: true,
        secondsVisible: true,
      },
    })

    chartRef.current = chart

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        })
      }
    }

    window.addEventListener("resize", handleResize)
    handleResize()

    return () => {
      window.removeEventListener("resize", handleResize)
      chart.remove()
    }
  }, [])

  // Update chart colors when theme changes
  useEffect(() => {
    if (!chartRef.current) return
    
    const colors = getChartColors()
    chartRef.current.applyOptions({
      layout: {
        background: { color: "transparent" },
        textColor: colors.textColor,
      },
      grid: {
        vertLines: { color: colors.gridColor },
        horzLines: { color: colors.gridColor },
      },
      rightPriceScale: {
        borderColor: colors.borderColor,
      },
      timeScale: {
        borderColor: colors.borderColor,
      },
    })
  }, [theme])

  // Update series based on chart style
  useEffect(() => {
    if (!chartRef.current) return

    // ✅ FORCE RESET: Clear all data immediately when style changes
    // This prevents stale data from being displayed during subscription handshake
    if (seriesRef.current) {
      try {
        seriesRef.current.setData([])
      } catch {}
    }

    // Remove existing series if any
    if (seriesRef.current && chartRef.current) {
      try {
        chartRef.current.removeSeries(seriesRef.current)
      } catch (error) {
        // This is expected during rapid style switching - ignore silently
      }
      seriesRef.current = null
    }

    // Add new series based on chart style
    let newSeries: ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | ISeriesApi<"Area">

    switch (chartStyle) {
      case 'area':
        newSeries = chartRef.current.addSeries(AreaSeries, {
          lineColor: "hsl(142.1, 70.6%, 45.3%)",
          topColor: "hsla(142.1, 70.6%, 45.3%, 0.4)",
          bottomColor: "hsla(142.1, 70.6%, 45.3%, 0.0)",
          lineWidth: 2,
        })
        break
      case 'line':
        newSeries = chartRef.current.addSeries(LineSeries, {
          color: "hsl(142.1, 70.6%, 45.3%)",
          lineWidth: 2,
        })
        break
      case 'ohlc':
        newSeries = chartRef.current.addSeries(CandlestickSeries, {
          upColor: "hsl(142.1, 70.6%, 45.3%)",
          downColor: "hsl(0, 72.2%, 50.6%)",
          borderUpColor: "hsl(142.1, 70.6%, 45.3%)",
          borderDownColor: "hsl(0, 72.2%, 50.6%)",
          wickUpColor: "hsl(142.1, 70.6%, 45.3%)",
          wickDownColor: "hsl(0, 72.2%, 50.6%)",
          // OHLC style - thin candles
          borderVisible: true,
          wickVisible: true,
        })
        break
      case 'candlestick':
      default:
        newSeries = chartRef.current.addSeries(CandlestickSeries, {
          upColor: "hsl(142.1, 70.6%, 45.3%)",
          downColor: "hsl(0, 72.2%, 50.6%)",
          borderUpColor: "hsl(142.1, 70.6%, 45.3%)",
          borderDownColor: "hsl(0, 72.2%, 50.6%)",
          wickUpColor: "hsl(142.1, 70.6%, 45.3%)",
          wickDownColor: "hsl(0, 72.2%, 50.6%)",
        })
        break
    }

    seriesRef.current = newSeries

  }, [chartStyle])

  // Update chart data based on chart style
  useEffect(() => {
    if (!seriesRef.current) return

    // If symbol is loading or empty array passed, do nothing and let it shimmer
    if (isSymbolLoading) return

    if (chartStyle === 'area' || chartStyle === 'line') {
      // Use tick data for area/line charts
      if (tickHistory.length === 0) return

      const lineData: (LineData<Time> | AreaData<Time> | null)[] = tickHistory.map((tick) => {
        // Add strict null checks
        if (!tick || typeof tick.epoch === 'undefined' || typeof tick.quote === 'undefined') {
          return null
        }
        return {
          time: tick.epoch as Time,
          value: Number(tick.quote),
        }
      })

      // Filter out null entries
      const validLineData = lineData.filter((item): item is LineData<Time> | AreaData<Time> => item !== null)

      if (validLineData.length === 0) return

      // Sort by time to ensure strictly ascending order
      validLineData.sort((a, b) => (a.time as number) - (b.time as number))

      // Remove duplicate time entries
      const uniqueData = validLineData.filter((item, index) => {
        if (index === 0) return true
        return item.time !== validLineData[index - 1].time
      })

      try {
        if (chartStyle === 'area') {
          (seriesRef.current as ISeriesApi<"Area">).setData(uniqueData as AreaData<Time>[])
        } else {
          (seriesRef.current as ISeriesApi<"Line">).setData(uniqueData as LineData<Time>[])
        }
      } catch (error) {
        console.warn("[TradingChart] Failed to set tick data, resetting:", error)
        try { seriesRef.current.setData([]) } catch { /* ignore */ }
      }
    } else {
      // Use real OHLC data for both 'ohlc' and 'candlestick' chart styles
      if (ohlcHistory.length === 0) return

      const candleData: (CandlestickData<Time> | null)[] = ohlcHistory.map((ohlc) => {
        // Add strict null checks
        if (!ohlc || typeof ohlc.epoch === 'undefined' ||
          typeof ohlc.open === 'undefined' || typeof ohlc.high === 'undefined' ||
          typeof ohlc.low === 'undefined' || typeof ohlc.close === 'undefined') {
          return null
        }
        return {
          time: ohlc.epoch as Time,
          open: Number(ohlc.open),
          high: Number(ohlc.high),
          low: Number(ohlc.low),
          close: Number(ohlc.close),
        }
      })

      // Filter out null entries
      const validCandleData = candleData.filter((item): item is CandlestickData<Time> => item !== null)

      if (validCandleData.length === 0) return

      // Sort by time to ensure strictly ascending order
      validCandleData.sort((a, b) => (a.time as number) - (b.time as number))

      // Remove duplicate time entries
      const filteredCandleData = validCandleData.filter((candle, index) => {
        if (index === 0) return true
        return candle.time !== validCandleData[index - 1].time
      })

      try {
        ; (seriesRef.current as ISeriesApi<"Candlestick">).setData(filteredCandleData)
      } catch (error) {
        console.warn("[TradingChart] Failed to set OHLC data, resetting:", error)
        try { seriesRef.current.setData([]) } catch { /* ignore */ }
      }
    }

    if (chartRef.current) {
      chartRef.current.timeScale().scrollToRealTime()
    }
  }, [tickHistory, ohlcHistory, chartStyle])

  // Barrier price lines — uses createPriceLine for full-width horizontal lines
  useEffect(() => {
    if (!seriesRef.current) return

    // Remove existing barrier lines if any
    if (barrierHighLineRef.current) {
      try {
        seriesRef.current.removePriceLine(barrierHighLineRef.current)
      } catch {
        // Line may already be removed if series was reset
      }
      barrierHighLineRef.current = null
    }
    if (barrierLowLineRef.current) {
      try {
        seriesRef.current.removePriceLine(barrierLowLineRef.current)
      } catch {
        // Line may already be removed if series was reset
      }
      barrierLowLineRef.current = null
    }

    // If no data, don't draw
    // 'ohlc' and 'candlestick' both use OHLC data, 'area' and 'line' use tick data
    const hasData = chartStyle === 'area' || chartStyle === 'line'
      ? tickHistory.length > 0
      : ohlcHistory.length > 0

    if (!hasData) return

    // Create price lines for Higher and Lower barriers
    if (barrierHigh !== null) {
      barrierHighLineRef.current = seriesRef.current.createPriceLine({
        price: barrierHigh,
        color: "hsl(47.9, 95.8%, 53.1%)",
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "Higher Barrier",
      })
    }
    if (barrierLow !== null) {
      barrierLowLineRef.current = seriesRef.current.createPriceLine({
        price: barrierLow,
        color: "hsl(47.9, 95.8%, 53.1%)",
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "Lower Barrier",
      })
    }
  }, [barrierHigh, barrierLow, tickHistory, ohlcHistory, chartStyle])

  return (
    <div className={cn("w-full h-full min-h-[300px] relative", className)}>
      <div
        ref={chartContainerRef}
        className="w-full h-full"
      />
      {/* Loading shimmer overlay */}
      {isSymbolLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 border-4 border-muted rounded-full"></div>
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">Loading chart data...</p>
          </div>
        </div>
      )}
    </div>
  )
})

TradingChart.displayName = "TradingChart"

export default TradingChart
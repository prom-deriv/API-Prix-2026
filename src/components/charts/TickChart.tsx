import React, { useEffect, useRef, memo } from "react"
import { createChart, CandlestickSeries } from "lightweight-charts"
import type { IChartApi, ISeriesApi, CandlestickData, Time, CreatePriceLineOptions } from "lightweight-charts"
import { useTradingStore } from "../../stores/tradingStore"
import { cn } from "../../lib/utils"

interface TickChartProps {
  className?: string
}

const TickChart: React.FC<TickChartProps> = memo(({ className }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const barrierLineRef = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]> | null>(null)
  const { tickHistory, currentSymbol, barrier, isSymbolLoading } = useTradingStore()

  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "hsl(210, 40%, 98%)",
      },
      grid: {
        vertLines: { color: "hsl(217.2, 32.6%, 17.5%)" },
        horzLines: { color: "hsl(217.2, 32.6%, 17.5%)" },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: "hsl(217.2, 32.6%, 17.5%)",
      },
      timeScale: {
        borderColor: "hsl(217.2, 32.6%, 17.5%)",
        timeVisible: true,
        secondsVisible: true,
      },
    })

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "hsl(142.1, 70.6%, 45.3%)",
      downColor: "hsl(0, 72.2%, 50.6%)",
      borderUpColor: "hsl(142.1, 70.6%, 45.3%)",
      borderDownColor: "hsl(0, 72.2%, 50.6%)",
      wickUpColor: "hsl(142.1, 70.6%, 45.3%)",
      wickDownColor: "hsl(0, 72.2%, 50.6%)",
    })

    chartRef.current = chart
    seriesRef.current = candlestickSeries

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

  // Update candlestick data from tick history
  useEffect(() => {
    if (!seriesRef.current || tickHistory.length === 0) return

    const candleData: CandlestickData<Time>[] = []
    const groupSize = 5

    for (let i = 0; i < tickHistory.length; i += groupSize) {
      const group = tickHistory.slice(i, i + groupSize)
      if (group.length === 0) continue

      const open = group[0].quote
      const close = group[group.length - 1].quote
      const high = Math.max(...group.map((t) => t.quote))
      const low = Math.min(...group.map((t) => t.quote))
      const time = Math.floor(group[0].epoch / groupSize) * groupSize as Time

      candleData.push({ time, open, high, low, close })
    }

    // Sort by time to ensure strictly ascending order (required by Lightweight Charts)
    candleData.sort((a, b) => (a.time as number) - (b.time as number))
    
    // Remove duplicate time entries (defensive measure)
    const uniqueCandleData = candleData.filter((candle, index) => {
      if (index === 0) return true
      return candle.time !== candleData[index - 1].time
    })

    seriesRef.current.setData(uniqueCandleData)

    if (chartRef.current && uniqueCandleData.length > 0) {
      chartRef.current.timeScale().scrollToRealTime()
    }
  }, [tickHistory])

  // Clear chart data and reset scale when symbol changes
  useEffect(() => {
    if (seriesRef.current) {
      seriesRef.current.setData([])
    }
    // Reset chart time scale to auto-fit new data
    if (chartRef.current) {
      chartRef.current.timeScale().resetTimeScale()
      chartRef.current.timeScale().scrollToRealTime()
    }
  }, [currentSymbol])

  // Barrier price line — uses createPriceLine for a full-width horizontal line
  useEffect(() => {
    if (!seriesRef.current) return

    // Remove existing barrier line if any
    if (barrierLineRef.current) {
      try {
        seriesRef.current.removePriceLine(barrierLineRef.current)
      } catch {
        // Line may already be removed if series was reset
      }
      barrierLineRef.current = null
    }

    // If no barrier or no data, don't draw
    if (barrier === null || tickHistory.length === 0) return

    // Create a price line at the barrier level
    const priceLineOptions: CreatePriceLineOptions = {
      price: barrier,
      color: "hsl(47.9, 95.8%, 53.1%)", // Yellow/gold color
      lineWidth: 2,
      lineStyle: 2, // Dashed
      axisLabelVisible: true,
      title: "Barrier",
    }

    barrierLineRef.current = seriesRef.current.createPriceLine(priceLineOptions)
  }, [barrier, tickHistory])

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

TickChart.displayName = "TickChart"

export default TickChart

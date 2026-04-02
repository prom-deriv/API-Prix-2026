import React, { useEffect, useRef, memo } from "react"
import { createChart, CandlestickSeries, LineSeries } from "lightweight-charts"
import type { IChartApi, ISeriesApi, CandlestickData, Time, LineData } from "lightweight-charts"
import { useTradingStore } from "../../stores/tradingStore"
import { cn } from "../../lib/utils"

interface TickChartProps {
  className?: string
}

const TickChart: React.FC<TickChartProps> = memo(({ className }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const barrierSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const { tickHistory, currentSymbol, barrier } = useTradingStore()

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

    const barrierSeries = chart.addSeries(LineSeries, {
      color: "hsl(47.9, 95.8%, 53.1%)",
      lineWidth: 2,
      lineStyle: 2, // Dashed line
      priceScaleId: "right",
    })

    chartRef.current = chart
    seriesRef.current = candlestickSeries
    barrierSeriesRef.current = barrierSeries

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

    seriesRef.current.setData(candleData)

    if (chartRef.current && candleData.length > 0) {
      chartRef.current.timeScale().scrollToRealTime()
    }
  }, [tickHistory])

  useEffect(() => {
    if (seriesRef.current) {
      seriesRef.current.setData([])
    }
  }, [currentSymbol])

  useEffect(() => {
    if (!barrierSeriesRef.current || tickHistory.length === 0) return

    if (barrier === null) {
      barrierSeriesRef.current.setData([])
      return
    }

    // Create a horizontal line at the barrier price level
    const barrierData: LineData<Time>[] = []
    const firstTick = tickHistory[0]
    const lastTick = tickHistory[tickHistory.length - 1]

    if (firstTick && lastTick) {
      barrierData.push(
        { time: firstTick.epoch as Time, value: barrier },
        { time: lastTick.epoch as Time, value: barrier }
      )
    }

    barrierSeriesRef.current.setData(barrierData)
  }, [barrier, tickHistory])

  return (
    <div
      ref={chartContainerRef}
      className={cn("w-full h-full min-h-[300px]", className)}
    />
  )
})

TickChart.displayName = "TickChart"

export default TickChart
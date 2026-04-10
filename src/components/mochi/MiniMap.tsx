import React, { useRef, useEffect, useMemo } from "react"
import type { Tick } from "../../types/deriv"

interface MiniMapProps {
  tickHistory: Tick[]
  currentSymbol: string
}

const MiniMap: React.FC<MiniMapProps> = ({ tickHistory, currentSymbol }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | undefined>(undefined)

  // Normalize tick data for mini map
  const normalizedPoints = useMemo(() => {
    if (tickHistory.length < 2) return []

    const quotes = tickHistory.map((t) => t.quote)
    const minQuote = Math.min(...quotes)
    const maxQuote = Math.max(...quotes)
    const range = maxQuote - minQuote || 1

    return tickHistory.map((tick, i) => ({
      x: (i / (tickHistory.length - 1)) * 600,
      y: 80 - ((tick.quote - minQuote) / range) * 60 - 10,
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickHistory])

  // Render mini map
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height

    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height)

      // Draw background
      const bgGradient = ctx.createLinearGradient(0, 0, 0, height)
      bgGradient.addColorStop(0, "rgba(255, 249, 242, 0.95)")
      bgGradient.addColorStop(1, "rgba(255, 249, 242, 0.85)")
      ctx.fillStyle = bgGradient
      ctx.beginPath()
      ctx.roundRect(0, 0, width, height, 16)
      ctx.fill()

      // Draw border
      ctx.strokeStyle = "#F0E4D7"
      ctx.lineWidth = 2
      ctx.stroke()

      if (normalizedPoints.length < 2) {
        // Draw "Loading..." text
        ctx.fillStyle = "#8B5E3C"
        ctx.font = "14px 'Quicksand', sans-serif"
        ctx.textAlign = "center"
        ctx.fillText("Loading chart data...", width / 2, height / 2)
        animationFrameRef.current = requestAnimationFrame(render)
        return
      }

      // Draw grid lines
      ctx.strokeStyle = "rgba(240, 228, 215, 0.5)"
      ctx.lineWidth = 1
      for (let i = 0; i < 5; i++) {
        const y = (i / 4) * height
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
        ctx.stroke()
      }

      // Create gradient for area fill
      const areaGradient = ctx.createLinearGradient(0, 0, 0, height)
      areaGradient.addColorStop(0, "rgba(181, 192, 208, 0.4)")
      areaGradient.addColorStop(1, "rgba(181, 192, 208, 0.05)")

      // Draw area fill
      ctx.beginPath()
      ctx.moveTo(0, height)
      for (const point of normalizedPoints) {
        ctx.lineTo(point.x, point.y)
      }
      ctx.lineTo(width, height)
      ctx.closePath()
      ctx.fillStyle = areaGradient
      ctx.fill()

      // Draw line
      ctx.beginPath()
      ctx.lineWidth = 2
      ctx.strokeStyle = "#B5C0D0"
      ctx.lineCap = "round"
      ctx.lineJoin = "round"

      for (let i = 0; i < normalizedPoints.length; i++) {
        const point = normalizedPoints[i]
        if (i === 0) {
          ctx.moveTo(point.x, point.y)
        } else {
          ctx.lineTo(point.x, point.y)
        }
      }
      ctx.stroke()

      // Draw current price dot
      if (normalizedPoints.length > 0) {
        const lastPoint = normalizedPoints[normalizedPoints.length - 1]

        // Outer glow
        ctx.beginPath()
        ctx.arc(lastPoint.x, lastPoint.y, 8, 0, Math.PI * 2)
        ctx.fillStyle = "rgba(181, 192, 208, 0.3)"
        ctx.fill()

        // Inner dot
        ctx.beginPath()
        ctx.arc(lastPoint.x, lastPoint.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = "#B5C0D0"
        ctx.fill()

        // White center
        ctx.beginPath()
        ctx.arc(lastPoint.x, lastPoint.y, 2, 0, Math.PI * 2)
        ctx.fillStyle = "#FFFFFF"
        ctx.fill()
      }

      // Draw symbol label
      ctx.fillStyle = "#8B5E3C"
      ctx.font = "bold 12px 'Quicksand', sans-serif"
      ctx.textAlign = "left"
      ctx.fillText(currentSymbol, 12, 20)

      // Draw price range
      if (tickHistory.length > 0) {
        const quotes = tickHistory.map((t) => t.quote)
        const minQuote = Math.min(...quotes)
        const maxQuote = Math.max(...quotes)

        ctx.font = "10px 'Quicksand', sans-serif"
        ctx.fillStyle = "rgba(139, 94, 60, 0.6)"
        ctx.textAlign = "right"
        ctx.fillText(`H: ${maxQuote.toFixed(2)}`, width - 12, 20)
        ctx.fillText(`L: ${minQuote.toFixed(2)}`, width - 12, height - 10)
      }

      animationFrameRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [normalizedPoints, currentSymbol, tickHistory])

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={600}
        height={100}
        className="w-full h-auto rounded-2xl shadow-lg"
        style={{
          backdropFilter: "blur(10px)",
        }}
      />

      {/* Live indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ backgroundColor: "#DFF2D8" }}
        />
        <span className="text-xs font-medium" style={{ color: "#8B5E3C" }}>
          LIVE
        </span>
      </div>

      {/* Mini chart label */}
      <div
        className="absolute bottom-3 left-3 px-2 py-1 rounded-lg text-xs"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.8)",
          color: "#8B5E3C",
          fontFamily: "'Quicksand', sans-serif",
        }}
      >
        📊 Mini Map
      </div>
    </div>
  )
}

export default MiniMap
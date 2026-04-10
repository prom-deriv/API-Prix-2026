import { useEffect, useRef } from "react"
import type { Tick } from "../../types/deriv"

interface WaveFormationProps {
  tickHistory: Tick[]
  scrollOffset: number
  currentPrice: number
}

export default function WaveFormation({ tickHistory, scrollOffset, currentPrice }: WaveFormationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    let animationId: number

    const animate = () => {
      if (!ctx || !canvas) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (tickHistory.length < 2) {
        animationId = requestAnimationFrame(animate)
        return
      }

      // Calculate price range for scaling
      const prices = tickHistory.map(t => t.quote)
      const minPrice = Math.min(...prices)
      const maxPrice = Math.max(...prices)
      const priceRange = maxPrice - minPrice || 1

      // Wave path from tick data
      const waveY = canvas.height * 0.5 // Middle of screen
      const waveAmplitude = Math.min(canvas.height * 0.2, 150)
      const pointSpacing = canvas.width / Math.max(tickHistory.length - 1, 1)

      // Draw main wave line
      ctx.beginPath()
      ctx.strokeStyle = "#0EA5E9"
      ctx.lineWidth = 4
      ctx.lineCap = "round"
      ctx.lineJoin = "round"

      tickHistory.forEach((tick, index) => {
        const x = index * pointSpacing - (scrollOffset % pointSpacing)
        const normalizedPrice = (tick.quote - minPrice) / priceRange
        const y = waveY - (normalizedPrice - 0.5) * waveAmplitude * 2

        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })

      ctx.stroke()

      // Draw wave fill (water)
      ctx.beginPath()
      tickHistory.forEach((tick, index) => {
        const x = index * pointSpacing - (scrollOffset % pointSpacing)
        const normalizedPrice = (tick.quote - minPrice) / priceRange
        const y = waveY - (normalizedPrice - 0.5) * waveAmplitude * 2

        if (index === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })

      // Complete the fill to bottom
      ctx.lineTo(canvas.width, canvas.height)
      ctx.lineTo(0, canvas.height)
      ctx.closePath()

      const waterGradient = ctx.createLinearGradient(0, waveY - waveAmplitude, 0, canvas.height)
      waterGradient.addColorStop(0, "rgba(14, 165, 233, 0.3)")
      waterGradient.addColorStop(0.5, "rgba(14, 165, 233, 0.2)")
      waterGradient.addColorStop(1, "rgba(12, 74, 110, 0.4)")
      ctx.fillStyle = waterGradient
      ctx.fill()

      // Draw wave crest (foam)
      ctx.beginPath()
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"
      ctx.lineWidth = 3
      ctx.setLineDash([5, 5])

      tickHistory.forEach((tick, index) => {
        const x = index * pointSpacing - (scrollOffset % pointSpacing)
        const normalizedPrice = (tick.quote - minPrice) / priceRange
        const y = waveY - (normalizedPrice - 0.5) * waveAmplitude * 2

        if (index === 0) {
          ctx.moveTo(x, y - 5)
        } else {
          ctx.lineTo(x, y - 5)
        }
      })

      ctx.stroke()
      ctx.setLineDash([])

      // Price change indicators (bubbles)
      for (let i = 1; i < tickHistory.length; i++) {
        const priceDiff = tickHistory[i].quote - tickHistory[i - 1].quote
        if (Math.abs(priceDiff) > priceRange * 0.001) {
          const x = i * pointSpacing - (scrollOffset % pointSpacing)
          const normalizedPrice = (tickHistory[i].quote - minPrice) / priceRange
          const y = waveY - (normalizedPrice - 0.5) * waveAmplitude * 2

          // Draw bubble
          ctx.beginPath()
          ctx.arc(x, y, 8, 0, Math.PI * 2)
          ctx.fillStyle = priceDiff > 0 ? "rgba(34, 197, 94, 0.5)" : "rgba(239, 68, 68, 0.5)"
          ctx.fill()
          ctx.strokeStyle = priceDiff > 0 ? "#22C55E" : "#EF4444"
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      cancelAnimationFrame(animationId)
    }
  }, [tickHistory, scrollOffset, currentPrice])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    />
  )
}

import { useEffect, useRef } from "react"

interface OceanBackgroundProps {
  volatility: number // 0-1, affects wave intensity
  scrollOffset: number
}

export default function OceanBackground({ volatility, scrollOffset }: OceanBackgroundProps) {
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

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Sky gradient (top to middle)
      const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.6)
      skyGradient.addColorStop(0, "#87CEEB") // Sky blue
      skyGradient.addColorStop(1, "#4FC3F7") // Light blue
      ctx.fillStyle = skyGradient
      ctx.fillRect(0, 0, canvas.width, canvas.height * 0.6)

      // Ocean gradient (middle to bottom)
      const oceanGradient = ctx.createLinearGradient(0, canvas.height * 0.6, 0, canvas.height)
      oceanGradient.addColorStop(0, "#0EA5E9") // Ocean blue
      oceanGradient.addColorStop(0.5, "#0284C7") // Medium blue
      oceanGradient.addColorStop(1, "#0C4A6E") // Deep blue
      ctx.fillStyle = oceanGradient
      ctx.fillRect(0, canvas.height * 0.6, canvas.width, canvas.height * 0.4)

      // Draw animated waves (background waves)
      const waveCount = 3
      const time = scrollOffset * 0.01

      for (let i = 0; i < waveCount; i++) {
        const amplitude = 20 + volatility * 30 + i * 10
        const frequency = 0.01 - i * 0.002
        const phase = time + i * Math.PI / 2
        const yOffset = canvas.height * (0.65 + i * 0.08)
        const opacity = 0.3 - i * 0.08

        ctx.beginPath()
        ctx.moveTo(0, canvas.height)

        for (let x = 0; x <= canvas.width; x += 5) {
          const y = yOffset + Math.sin(x * frequency + phase) * amplitude
          ctx.lineTo(x, y)
        }

        ctx.lineTo(canvas.width, canvas.height)
        ctx.closePath()

        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`
        ctx.fill()
      }

      // Foam particles
      const particleCount = Math.floor(10 + volatility * 20)
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)"
      
      for (let i = 0; i < particleCount; i++) {
        const x = ((scrollOffset * 2 + i * 100) % (canvas.width + 100)) - 50
        const y = canvas.height * 0.7 + Math.sin(scrollOffset * 0.05 + i) * 30
        const size = 2 + Math.random() * 3
        
        ctx.beginPath()
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fill()
      }

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      cancelAnimationFrame(animationId)
    }
  }, [volatility, scrollOffset])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{ zIndex: 0 }}
    />
  )
}

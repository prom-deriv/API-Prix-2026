import React, { useRef, useEffect, useMemo, useState, useCallback } from "react"
import type { Tick } from "../../types/deriv"

interface ProceduralTrackProps {
  tickHistory: Tick[]
  scrollOffset: number
  raceState: "idle" | "revving" | "racing" | "finished"
  onRoadPositionChange?: (getRoadYAtX: (x: number) => number) => void
}

// Catmull-Rom spline interpolation for smooth curves
function catmullRomSpline(
  points: { x: number; y: number }[],
  numSegments: number = 10
): { x: number; y: number }[] {
  if (points.length < 2) return points

  const result: { x: number; y: number }[] = []

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[Math.min(points.length - 1, i + 1)]
    const p3 = points[Math.min(points.length - 1, i + 2)]

    for (let t = 0; t < numSegments; t++) {
      const s = t / numSegments
      const s2 = s * s
      const s3 = s2 * s

      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * s +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * s2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * s3)

      const y =
        0.5 *
        (2 * p1.y +
          (-p0.y + p2.y) * s +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * s2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * s3)

      result.push({ x, y })
    }
  }

  // Add last point
  result.push(points[points.length - 1])
  return result
}

// Generate default wavy track points when no tick data exists
function generateDefaultTrack(width: number, height: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  const numPoints = 20
  const centerY = height * 0.6
  const amplitude = height * 0.1

  for (let i = 0; i < numPoints; i++) {
    const x = (i / (numPoints - 1)) * width
    const y = centerY + Math.sin(i * 0.5) * amplitude
    points.push({ x, y })
  }
  return points
}

const ProceduralTrack: React.FC<ProceduralTrackProps> = ({
  tickHistory,
  scrollOffset,
  raceState,
  onRoadPositionChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  // Track container size changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: rect.width, height: rect.height })
      }
    }

    updateDimensions()

    const observer = new ResizeObserver(updateDimensions)
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  // Normalize tick data to canvas coordinates
  const normalizedPoints = useMemo(() => {
    const { width, height } = dimensions

    // If no tick data, generate default track
    if (tickHistory.length < 2) {
      return generateDefaultTrack(width, height)
    }

    const quotes = tickHistory.map((t) => t.quote)
    const minQuote = Math.min(...quotes)
    const maxQuote = Math.max(...quotes)
    const range = maxQuote - minQuote || 1

    return tickHistory.map((tick, i) => ({
      x: (i / (tickHistory.length - 1)) * width,
      y: height * 0.6 - ((tick.quote - minQuote) / range) * height * 0.3,
    }))
  }, [tickHistory, dimensions])

  // Generate smooth curve points
  const smoothPoints = useMemo(() => {
    if (normalizedPoints.length < 2) return normalizedPoints
    return catmullRomSpline(normalizedPoints, 20)
  }, [normalizedPoints])

  // Render the procedural track
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size to match container
    canvas.width = dimensions.width
    canvas.height = dimensions.height

    const width = canvas.width
    const height = canvas.height

    const render = () => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height)

      if (smoothPoints.length < 2) {
        animationFrameRef.current = requestAnimationFrame(render)
        return
      }

      // Apply scroll offset for parallax effect
      const offsetX = scrollOffset % width

      // Create gradient for ground (3D depth effect)
      const groundGradient = ctx.createLinearGradient(0, height / 2, 0, height)
      groundGradient.addColorStop(0, "#A8D5A2") // Light grass
      groundGradient.addColorStop(0.3, "#7CB876") // Medium grass
      groundGradient.addColorStop(0.7, "#5A9A54") // Dark grass
      groundGradient.addColorStop(1, "#3D7A37") // Deep ground

      // Draw ground with gradient
      ctx.beginPath()
      ctx.moveTo(0, height)

      // Draw road path with offset
      for (let i = 0; i < smoothPoints.length; i++) {
        const point = smoothPoints[i]
        const x = ((point.x + offsetX) % (width + 200)) - 100
        const y = point.y

        if (i === 0) {
          ctx.lineTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }

      ctx.lineTo(width, height)
      ctx.closePath()
      ctx.fillStyle = groundGradient
      ctx.fill()

      // Draw road surface
      ctx.beginPath()
      ctx.lineWidth = 40
      ctx.lineCap = "round"
      ctx.lineJoin = "round"

      // Road gradient (asphalt look)
      const roadGradient = ctx.createLinearGradient(0, 0, width, 0)
      roadGradient.addColorStop(0, "#4A4A4A")
      roadGradient.addColorStop(0.5, "#5A5A5A")
      roadGradient.addColorStop(1, "#4A4A4A")
      ctx.strokeStyle = roadGradient

      for (let i = 0; i < smoothPoints.length; i++) {
        const point = smoothPoints[i]
        const x = ((point.x + offsetX) % (width + 200)) - 100
        const y = point.y

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()

      // Draw road center line (dashed)
      ctx.beginPath()
      ctx.lineWidth = 3
      ctx.setLineDash([20, 20])
      ctx.strokeStyle = "#FFFFFF"

      for (let i = 0; i < smoothPoints.length; i++) {
        const point = smoothPoints[i]
        const x = ((point.x + offsetX) % (width + 200)) - 100
        const y = point.y

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
      ctx.setLineDash([])

      // Draw road edges (white lines)
      ctx.beginPath()
      ctx.lineWidth = 4
      ctx.strokeStyle = "#FFFFFF"

      // Top edge
      for (let i = 0; i < smoothPoints.length; i++) {
        const point = smoothPoints[i]
        const x = ((point.x + offsetX) % (width + 200)) - 100
        const y = point.y - 20

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()

      // Bottom edge
      ctx.beginPath()
      for (let i = 0; i < smoothPoints.length; i++) {
        const point = smoothPoints[i]
        const x = ((point.x + offsetX) % (width + 200)) - 100
        const y = point.y + 20

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()

      // Draw finish line if race is finished
      if (raceState === "finished") {
        const finishX = width * 0.8
        const checkSize = 10

        for (let row = 0; row < 5; row++) {
          for (let col = 0; col < 3; col++) {
            ctx.fillStyle = (row + col) % 2 === 0 ? "#FFFFFF" : "#000000"
            ctx.fillRect(
              finishX + col * checkSize,
              height * 0.5 - 25 + row * checkSize,
              checkSize,
              checkSize
            )
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [smoothPoints, scrollOffset, raceState, dimensions])

  // Get road Y position at a given X coordinate (for character positioning)
  const getRoadYAtX = useCallback((x: number): number => {
    if (smoothPoints.length < 2) return dimensions.height * 0.6

    const offsetX = scrollOffset % dimensions.width
    const normalizedX = x - offsetX

    // Find the two closest points
    let closestIndex = 0
    let minDist = Infinity

    for (let i = 0; i < smoothPoints.length; i++) {
      const dist = Math.abs(smoothPoints[i].x - normalizedX)
      if (dist < minDist) {
        minDist = dist
        closestIndex = i
      }
    }

    // Interpolate between two closest points
    const p1 = smoothPoints[closestIndex]
    const p2 = smoothPoints[Math.min(closestIndex + 1, smoothPoints.length - 1)]

    if (p1.x === p2.x) return p1.y

    const t = (normalizedX - p1.x) / (p2.x - p1.x)
    return p1.y + t * (p2.y - p1.y)
  }, [smoothPoints, scrollOffset, dimensions])

  // Expose road position API to parent
  useEffect(() => {
    if (onRoadPositionChange) {
      onRoadPositionChange(getRoadYAtX)
    }
  }, [onRoadPositionChange, getRoadYAtX])

  return (
    <div ref={containerRef} className="absolute inset-0" style={{ zIndex: 10 }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{
          filter: raceState === "revving" ? "brightness(1.1)" : "none",
          transition: "filter 0.3s ease",
        }}
      />
    </div>
  )
}

export default ProceduralTrack
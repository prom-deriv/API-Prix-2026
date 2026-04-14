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

      let x =
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

      // Prevent roads from overlapping by ensuring x strictly increases
      if (result.length > 0 && x <= result[result.length - 1].x) {
        x = result[result.length - 1].x + 0.1
      }

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
  const centerY = height * 0.75 // Lower the base position of the road
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

    // Apply moving average smoothing to the quotes
    const windowSize = 5;
    const smoothedQuotes = quotes.map((_val, idx, arr) => {
      const start = Math.max(0, idx - windowSize);
      const end = Math.min(arr.length, idx + windowSize + 1);
      const window = arr.slice(start, end);
      return window.reduce((sum, v) => sum + v, 0) / window.length;
    });

    const minQuote = Math.min(...smoothedQuotes)
    const maxQuote = Math.max(...smoothedQuotes)
    const range = maxQuote - minQuote || 1

    // Reduce the number of points we feed into the spline for smoother waves
    const targetPoints = 20;
    const step = Math.max(1, Math.floor(smoothedQuotes.length / targetPoints));
    
    const reducedPoints = [];
    for (let i = 0; i < smoothedQuotes.length; i += step) {
      reducedPoints.push({
        x: (i / (smoothedQuotes.length - 1)) * width,
        y: height * 0.8 - ((smoothedQuotes[i] - minQuote) / range) * height * 0.4,
      });
    }
    
    // Ensure the last point is included for a complete track
    if (reducedPoints[reducedPoints.length - 1].x !== width) {
      reducedPoints.push({
        x: width,
        y: height * 0.8 - ((smoothedQuotes[smoothedQuotes.length - 1] - minQuote) / range) * height * 0.4,
      })
    }

    // Make the track seamlessly loop to prevent vertical walls when scrolling
    if (reducedPoints.length > 2) {
      const firstY = reducedPoints[0].y;
      const lastY = reducedPoints[reducedPoints.length - 1].y;
      const matchY = (firstY + lastY) / 2;
      
      reducedPoints[0].y = matchY;
      reducedPoints[reducedPoints.length - 1].y = matchY;
      
      if (reducedPoints.length > 4) {
        reducedPoints[1].y = (reducedPoints[1].y + matchY) / 2;
        reducedPoints[reducedPoints.length - 2].y = (reducedPoints[reducedPoints.length - 2].y + matchY) / 2;
      }
    }

    return reducedPoints;
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

      // Calculate continuous repeating points to cover the screen
      const repeatWidth = width
      
      // Calculate how many full repeats we've scrolled
      // Shift so the scrolling is continuous and seamless
      const scrollShift = scrollOffset % repeatWidth
      
      // Build a continuous array of points that covers from left to right edge
      const continuousPoints: { x: number, y: number }[] = []
      
      // Add points for current screen and one screen ahead to handle wrapping smoothly
      for (let offset = -repeatWidth; offset <= repeatWidth; offset += repeatWidth) {
        for (let i = 0; i < smoothPoints.length; i++) {
          const p = smoothPoints[i]
          const x = p.x + offset - scrollShift
          
          // Only add points that might be visible or form lines that intersect the screen
          if (x > -200 && x < width + 200) {
            continuousPoints.push({ x, y: p.y })
          }
        }
      }
      
      // Sort points by X coordinate to ensure continuous drawing
      continuousPoints.sort((a, b) => a.x - b.x)

      // Create gradient for ground (3D depth effect)
      const groundGradient = ctx.createLinearGradient(0, height / 2, 0, height)
      groundGradient.addColorStop(0, "#A8D5A2") // Light grass
      groundGradient.addColorStop(0.3, "#7CB876") // Medium grass
      groundGradient.addColorStop(0.7, "#5A9A54") // Dark grass
      groundGradient.addColorStop(1, "#3D7A37") // Deep ground

      // Draw ground with gradient
      ctx.fillStyle = groundGradient
      ctx.beginPath()

      if (continuousPoints.length > 0) {
        ctx.moveTo(continuousPoints[0].x, height)
        for (let i = 0; i < continuousPoints.length; i++) {
          ctx.lineTo(continuousPoints[i].x, continuousPoints[i].y)
        }
        ctx.lineTo(continuousPoints[continuousPoints.length - 1].x, height)
      }
      
      ctx.closePath()
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

      if (continuousPoints.length > 0) {
        ctx.moveTo(continuousPoints[0].x, continuousPoints[0].y)
        for (let i = 1; i < continuousPoints.length; i++) {
          ctx.lineTo(continuousPoints[i].x, continuousPoints[i].y)
        }
      }
      ctx.stroke()

      // Draw road center line (dashed)
      ctx.beginPath()
      ctx.lineWidth = 3
      ctx.setLineDash([20, 20])
      ctx.strokeStyle = "#FFFFFF"

      if (continuousPoints.length > 0) {
        ctx.moveTo(continuousPoints[0].x, continuousPoints[0].y)
        for (let i = 1; i < continuousPoints.length; i++) {
          ctx.lineTo(continuousPoints[i].x, continuousPoints[i].y)
        }
      }
      ctx.stroke()
      ctx.setLineDash([])

      // Draw road edges (white lines)
      ctx.beginPath()
      ctx.lineWidth = 4
      ctx.strokeStyle = "#FFFFFF"

      // Top edge
      if (continuousPoints.length > 0) {
        ctx.moveTo(continuousPoints[0].x, continuousPoints[0].y - 20)
        for (let i = 1; i < continuousPoints.length; i++) {
          ctx.lineTo(continuousPoints[i].x, continuousPoints[i].y - 20)
        }
      }
      ctx.stroke()

      // Bottom edge
      ctx.beginPath()
      if (continuousPoints.length > 0) {
        ctx.moveTo(continuousPoints[0].x, continuousPoints[0].y + 20)
        for (let i = 1; i < continuousPoints.length; i++) {
          ctx.lineTo(continuousPoints[i].x, continuousPoints[i].y + 20)
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
    if (smoothPoints.length < 2) return dimensions.height * 0.75

    const scrollShift = scrollOffset % dimensions.width
    // Map screen X coordinate back to the normalized track X coordinate
    // The track is drawn at `x_draw = p.x + offset - scrollShift`
    // So to find which `p.x` corresponds to a given screen `x`:
    // `p.x = x - offset + scrollShift`
    // Since the pattern repeats every `dimensions.width`, we take modulo:
    const normalizedX = ((x + scrollShift) % dimensions.width + dimensions.width) % dimensions.width

    // Find the two points that bound normalizedX
    let p1 = smoothPoints[0]
    let p2 = smoothPoints[smoothPoints.length - 1]

    for (let i = 0; i < smoothPoints.length - 1; i++) {
      if (smoothPoints[i].x <= normalizedX && smoothPoints[i + 1].x >= normalizedX) {
        p1 = smoothPoints[i]
        p2 = smoothPoints[i + 1]
        break
      }
    }

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
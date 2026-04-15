import { useEffect, useState } from "react"
import type { SurferState } from "../../contexts/SurfContext"
import type { Tick } from "../../types/deriv"

interface SurferCharacterProps {
  state: SurferState
  tickHistory: Tick[]
  priceChange: number
  scrollOffset: number
}

export default function SurferCharacter({ state, tickHistory, priceChange, scrollOffset }: SurferCharacterProps) {
  const [rotation, setRotation] = useState(0)
  const [verticalPos, setVerticalPos] = useState(window.innerHeight / 2)
  const [animationFrame, setAnimationFrame] = useState(0)

  useEffect(() => {
    // Calculate rotation based on price change, max out at 45 degrees for cooler visual
    const targetRotation = Math.max(-45, Math.min(45, priceChange * 8000))
    setRotation(targetRotation)

    // The absolutely foolproof way to pin the robot to the wave:
    // We look at the actual DOM pixels that the WaveFormation canvas drew.
    // However, since it's an HTML5 canvas and we can't easily query internal paths...
    // We recreate the EXACT mathematical formula of WaveFormation.tsx based on the exact same parameters.
    if (tickHistory.length >= 2) {
      const prices = tickHistory.map(t => t.quote)
      const minPrice = Math.min(...prices)
      const maxPrice = Math.max(...prices)
      const priceRange = maxPrice - minPrice || 1

      // MIN_SPACING matches WaveFormation precisely
      const MIN_SPACING = 30
      const pointSpacing = Math.max(window.innerWidth / Math.max(tickHistory.length - 1, 1), MIN_SPACING)
      
      const totalWidth = pointSpacing * (tickHistory.length - 1)
      const startX = window.innerWidth > totalWidth ? 0 : window.innerWidth - totalWidth

      // Target physical pixel X coordinate (50% of screen width)
      const targetX = window.innerWidth * 0.5

      let leftTickIndex = 0
      let rightTickIndex = 1

      for (let i = 0; i < tickHistory.length - 1; i++) {
        // EXACT match of the loop inside WaveFormation including the modulo offset
        const x1 = startX + i * pointSpacing - (scrollOffset % pointSpacing)
        const x2 = startX + (i + 1) * pointSpacing - (scrollOffset % pointSpacing)
        
        if (targetX >= x1 && targetX <= x2) {
          leftTickIndex = i
          rightTickIndex = i + 1
          break
        }
      }

      const x1 = startX + leftTickIndex * pointSpacing - (scrollOffset % pointSpacing)
      const x2 = startX + rightTickIndex * pointSpacing - (scrollOffset % pointSpacing)
      
      const p1 = tickHistory[leftTickIndex].quote
      const p2 = tickHistory[rightTickIndex].quote

      // Interpolate price precisely between the two ticks based on targetX
      const segmentWidth = x2 - x1
      const progress = segmentWidth === 0 ? 0 : Math.max(0, Math.min(1, (targetX - x1) / segmentWidth))
      const interpolatedPrice = p1 + (p2 - p1) * progress
      const normalizedPrice = (interpolatedPrice - minPrice) / priceRange

      // WaveFormation uses window.innerHeight explicitly
      const waveY = window.innerHeight * 0.5
      const waveAmplitude = Math.min(window.innerHeight * 0.2, 150)
      
      // The exact absolute Y pixel coordinate inside the screen!
      const exactYPixel = waveY - (normalizedPrice - 0.5) * waveAmplitude * 2

      // Since SurferCharacter has position:absolute, top: `${px}px` will lock it to the screen's literal pixels!
      // No more percentage scaling desync between container sizes.
      setVerticalPos(exactYPixel)
    }

    // Animation frames for bobbing idle/riding
    const interval = setInterval(() => {
      setAnimationFrame(prev => (prev + 1) % 4)
    }, 100)

    return () => clearInterval(interval)
  }, [priceChange, tickHistory, scrollOffset])

  const getAnimationClass = () => {
    switch (state) {
      case "trick":
        // Give it a wild 360 spin + flip during trick!
        return "animate-[spin_1s_ease-in-out_infinite]"
      case "wipeout":
        return "animate-[spin_3s_linear_infinite] opacity-50 scale-75"
      case "celebrate":
        return "animate-bounce scale-110"
      default:
        return "transition-all duration-500"
    }
  }

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: "50%",
        // Transition vertical position incredibly smoothly, tracking the canvas pixels
        top: `${verticalPos}px`,
        // Anchor the exact bottom center of the board to the line
        transform: `translate(-50%, -85%) rotate(${rotation}deg) translateY(${Math.sin(animationFrame) * 5}px)`,
        zIndex: 20,
        // Slower transition for vertical pos so it glides along the wave instead of snapping rigidly
        transition: "top 0.1s linear, transform 0.2s ease-out"
      }}
    >
      {/* Surfer */}
      <div className={`relative z-10 ${getAnimationClass()}`}>
        <img 
          src="/Surf Waves/New Robot Surfing.png"
          alt="Robot Surfer" 
          className="w-40 h-40 md:w-64 md:h-64 object-contain"
          style={{ 
            filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.4))",
            // Flip the robot if it's doing a trick, making it look wilder
            transform: state === "trick" ? "rotate(360deg)" : "none",
            transition: "transform 1s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
          }}
        />
      </div>

      {/* Spray effect when riding */}
      {state === "riding" && priceChange !== 0 && (
        <div
          className="absolute top-0 left-0 pointer-events-none"
          style={{
            transform: `translateX(${priceChange > 0 ? '-' : ''}50px)`,
          }}
        >
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-ping"
              style={{
                fontSize: "20px",
                opacity: 0.6 - i * 0.1,
                animationDelay: `${i * 0.1}s`,
                left: `${i * -10}px`,
                top: `${Math.random() * 30}px`,
              }}
            >
              💧
            </div>
          ))}
        </div>
      )}

      {/* Trick indicator */}
      {state === "trick" && (
        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2">
          <div className="text-3xl font-bold text-yellow-400 animate-bounce" style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.5)" }}>
            TRICK!
          </div>
        </div>
      )}

      {/* Wipeout indicator */}
      {state === "wipeout" && (
        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2">
          <div className="text-3xl font-bold text-red-500 animate-pulse" style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.5)" }}>
            WIPEOUT!
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from "react"
import type { SurferState } from "../../contexts/SurfContext"
import type { Tick } from "../../types/deriv"

interface SurferCharacterProps {
  state: SurferState
  tickHistory: Tick[]
  priceChange: number
}

export default function SurferCharacter({ state, tickHistory, priceChange }: SurferCharacterProps) {
  const [rotation, setRotation] = useState(0)
  const [verticalPos, setVerticalPos] = useState(50)
  const [animationFrame, setAnimationFrame] = useState(0)

  useEffect(() => {
    // Calculate rotation based on price change
    const targetRotation = Math.max(-25, Math.min(25, priceChange * 5000))
    setRotation(targetRotation)

    // Calculate vertical position based on recent price trend
    if (tickHistory.length >= 2) {
      const recent = tickHistory.slice(-5)
      const avgPrice = recent.reduce((sum, t) => sum + t.quote, 0) / recent.length
      const currentPrice = tickHistory[tickHistory.length - 1].quote
      const pricePosition = ((currentPrice - avgPrice) / avgPrice) * 100

      // Position between 30% and 70% of screen height
      setVerticalPos(50 - pricePosition * 2)
    }

    // Animation frames for idle/riding
    const interval = setInterval(() => {
      setAnimationFrame(prev => (prev + 1) % 4)
    }, 200)

    return () => clearInterval(interval)
  }, [priceChange, tickHistory])

  const getSurferEmoji = () => {
    switch (state) {
      case "trick":
        return "🤸"
      case "wipeout":
        return "💦"
      case "celebrate":
        return "🎉"
      case "riding":
        return "🏄"
      default:
        return "🧍"
    }
  }

  const getAnimationClass = () => {
    switch (state) {
      case "trick":
        return "animate-bounce"
      case "wipeout":
        return "animate-spin"
      case "celebrate":
        return "animate-pulse"
      default:
        return ""
    }
  }

  return (
    <div
      className="absolute transition-all duration-300 pointer-events-none"
      style={{
        left: "30%",
        top: `${verticalPos}%`,
        transform: `rotate(${rotation}deg) translateY(${Math.sin(animationFrame) * 5}px)`,
        zIndex: 20,
      }}
    >
      {/* Surfer */}
      <div className={`text-6xl ${getAnimationClass()}`}>
        {getSurferEmoji()}
      </div>

      {/* Surfboard */}
      <div
        className="absolute top-12 left-1/2 transform -translate-x-1/2"
        style={{
          width: "80px",
          height: "12px",
          background: "linear-gradient(135deg, #FBBF24 0%, #FB923C 100%)",
          borderRadius: "50%",
          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
        }}
      />

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

import { useEffect } from "react"
import { useSurf, type PowerUp } from "../../contexts/SurfContext"
import { TrendingUp, TrendingDown, Zap } from "lucide-react"

interface PowerUpCollectorProps {
  powerUps: PowerUp[]
  scrollOffset: number
}

export default function PowerUpCollector({ powerUps, scrollOffset }: PowerUpCollectorProps) {
  const { collectPowerUp } = useSurf()

  const getPowerUpIcon = (type: PowerUp["type"]) => {
    switch (type) {
      case "rsi":
        return <TrendingUp className="w-6 h-6" />
      case "macd":
        return <TrendingDown className="w-6 h-6" />
      case "volatility":
        return <Zap className="w-6 h-6" />
      default:
        return null
    }
  }

  const getPowerUpColor = (type: PowerUp["type"]) => {
    switch (type) {
      case "rsi":
        return "#3B82F6" // Blue
      case "macd":
        return "#FBBF24" // Gold
      case "volatility":
        return "#8B5CF6" // Purple
      default:
        return "#6B7280"
    }
  }

  const getPowerUpName = (type: PowerUp["type"]) => {
    switch (type) {
      case "rsi":
        return "RSI Signal"
      case "macd":
        return "MACD Cross"
      case "volatility":
        return "Volatility Spike"
      default:
        return "Power-Up"
    }
  }

  useEffect(() => {
    // Auto-collect power-ups when they pass the surfer position (30% from left)
    const surferPosition = window.innerWidth * 0.3
    
    powerUps.forEach(powerUp => {
      if (!powerUp.collected) {
        const powerUpX = (powerUp.position * window.innerWidth) - scrollOffset
        
        // Check if power-up is within collection range (±50px)
        if (Math.abs(powerUpX - surferPosition) < 50) {
          collectPowerUp(powerUp.id)
        }
      }
    })
  }, [powerUps, scrollOffset, collectPowerUp])

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 15 }}>
      {powerUps.map((powerUp) => {
        if (powerUp.collected) return null

        const xPos = (powerUp.position * window.innerWidth) - scrollOffset
        
        // Only render if on screen
        if (xPos < -100 || xPos > window.innerWidth + 100) return null

        return (
          <div
            key={powerUp.id}
            className="absolute transition-all duration-300"
            style={{
              left: `${xPos}px`,
              top: "45%",
              animation: "float 2s ease-in-out infinite",
            }}
          >
            {/* Power-up glow */}
            <div
              className="absolute inset-0 rounded-full blur-xl opacity-50"
              style={{
                background: getPowerUpColor(powerUp.type),
                width: "60px",
                height: "60px",
                transform: "translate(-50%, -50%)",
              }}
            />

            {/* Power-up icon */}
            <div
              className="relative flex items-center justify-center rounded-full shadow-lg animate-pulse"
              style={{
                width: "50px",
                height: "50px",
                background: `linear-gradient(135deg, ${getPowerUpColor(powerUp.type)} 0%, ${getPowerUpColor(powerUp.type)}dd 100%)`,
                border: "3px solid white",
                transform: "translate(-50%, -50%)",
              }}
            >
              <div style={{ color: "white" }}>
                {getPowerUpIcon(powerUp.type)}
              </div>
            </div>

            {/* Power-up label */}
            <div
              className="absolute top-16 left-1/2 transform -translate-x-1/2 whitespace-nowrap"
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                color: getPowerUpColor(powerUp.type),
                textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
              }}
            >
              {getPowerUpName(powerUp.type)}
              <div className="text-white text-center">+{powerUp.points}</div>
            </div>

            {/* Sparkle effect */}
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  top: `${Math.sin(Date.now() / 500 + i) * 20}px`,
                  left: `${Math.cos(Date.now() / 500 + i) * 20}px`,
                  fontSize: "20px",
                  opacity: 0.7,
                  animation: `spin ${2 + i}s linear infinite`,
                }}
              >
                ✨
              </div>
            ))}
          </div>
        )
      })}

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}

import React from "react"
import { cn } from "../../lib/utils"
import type { MascotEmotion } from "../../contexts/GhostContext"

interface BubuMascotProps {
  emotion: MascotEmotion
  className?: string
}

const BubuMascot: React.FC<BubuMascotProps> = ({ emotion, className }) => {
  // Bubu is a cute Panda mascot
  // Uses publicly available GIF URLs for animations

  const getGifUrl = () => {
    switch (emotion) {
      case "win":
        return "https://media.tenor.com/J2O7sBO4gJcAAAAi/panda-cute.gif"
      case "lose":
        return "https://media.tenor.com/7b8MWMIqHrMAAAAi/panda-cry.gif"
      default:
        return "https://media.tenor.com/MI2dMgXCRwkAAAAi/cute-panda.gif"
    }
  }

  const getMessage = () => {
    switch (emotion) {
      case "win":
        return "Amazing trade! You're the best! 🌟"
      case "lose":
        return "Don't worry, we'll get the next one! 💫"
      default:
        return "Watching the market... 👀"
    }
  }

  return (
    <div className={cn(
      "flex flex-col items-center gap-2 transition-all duration-500",
      emotion === "win" && "animate-bounce",
      emotion === "lose" && "animate-pulse",
      className
    )}>
      <div className={cn(
        "w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden transition-transform duration-300 shadow-lg",
        emotion === "win" && "scale-110 rotate-12",
        emotion === "lose" && "scale-95",
      )} style={{
        border: "3px solid #B5C0D0",
        boxShadow: "0 10px 30px rgba(181, 192, 208, 0.3)"
      }}>
        <img 
          src={getGifUrl()} 
          alt="Bubu the Panda"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className={cn(
        "text-center px-4 py-2 rounded-2xl text-sm font-medium max-w-[200px]",
        "bg-white/80 backdrop-blur-sm border-2 shadow-lg",
        emotion === "win" && "border-green-300 text-green-700 animate-pulse",
        emotion === "lose" && "border-pink-200 text-pink-600",
        emotion === "idle" && "border-amber-200 text-amber-700"
      )} style={{
        fontFamily: "'Quicksand', 'Nunito', sans-serif",
        boxShadow: "0 10px 30px rgba(166, 123, 91, 0.08)"
      }}>
        {getMessage()}
      </div>
      <p className="text-xs font-semibold" style={{ color: "#8B5E3C" }}>
        Bubu the Panda
      </p>
    </div>
  )
}

export default BubuMascot

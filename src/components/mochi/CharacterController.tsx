import React, { useMemo, useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import type { MascotEmotion } from "../../contexts/GhostContext"

interface CharacterControllerProps {
  emotion: MascotEmotion
  slope: number
  raceState: "idle" | "revving" | "racing" | "finished"
  priceChange: number
  tickHistory: Array<{ quote: number; epoch: number }>
  roadY: number
}

// Character sprite URLs using local images
const getCharacterImage = (isLead: boolean, emotion: MascotEmotion, raceState: string) => {
  if (isLead) {
    // Bubu (Panda)
    switch (emotion) {
      case "win":
        return "/characters/bubu kiss dudu.gif"
      case "lose":
        return "/characters/Bubu turn around.gif"
      default:
        return raceState === "racing" ? "/characters/Bubu Dudu runing.gif" : "/characters/Bubu-and-Dudu.png"
    }
  } else {
    // Dudu (Bunny)
    switch (emotion) {
      case "win":
        return "/characters/Dudu Dancing.gif"
      case "lose":
        return "/characters/Dudu Twist Bubu.gif"
      default:
        return raceState === "racing" ? "/characters/Dudu walking.gif" : "/characters/Dudu walking.gif"
    }
  }
}

// SVG Placeholder for Bubu (Panda)
const BubuPlaceholder = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full">
    <circle cx="50" cy="50" r="45" fill="#F5F5F5" />
    {/* Ears */}
    <circle cx="25" cy="25" r="15" fill="#333" />
    <circle cx="75" cy="25" r="15" fill="#333" />
    {/* Face */}
    <circle cx="50" cy="55" r="35" fill="#FFFFFF" />
    {/* Eyes */}
    <ellipse cx="35" cy="45" rx="8" ry="10" fill="#333" />
    <ellipse cx="65" cy="45" rx="8" ry="10" fill="#333" />
    <circle cx="37" cy="43" r="3" fill="#FFF" />
    <circle cx="67" cy="43" r="3" fill="#FFF" />
    {/* Nose */}
    <ellipse cx="50" cy="60" rx="8" ry="5" fill="#333" />
    {/* Mouth */}
    <path d="M 42 68 Q 50 75 58 68" stroke="#333" strokeWidth="2" fill="none" />
    {/* Blush */}
    <circle cx="30" cy="60" r="6" fill="#FFB6C1" opacity="0.5" />
    <circle cx="70" cy="60" r="6" fill="#FFB6C1" opacity="0.5" />
  </svg>
)

// SVG Placeholder for Dudu (Bunny)
const DuduPlaceholder = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full">
    <circle cx="50" cy="55" r="40" fill="#FFF0F5" />
    {/* Ears */}
    <ellipse cx="35" cy="15" rx="10" ry="25" fill="#FFFFFF" />
    <ellipse cx="65" cy="15" rx="10" ry="25" fill="#FFFFFF" />
    <ellipse cx="35" cy="15" rx="6" ry="18" fill="#FFB6C1" />
    <ellipse cx="65" cy="15" rx="6" ry="18" fill="#FFB6C1" />
    {/* Face */}
    <circle cx="50" cy="55" r="35" fill="#FFFFFF" />
    {/* Eyes */}
    <circle cx="38" cy="48" r="6" fill="#333" />
    <circle cx="62" cy="48" r="6" fill="#333" />
    <circle cx="40" cy="46" r="2" fill="#FFF" />
    <circle cx="64" cy="46" r="2" fill="#FFF" />
    {/* Nose */}
    <ellipse cx="50" cy="58" rx="5" ry="4" fill="#FFB6C1" />
    {/* Mouth */}
    <path d="M 45 65 Q 50 70 55 65" stroke="#333" strokeWidth="2" fill="none" />
    {/* Whiskers */}
    <line x1="30" y1="55" x2="40" y2="58" stroke="#CCC" strokeWidth="1" />
    <line x1="30" y1="60" x2="40" y2="60" stroke="#CCC" strokeWidth="1" />
    <line x1="60" y1="58" x2="70" y2="55" stroke="#CCC" strokeWidth="1" />
    <line x1="60" y1="60" x2="70" y2="60" stroke="#CCC" strokeWidth="1" />
    {/* Blush */}
    <circle cx="32" cy="62" r="5" fill="#FFB6C1" opacity="0.4" />
    <circle cx="68" cy="62" r="5" fill="#FFB6C1" opacity="0.4" />
  </svg>
)

// Image component with fallback
const CharacterImage: React.FC<{
  src: string
  alt: string
  isLead: boolean
}> = ({ src, alt, isLead }) => {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setHasError(false)
    setIsLoading(true)
  }, [src])

  if (hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: isLead ? "#E8F4F8" : "#FFF0F5" }}>
        {isLead ? <BubuPlaceholder /> : <DuduPlaceholder />}
      </div>
    )
  }

  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: isLead ? "#E8F4F8" : "#FFF0F5" }}>
          <div className="animate-pulse">
            {isLead ? <BubuPlaceholder /> : <DuduPlaceholder />}
          </div>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true)
          setIsLoading(false)
        }}
      />
    </>
  )
}

// Particle effect component
const ParticleEffect: React.FC<{ type: 'hearts' | 'stars' | 'smoke'; isLead: boolean }> = ({ type, isLead }) => {
  const particles = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: isLead ? -20 - Math.random() * 30 : -15 - Math.random() * 20,
      y: isLead ? 30 + Math.random() * 40 : 25 + Math.random() * 30,
      scale: 0.5 + Math.random() * 0.5,
      delay: i * 0.1,
    }))
  }, [isLead])

  if (type === 'hearts') {
    return (
      <div className="absolute -left-6 top-1/2 transform -translate-y-1/2 pointer-events-none">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute text-pink-400"
            style={{ left: p.x, top: p.y }}
            animate={{
              y: [0, -50, -100],
              opacity: [0, 1, 0],
              scale: [0, p.scale, 0],
              rotate: [0, 15, -15],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: p.delay,
              ease: "easeOut",
            }}
          >
            💖
          </motion.div>
        ))}
      </div>
    )
  }

  if (type === 'stars') {
    return (
      <div className="absolute -left-6 top-1/2 transform -translate-y-1/2 pointer-events-none">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute text-yellow-400"
            style={{ left: p.x, top: p.y }}
            animate={{
              y: [0, -40, -80],
              opacity: [0, 1, 0],
              scale: [0, p.scale, 0],
              rotate: [0, 360],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: p.delay,
              ease: "easeOut",
            }}
          >
            ⭐
          </motion.div>
        ))}
      </div>
    )
  }

  // Smoke/exhaust particles
  return (
    <div className="absolute -left-8 top-1/2 transform -translate-y-1/2 pointer-events-none">
      {particles.slice(0, 5).map((p) => (
        <motion.div
          key={p.id}
          className="absolute w-4 h-4 rounded-full bg-gray-400 opacity-60"
          style={{ left: p.x, top: p.y }}
          animate={{
            x: [-30, -60, -90],
            opacity: [0.6, 0.3, 0],
            scale: [1, 1.5, 2],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  )
}

const CharacterController: React.FC<CharacterControllerProps> = ({
  emotion,
  slope,
  raceState,
  priceChange,
  tickHistory,
  roadY,
}) => {
  // Jump physics state
  const [isJumping, setIsJumping] = useState(false)
  const [jumpY, setJumpY] = useState(0)
  const [jumpTime, setJumpTime] = useState(0)
  const jumpStartTimeRef = useRef<number | null>(null)
  const lastPriceRef = useRef<number | null>(null)

  // Physics constants
  const GRAVITY = 980 // pixels per second squared
  const JUMP_VELOCITY = 350 // initial upward velocity
  const JUMP_THRESHOLD = 0.001 // 0.1% price change

  // Detect price jump and trigger jump animation
  useEffect(() => {
    if (tickHistory.length < 2) return

    const currentPrice = tickHistory[tickHistory.length - 1].quote
    const prevPrice = tickHistory[tickHistory.length - 2].quote

    if (lastPriceRef.current !== null) {
      const priceChangePercent = Math.abs(currentPrice - prevPrice) / prevPrice

      if (priceChangePercent > JUMP_THRESHOLD && !isJumping) {
        setIsJumping(true)
        jumpStartTimeRef.current = performance.now()
      }
    }

    lastPriceRef.current = currentPrice
  }, [tickHistory, isJumping])

  // Jump animation loop with parabolic arc
  useEffect(() => {
    if (!isJumping) return

    let animationId: number
    const animate = () => {
      if (!jumpStartTimeRef.current) return

      const elapsed = (performance.now() - jumpStartTimeRef.current) / 1000
      const y = -JUMP_VELOCITY * elapsed + 0.5 * GRAVITY * elapsed * elapsed

      if (y > 0) {
        // Character has landed
        setIsJumping(false)
        setJumpY(0)
        setJumpTime(0)
        jumpStartTimeRef.current = null
      } else {
        setJumpY(y)
        setJumpTime(elapsed)
        animationId = requestAnimationFrame(animate)
      }
    }

    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [isJumping])

  // Squash and stretch scale calculations
  const squashStretch = useMemo(() => {
    const baseTime = performance.now() / 1000
    const idleSquash = Math.sin(baseTime * 4) * 0.05 // Subtle idle bounce

    if (isJumping) {
      // During jump: stretch up at takeoff, squash on landing
      const progress = jumpTime
      if (progress < 0.1) {
        // Takeoff squash
        return { scaleX: 0.9, scaleY: 1.15 }
      } else if (progress > 0.5) {
        // Landing squash
        return { scaleX: 1.15, scaleY: 0.85 }
      } else {
        // Mid-air stretch
        return { scaleX: 0.95, scaleY: 1.05 }
      }
    }

    // Idle squash and stretch
    return {
      scaleX: 1 + idleSquash,
      scaleY: 1 - idleSquash,
    }
  }, [isJumping, jumpTime])

  // Calculate rotation based on slope (Mario-style tilt)
  const rotation = useMemo(() => {
    const maxUpRotation = 20
    const maxDownRotation = 15

    if (slope > 0) {
      // Climbing - tilt up
      return Math.min(slope * 2, maxUpRotation)
    } else {
      // Descending - tilt down
      return Math.max(slope * 2, -maxDownRotation)
    }
  }, [slope])

  // Determine lead/lag based on price change
  const isLeading = priceChange >= 0

  // Get particle type based on emotion
  const getParticleType = (): 'hearts' | 'stars' | 'smoke' => {
    if (emotion === "win") return "hearts"
    if (emotion === "lose") return "stars"
    return "smoke"
  }

  return (
    <div 
      className="absolute left-1/2 transform -translate-x-1/2 flex items-end gap-8" 
      style={{ 
        top: roadY > 0 ? `${roadY - 10}px` : "65%", // Position container's top at roadY (offset slightly for tire placement)
        zIndex: 20,
        transform: `translateX(-50%) translateY(calc(-100% + ${jumpY}px))`, // Shift up by 100% so the bottom rests on roadY, then apply jump
        transition: "top 0.1s ease-out", // Smoothly follow the road
      }}
    >
      {/* Bubu (Lead Character) */}
      <motion.div
        className="relative"
        animate={{
          rotate: isLeading ? rotation : rotation * 0.5,
          scaleX: squashStretch.scaleX,
          scaleY: squashStretch.scaleY,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 20,
          mass: 0.8,
        }}
        style={{
          transformOrigin: "center bottom",
        }}
      >
        <div
          className="relative w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden shadow-2xl"
          style={{
            border: "4px solid #B5C0D0",
            boxShadow: "0 10px 40px rgba(181, 192, 208, 0.4)",
            backgroundColor: "#E8F4F8",
          }}
        >
          <CharacterImage
            src={getCharacterImage(true, emotion, raceState)}
            alt="Bubu the Panda"
            isLead={true}
          />
          <ParticleEffect type={getParticleType()} isLead={true} />
        </div>

        {/* Character label */}
        <motion.div
          className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
          style={{
            backgroundColor: "#B5C0D0",
            color: "#FFFFFF",
            fontFamily: "'Quicksand', sans-serif",
          }}
          animate={{
            scale: emotion === "win" ? [1, 1.2, 1] : 1,
            y: isJumping ? jumpY : 0,
          }}
          transition={{ duration: 0.5, repeat: emotion === "win" ? Infinity : 0 }}
        >
          Bubu {isLeading ? "🏎️" : "🚗"}
        </motion.div>

        {/* Speed lines when racing */}
        {raceState === "racing" && (
          <div className="absolute -right-8 top-1/2 transform -translate-y-1/2">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="h-0.5 bg-gray-400 rounded mb-2"
                style={{ width: 20 + i * 10 }}
                animate={{
                  x: [0, 30],
                  opacity: [0.8, 0],
                }}
                transition={{
                  duration: 0.3,
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
              />
            ))}
          </div>
        )}

        {/* Landing squash effect */}
        {isJumping && jumpTime > 0.4 && (
          <motion.div
            className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-16 h-4 rounded-full bg-gray-300 opacity-50"
            animate={{
              scaleX: [1, 1.5, 0],
              opacity: [0.5, 0.3, 0],
            }}
            transition={{ duration: 0.3 }}
          />
        )}
      </motion.div>

      {/* Dudu (Lag Character) */}
      <motion.div
        className="relative"
        animate={{
          rotate: !isLeading ? rotation : rotation * 0.5,
          scaleX: squashStretch.scaleX * 0.95,
          scaleY: squashStretch.scaleY * 0.95,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 20,
          mass: 0.8,
        }}
        style={{
          transformOrigin: "center bottom",
          opacity: 0.9,
        }}
      >
        <div
          className="relative w-20 h-20 md:w-28 md:h-28 rounded-2xl overflow-hidden shadow-xl"
          style={{
            border: "4px solid #FFB8D0",
            boxShadow: "0 8px 30px rgba(255, 184, 208, 0.4)",
            backgroundColor: "#FFF0F5",
          }}
        >
          <CharacterImage
            src={getCharacterImage(false, emotion, raceState)}
            alt="Dudu the Bunny"
            isLead={false}
          />
          <ParticleEffect type={getParticleType()} isLead={false} />
        </div>

        {/* Character label */}
        <motion.div
          className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
          style={{
            backgroundColor: "#FFB8D0",
            color: "#FFFFFF",
            fontFamily: "'Quicksand', sans-serif",
          }}
          animate={{
            scale: emotion === "win" ? [1, 1.2, 1] : 1,
            y: isJumping ? jumpY * 0.8 : 0,
          }}
          transition={{ duration: 0.5, repeat: emotion === "win" ? Infinity : 0 }}
        >
          Dudu {!isLeading ? "🏎️" : "🚗"}
        </motion.div>

        {/* Speed lines when racing */}
        {raceState === "racing" && (
          <div className="absolute -right-6 top-1/2 transform -translate-y-1/2">
            {[...Array(2)].map((_, i) => (
              <motion.div
                key={i}
                className="h-0.5 bg-pink-300 rounded mb-2"
                style={{ width: 15 + i * 8 }}
                animate={{
                  x: [0, 20],
                  opacity: [0.6, 0],
                }}
                transition={{
                  duration: 0.3,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Race position indicator */}
      {raceState === "racing" && (
        <motion.div
          className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full text-sm font-bold"
          style={{
            backgroundColor: isLeading ? "#DFF2D8" : "#FFE5F0",
            color: "#8B5E3C",
            border: `2px solid ${isLeading ? "#7CB876" : "#FFB8D0"}`,
            fontFamily: "'Quicksand', sans-serif",
          }}
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          {isLeading ? "📈 Leading!" : "📉 Catching up!"}
        </motion.div>
      )}

      {/* Victory pose overlay */}
      {raceState === "finished" && emotion === "win" && (
        <motion.div
          className="absolute -top-16 left-1/2 transform -translate-x-1/2"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          <img
            src="/characters/Bubu Dudu hugging.jpg"
            alt="Victory!"
            className="w-20 h-20 rounded-full border-4 border-yellow-400 shadow-lg"
          />
        </motion.div>
      )}
    </div>
  )
}

export default CharacterController
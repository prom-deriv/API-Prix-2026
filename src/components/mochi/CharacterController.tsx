import React, { useMemo, useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import type { MascotEmotion } from "../../contexts/GhostContext"
import { getSoundManager } from "../../utils/soundManager"

// TOGGLE THIS TO TRUE TO REVERT TO BUBU AND DUDU IMAGES
const USE_ORIGINAL_CHARACTERS = true;

interface CharacterControllerProps {
  emotion: MascotEmotion
  slope: number
  raceState: "idle" | "revving" | "racing" | "finished"
  priceChange: number
  tickHistory: Array<{ quote: number; epoch: number }>
  roadY: number
}

// Character sprite URLs using local images
const getCharacterImage = (isLead: boolean, emotion: MascotEmotion) => {
  if (isLead) {
    // Mochi
    switch (emotion) {
      case "win":
        return encodeURI("/Mochi Moto/Mochi Win.png")
      case "lose":
        return encodeURI("/Mochi Moto/Mochi Lose.png")
      default:
        return encodeURI("/Mochi Moto/Mochi Racing.png")
    }
  } else {
    // Moto
    switch (emotion) {
      case "win":
        return encodeURI("/Mochi Moto/Moto Win.png")
      case "lose":
        return encodeURI("/Mochi Moto/Moto Lose.png")
      default:
        return encodeURI("/Mochi Moto/Moto Racing.png")
    }
  }
}

// New SVG Characters
const MochiRacer: React.FC<{ emotion: MascotEmotion, raceState: string }> = ({ emotion }) => (
  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl">
    {/* Kart */}
    <path d="M 20 70 L 80 70 Q 90 70 90 60 L 90 50 Q 90 45 80 45 L 20 45 Q 10 45 10 50 L 10 60 Q 10 70 20 70 Z" fill="#4CAF50" />
    <circle cx="25" cy="70" r="10" fill="#333" />
    <circle cx="25" cy="70" r="4" fill="#CCC" />
    <circle cx="75" cy="70" r="10" fill="#333" />
    <circle cx="75" cy="70" r="4" fill="#CCC" />
    {/* Steering Wheel */}
    <path d="M 70 45 L 75 35" stroke="#333" strokeWidth="3" />
    <circle cx="75" cy="35" r="4" fill="#333" />
    {/* Mochi Character */}
    <circle cx="50" cy="35" r="20" fill="#FFFFFF" />
    {/* Face */}
    {emotion === 'win' ? (
      <>
        <path d="M 40 30 Q 45 25 50 30" stroke="#333" strokeWidth="2" fill="none" />
        <path d="M 50 30 Q 55 25 60 30" stroke="#333" strokeWidth="2" fill="none" />
        <path d="M 45 38 Q 50 45 55 38" stroke="#333" strokeWidth="2" fill="none" />
      </>
    ) : emotion === 'lose' ? (
      <>
        {/* Crying Eyes */}
        <path d="M 38 32 Q 42 28 46 32" stroke="#333" strokeWidth="2" fill="none" />
        <path d="M 54 32 Q 58 28 62 32" stroke="#333" strokeWidth="2" fill="none" />
        {/* Tears */}
        <path d="M 42 36 Q 42 42 42 46 Q 44 46 44 42 Q 44 36 42 36 Z" fill="#87CEEB" />
        <path d="M 58 36 Q 58 42 58 46 Q 60 46 60 42 Q 60 36 58 36 Z" fill="#87CEEB" />
        {/* Sad Mouth */}
        <path d="M 46 42 Q 50 38 54 42" stroke="#333" strokeWidth="2" fill="none" />
      </>
    ) : (
      <>
        <circle cx="42" cy="32" r="3" fill="#333" />
        <circle cx="58" cy="32" r="3" fill="#333" />
        <path d="M 46 38 Q 50 42 54 38" stroke="#333" strokeWidth="2" fill="none" />
      </>
    )}
    {/* Blush */}
    <circle cx="35" cy="38" r="4" fill="#FFB6C1" opacity="0.6" />
    <circle cx="65" cy="38" r="4" fill="#FFB6C1" opacity="0.6" />
  </svg>
)

const MotoRacer: React.FC<{ emotion: MascotEmotion, raceState: string }> = ({ emotion }) => (
  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl">
    {/* Kart */}
    <path d="M 20 70 L 80 70 Q 90 70 90 60 L 90 50 Q 90 45 80 45 L 20 45 Q 10 45 10 50 L 10 60 Q 10 70 20 70 Z" fill="#FF4B4B" />
    <circle cx="25" cy="70" r="10" fill="#333" />
    <circle cx="25" cy="70" r="4" fill="#CCC" />
    <circle cx="75" cy="70" r="10" fill="#333" />
    <circle cx="75" cy="70" r="4" fill="#CCC" />
    {/* Steering Wheel */}
    <path d="M 70 45 L 75 35" stroke="#333" strokeWidth="3" />
    <circle cx="75" cy="35" r="4" fill="#333" />
    {/* Moto Character (Cat) */}
    <circle cx="50" cy="35" r="18" fill="#FFD700" />
    <polygon points="35,22 42,20 38,30" fill="#FFD700" />
    <polygon points="65,22 58,20 62,30" fill="#FFD700" />
    {/* Face */}
    {emotion === 'win' ? (
      <>
        <path d="M 40 32 Q 45 28 48 32" stroke="#333" strokeWidth="2" fill="none" />
        <path d="M 52 32 Q 55 28 60 32" stroke="#333" strokeWidth="2" fill="none" />
        <path d="M 45 38 Q 50 42 55 38" stroke="#333" strokeWidth="2" fill="none" />
      </>
    ) : emotion === 'lose' ? (
      <>
        {/* Crying Eyes */}
        <path d="M 38 34 Q 42 30 46 34" stroke="#333" strokeWidth="2" fill="none" />
        <path d="M 54 34 Q 58 30 62 34" stroke="#333" strokeWidth="2" fill="none" />
        {/* Tears */}
        <path d="M 42 38 Q 42 44 42 48 Q 44 48 44 44 Q 44 38 42 38 Z" fill="#87CEEB" />
        <path d="M 58 38 Q 58 44 58 48 Q 60 48 60 44 Q 60 38 58 38 Z" fill="#87CEEB" />
        {/* Sad Mouth */}
        <path d="M 46 44 Q 50 40 54 44" stroke="#333" strokeWidth="2" fill="none" />
      </>
    ) : (
      <>
        <ellipse cx="42" cy="34" rx="2" ry="4" fill="#333" />
        <ellipse cx="58" cy="34" rx="2" ry="4" fill="#333" />
        <path d="M 48 40 L 50 42 L 52 40" stroke="#333" strokeWidth="1.5" fill="none" />
      </>
    )}
  </svg>
)

// Image component with fallback
const CharacterImage: React.FC<{
  src: string
  alt: string
  isLead: boolean
  emotion: MascotEmotion
  raceState: string
}> = ({ src, alt, isLead, emotion, raceState }) => {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setHasError(false)
    setIsLoading(true)
  }, [src])

  if (!USE_ORIGINAL_CHARACTERS) {
    return isLead ? <MochiRacer emotion={emotion} raceState={raceState} /> : <MotoRacer emotion={emotion} raceState={raceState} />
  }

  if (hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-transparent">
        {/* No placeholder to prevent flashing old characters */}
      </div>
    )
  }

  return (
    <>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-transparent">
          {/* No placeholder to prevent flashing old characters */}
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-contain drop-shadow-xl ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        style={{ mixBlendMode: "multiply" }}
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

  // Determine who is leading based on price change
  // Mochi (Green) leads when price goes up. Moto (Red) leads when price goes down.
  const isMochiLeading = priceChange >= 0
  const isMotoLeading = priceChange < 0

  // Add smooth overtaking animations via x offset
  const MOTO_LEAD_X = 80
  const MOTO_LAG_X = -80
  const MOCHI_LEAD_X = 80
  const MOCHI_LAG_X = -80

  // We play a whoosh sound when the leader changes
  const prevMotoLeading = useRef(isMotoLeading)
  useEffect(() => {
    if (prevMotoLeading.current !== isMotoLeading && raceState === "racing") {
      const sm = getSoundManager()
      sm.playWhoosh()
    }
    prevMotoLeading.current = isMotoLeading
  }, [isMotoLeading, raceState])

  // Determine specific emotion for each character based on trade result
  // If trade wins: Moto (Blue/Up) smiles, Mochi (Red/Down) cries
  // If trade loses: Mochi (Red/Down) smiles, Moto (Blue/Up) cries
  const motoEmotion = emotion === "win" ? "win" : emotion === "lose" ? "lose" : emotion
  const mochiEmotion = emotion === "win" ? "lose" : emotion === "lose" ? "win" : emotion

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

  // Get particle type based on emotion
  const getParticleType = (charEmotion: MascotEmotion): 'hearts' | 'stars' | 'smoke' => {
    if (charEmotion === "win") return "hearts"
    if (charEmotion === "lose") return "stars"
    return "smoke"
  }

  return (
    <div 
      className="absolute left-1/2 transform -translate-x-1/2 flex items-end justify-center" 
      style={{ 
        width: "300px", // Give a fixed width container so we can position absolutely within it
        top: roadY > 0 ? `${roadY - 20}px` : "65%", // Position container's top perfectly at the road's top edge (road has 40px width, so -20px)
        zIndex: 20,
        transform: `translateX(-50%) translateY(calc(-100% + ${jumpY}px))`, // Shift up by 100% so the bottom rests on road top, then apply jump
        transition: "top 0.1s ease-out", // Smoothly follow the road
      }}
    >
      {/* Mochi (Red) */}
      <motion.div
        className="absolute bottom-0"
        animate={{
          x: isMochiLeading ? MOCHI_LEAD_X : MOCHI_LAG_X,
          rotate: isMochiLeading ? rotation : rotation * 0.5,
          scaleX: isMochiLeading ? squashStretch.scaleX : squashStretch.scaleX * 0.95,
          scaleY: isMochiLeading ? squashStretch.scaleY : squashStretch.scaleY * 0.95,
          zIndex: isMochiLeading ? 30 : 10,
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
          className="relative w-36 h-36 md:w-48 md:h-48"
        >
          <CharacterImage
            src={getCharacterImage(true, mochiEmotion)}
            alt="Mochi Racer"
            isLead={true}
            emotion={mochiEmotion}
            raceState={raceState}
          />
          <ParticleEffect type={getParticleType(mochiEmotion)} isLead={isMochiLeading} />
        </div>

        {/* Character label */}
        <motion.div
          className="absolute -top-6 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap flex items-center justify-center gap-1"
          style={{
            backgroundColor: "#4CAF50",
            color: "#FFFFFF",
            fontFamily: "'Quicksand', sans-serif",
            zIndex: 40,
          }}
          animate={{
            scale: mochiEmotion === "win" ? [1, 1.2, 1] : 1,
            y: isJumping ? jumpY : 0,
          }}
          transition={{ duration: 0.5, repeat: mochiEmotion === "win" ? Infinity : 0 }}
        >
          <span>Mochi</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#004d00">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.08 3H5.78l1.07-3zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
          </svg>
        </motion.div>

        {/* Speed lines when racing */}
        {raceState === "racing" && (
          <div className="absolute -right-8 top-1/2 transform -translate-y-1/2">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="h-0.5 bg-green-400 rounded mb-2"
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

      {/* Moto (Blue) */}
      <motion.div
        className="absolute bottom-0"
        animate={{
          x: isMotoLeading ? MOTO_LEAD_X : MOTO_LAG_X,
          rotate: isMotoLeading ? rotation : rotation * 0.5,
          scaleX: isMotoLeading ? squashStretch.scaleX : squashStretch.scaleX * 0.95,
          scaleY: isMotoLeading ? squashStretch.scaleY : squashStretch.scaleY * 0.95,
          zIndex: isMotoLeading ? 30 : 10,
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
          className="relative w-36 h-36 md:w-48 md:h-48"
        >
          <CharacterImage
            src={getCharacterImage(false, motoEmotion)}
            alt="Moto Racer"
            isLead={false}
            emotion={motoEmotion}
            raceState={raceState}
          />
          <ParticleEffect type={getParticleType(motoEmotion)} isLead={isMotoLeading} />
        </div>

        {/* Character label */}
        <motion.div
          className="absolute -top-6 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
          style={{
            backgroundColor: USE_ORIGINAL_CHARACTERS ? "#FFB8D0" : "#FF4B4B",
            color: "#FFFFFF",
            fontFamily: "'Quicksand', sans-serif",
            zIndex: 40,
          }}
          animate={{
            scale: motoEmotion === "win" ? [1, 1.2, 1] : 1,
            y: isJumping ? jumpY * 0.8 : 0,
          }}
          transition={{ duration: 0.5, repeat: motoEmotion === "win" ? Infinity : 0 }}
        >
          Moto {isMotoLeading ? "🏎️" : "🚗"}
        </motion.div>

        {/* Speed lines when racing */}
        {raceState === "racing" && (
          <div className="absolute -right-6 top-1/2 transform -translate-y-1/2">
            {[...Array(2)].map((_, i) => (
              <motion.div
                key={i}
                className="h-0.5 bg-red-400 rounded mb-2"
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
          className="absolute -top-12 px-4 py-2 rounded-full text-sm font-bold z-50 whitespace-nowrap"
          style={{
            backgroundColor: isMochiLeading ? "#DFF2D8" : "#FFE5E5",
            color: "#8B5E3C",
            border: `2px solid ${isMochiLeading ? "#7CB876" : "#FF4B4B"}`,
            fontFamily: "'Quicksand', sans-serif",
          }}
          animate={{
            scale: [1, 1.05, 1],
            x: isMochiLeading ? MOCHI_LEAD_X - 40 : MOTO_LEAD_X - 40,
          }}
          transition={{ 
            duration: 1, 
            repeat: Infinity,
            x: { type: "spring", stiffness: 300, damping: 20 }
          }}
        >
          {isMochiLeading ? "📈 Mochi Leading!" : "📉 Moto Leading!"}
        </motion.div>
      )}

    </div>
  )
}

export default CharacterController

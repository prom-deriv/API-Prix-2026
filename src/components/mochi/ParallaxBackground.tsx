import React, { useMemo } from "react"
import { motion } from "framer-motion"

interface ParallaxBackgroundProps {
  scrollOffset: number
}

// Generate random positions for background elements
const generateElements = (count: number, seed: number) => {
  const elements = []
  for (let i = 0; i < count; i++) {
    const pseudoRandom = (Math.sin(seed + i * 123.456) * 10000) % 1
    elements.push({
      id: i,
      x: Math.abs(pseudoRandom) * 100,
      y: 20 + Math.abs((Math.sin(seed + i * 789.012) * 10000) % 1) * 60,
      scale: 0.5 + Math.abs((Math.sin(seed + i * 345.678) * 10000) % 1) * 0.5,
      delay: i * 0.1,
    })
  }
  return elements
}

const ParallaxBackground: React.FC<ParallaxBackgroundProps> = ({ scrollOffset }) => {
  // Background layer - Slow moving mountains and clouds
  const mountains = useMemo(() => [
    { id: 0, x: 0, height: 180, color: "#E8D5C4" },
    { id: 1, x: 25, height: 220, color: "#DEC8B5" },
    { id: 2, x: 50, height: 160, color: "#F0E4D7" },
    { id: 3, x: 75, height: 200, color: "#E5D4C1" },
  ], [])

  const clouds = useMemo(() => generateElements(6, 42), [])

  // Midground layer - Trees and hills
  const trees = useMemo(() => generateElements(8, 123), [])

  // Foreground layer - Bushes and flowers
  const bushes = useMemo(() => generateElements(12, 789), [])
  const flowers = useMemo(() => generateElements(20, 456), [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Sky gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, #87CEEB 0%, #B0E0E6 30%, #FFF9F2 100%)",
        }}
      />

      {/* Sun */}
      <motion.div
        className="absolute top-8 right-16 w-24 h-24 rounded-full"
        style={{
          background: "radial-gradient(circle, #FFE5B4 0%, #FFD700 50%, #FFA500 100%)",
          boxShadow: "0 0 60px rgba(255, 215, 0, 0.6)",
        }}
        animate={{
          scale: [1, 1.05, 1],
          opacity: [0.9, 1, 0.9],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Background Layer - Mountains (slowest) */}
      <div
        className="absolute bottom-0 left-0 w-full h-64"
        style={{
          transform: `translateX(-${scrollOffset * 0.1}px)`,
        }}
      >
        {mountains.map((mountain) => (
          <div
            key={mountain.id}
            className="absolute bottom-0"
            style={{
              left: `${mountain.x}%`,
              width: "30%",
              height: `${mountain.height}px`,
              backgroundColor: mountain.color,
              clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
              opacity: 0.7,
            }}
          />
        ))}

        {/* Clouds */}
        {clouds.map((cloud) => (
          <motion.div
            key={cloud.id}
            className="absolute"
            style={{
              left: `${cloud.x}%`,
              top: `${cloud.y}%`,
              transform: `translateX(-${scrollOffset * 0.05}px)`,
            }}
            animate={{
              y: [0, -10, 0],
              opacity: [0.6, 0.8, 0.6],
            }}
            transition={{
              duration: 3 + cloud.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <div
              className="bg-white rounded-full"
              style={{
                width: 60 * cloud.scale,
                height: 30 * cloud.scale,
                filter: "blur(8px)",
                opacity: 0.7,
              }}
            />
          </motion.div>
        ))}
      </div>

      {/* Midground Layer - Trees (medium speed) */}
      <div
        className="absolute bottom-0 left-0 w-full h-48"
        style={{
          transform: `translateX(-${scrollOffset * 0.3}px)`,
        }}
      >
        {trees.map((tree) => (
          <motion.div
            key={tree.id}
            className="absolute bottom-0"
            style={{
              left: `${tree.x}%`,
              transform: `scale(${tree.scale})`,
            }}
            animate={{
              y: [0, -3, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: tree.delay,
            }}
          >
            {/* Tree trunk */}
            <div
              className="absolute bottom-0 left-1/2 transform -translate-x-1/2"
              style={{
                width: 8,
                height: 30,
                backgroundColor: "#8B5A2B",
                borderRadius: 2,
              }}
            />
            {/* Tree foliage */}
            <div
              className="absolute bottom-6 left-1/2 transform -translate-x-1/2"
              style={{
                width: 40,
                height: 50,
                backgroundColor: "#7CB876",
                borderRadius: "50% 50% 50% 50%",
                boxShadow: "inset -5px -5px 10px rgba(0,0,0,0.1)",
              }}
            />
          </motion.div>
        ))}
      </div>

      {/* Foreground Layer - Bushes and Flowers (fastest) */}
      <div
        className="absolute bottom-0 left-0 w-full h-32"
        style={{
          transform: `translateX(-${scrollOffset * 0.6}px)`,
        }}
      >
        {/* Bushes */}
        {bushes.map((bush) => (
          <motion.div
            key={`bush-${bush.id}`}
            className="absolute bottom-0"
            style={{
              left: `${bush.x}%`,
              transform: `scale(${bush.scale})`,
            }}
            animate={{
              y: [0, -2, 0],
              scale: [bush.scale, bush.scale * 1.05, bush.scale],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: bush.delay,
            }}
          >
            <div
              style={{
                width: 35,
                height: 25,
                backgroundColor: "#5A9A54",
                borderRadius: "50% 50% 50% 50%",
                boxShadow: "inset -3px -3px 8px rgba(0,0,0,0.15)",
              }}
            />
          </motion.div>
        ))}

        {/* Flowers */}
        {flowers.map((flower) => (
          <motion.div
            key={`flower-${flower.id}`}
            className="absolute"
            style={{
              left: `${flower.x}%`,
              bottom: `${5 + (flower.y - 20) * 0.3}%`,
              transform: `scale(${flower.scale * 0.6})`,
            }}
            animate={{
              y: [0, -5, 0],
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 2 + flower.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            {/* Flower petals */}
            <div className="relative">
              {[0, 72, 144, 216, 288].map((angle, i) => (
                <div
                  key={i}
                  className="absolute w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: i % 2 === 0 ? "#FF69B4" : "#FFB6C1",
                    transform: `rotate(${angle}deg) translateY(-8px)`,
                    transformOrigin: "center bottom",
                  }}
                />
              ))}
              {/* Flower center */}
              <div
                className="absolute w-3 h-3 rounded-full left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2"
                style={{ backgroundColor: "#FFD700" }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Ground layer */}
      <div
        className="absolute bottom-0 left-0 w-full h-24"
        style={{
          background: "linear-gradient(180deg, #A8D5A2 0%, #7CB876 50%, #5A9A54 100%)",
          transform: `translateX(-${scrollOffset * 0.8}px)`,
        }}
      />

      {/* Decorative elements - Birds */}
      <motion.div
        className="absolute top-20 left-1/4"
        animate={{
          x: [0, 100, 200],
          y: [0, -20, 0],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      >
        <div className="text-2xl">🐦</div>
      </motion.div>

      <motion.div
        className="absolute top-32 left-1/3"
        animate={{
          x: [0, 80, 160],
          y: [0, -15, 0],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear", delay: 2 }}
      >
        <div className="text-xl">🐦</div>
      </motion.div>

      {/* Floating hearts for win state */}
      <motion.div
        className="absolute top-1/4 left-1/2"
        animate={{
          y: [0, -50, -100],
          opacity: [0, 1, 0],
          scale: [0.5, 1, 0.5],
        }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <div className="text-2xl">💖</div>
      </motion.div>
    </div>
  )
}

export default ParallaxBackground
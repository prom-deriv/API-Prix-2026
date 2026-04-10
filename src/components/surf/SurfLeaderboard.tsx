import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Trophy, Medal, Award, Clock, TrendingUp } from "lucide-react"
import type { SurfSession } from "../../contexts/SurfContext"

interface SurfLeaderboardProps {
  sessions: SurfSession[]
  totalWaves: number
  surfPoints: number
}

export default function SurfLeaderboard({ sessions, totalWaves, surfPoints }: SurfLeaderboardProps) {
  const topSessions = [...sessions]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const getMedalIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-5 h-5" style={{ color: "#FBBF24" }} />
      case 1:
        return <Medal className="w-5 h-5" style={{ color: "#9CA3AF" }} />
      case 2:
        return <Award className="w-5 h-5" style={{ color: "#CD7F32" }} />
      default:
        return <div className="w-5 h-5 flex items-center justify-center text-sm font-bold" style={{ color: "#6B7280" }}>
          {index + 1}
        </div>
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div className="absolute top-20 left-4 z-30 w-80">
      <Card className="backdrop-blur-md" style={{
        borderRadius: "16px",
        border: "2px solid rgba(14, 165, 233, 0.4)",
        boxShadow: "0 8px 24px rgba(14, 165, 233, 0.2)",
        backgroundColor: "rgba(255, 255, 255, 0.2)",
      }}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2" style={{ color: "#0C4A6E" }}>
            <Trophy className="w-5 h-5" style={{ color: "#FBBF24" }} />
            Leaderboard
          </CardTitle>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4" style={{ color: "#0EA5E9" }} />
              <span style={{ color: "#6B7280" }}>Total Waves:</span>
              <span className="font-bold" style={{ color: "#0EA5E9" }}>{totalWaves}</span>
            </div>
            <div className="flex items-center gap-1">
              <Trophy className="w-4 h-4" style={{ color: "#FBBF24" }} />
              <span style={{ color: "#6B7280" }}>Points:</span>
              <span className="font-bold" style={{ color: "#FBBF24" }}>{surfPoints.toLocaleString()}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {topSessions.length === 0 ? (
            <div className="text-center py-8" style={{ color: "#6B7280" }}>
              <div className="text-4xl mb-2">🏄</div>
              <p className="text-sm">No rides yet!</p>
              <p className="text-xs mt-1">Start surfing to set records</p>
            </div>
          ) : (
            <div className="space-y-2">
              {topSessions.map((session, index) => (
                <div
                  key={session.id}
                  className="flex items-center gap-3 p-2 rounded-lg transition-all hover:bg-blue-50"
                  style={{
                    backgroundColor: index === 0 ? "#FEF3C7" : index === 1 ? "#F3F4F6" : index === 2 ? "#FEE2E2" : "transparent",
                  }}
                >
                  {/* Rank */}
                  <div className="flex-shrink-0">
                    {getMedalIcon(index)}
                  </div>

                  {/* Session Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold" style={{ color: "#0C4A6E" }}>
                        {session.score.toLocaleString()}
                      </span>
                      <span className="text-xs" style={{ color: "#6B7280" }}>
                        {formatDate(session.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: "#6B7280" }}>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(session.duration)}
                      </div>
                      <div className="flex items-center gap-1">
                        <span>🎯</span>
                        {session.maxCombo}x combo
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div
                    className="flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: session.status === "finished" ? "#D1FAE5" : session.status === "wiped" ? "#FEE2E2" : "#DBEAFE",
                      color: session.status === "finished" ? "#065F46" : session.status === "wiped" ? "#991B1B" : "#1E40AF",
                    }}
                  >
                    {session.status === "finished" ? "✓" : session.status === "wiped" ? "✗" : "~"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

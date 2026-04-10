import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { useGhost } from "../../contexts/GhostContext"
import { BarChart3, Target, Sparkles, TrendingUp } from "lucide-react"

const PerformanceCard: React.FC = () => {
  const { mochiPoints, totalSims, winRate, winCount, lossCount } = useGhost()

  return (
    <Card className="w-full" style={{
      borderRadius: "24px",
      border: "2px solid #F0E4D7",
      boxShadow: "0 10px 30px rgba(166, 123, 91, 0.08)",
      backgroundColor: "#FFFFFF"
    }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2" style={{
          fontFamily: "'Quicksand', 'Nunito', sans-serif",
          color: "#8B5E3C"
        }}>
          <BarChart3 className="h-5 w-5" style={{ color: "#B5C0D0" }} />
          Ghost Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total Sims */}
          <div className="p-4 rounded-2xl text-center" style={{
            backgroundColor: "#FFF9F2",
            border: "2px solid #F0E4D7"
          }}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <Target className="h-4 w-4" style={{ color: "#B5C0D0" }} />
              <span className="text-xs font-medium" style={{ color: "#8B5E3C", opacity: 0.7 }}>
                Total Sims
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: "#8B5E3C" }}>
              {totalSims}
            </p>
          </div>

          {/* Win Rate */}
          <div className="p-4 rounded-2xl text-center" style={{
            backgroundColor: totalSims > 0 
              ? (winRate >= 50 ? "#DFF2D8" : "#FFE5E5")
              : "#FFF9F2",
            border: `2px solid ${totalSims > 0 
              ? (winRate >= 50 ? "#DFF2D8" : "#FFE5E5")
              : "#F0E4D7"}`
          }}>
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="h-4 w-4" style={{ color: "#B5C0D0" }} />
              <span className="text-xs font-medium" style={{ color: "#8B5E3C", opacity: 0.7 }}>
                Win Rate
              </span>
            </div>
            <p className="text-2xl font-bold" style={{ color: "#8B5E3C" }}>
              {winRate.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Win/Loss Breakdown */}
        <div className="flex gap-3">
          <div className="flex-1 p-3 rounded-2xl text-center" style={{
            backgroundColor: "#DFF2D8",
            border: "2px solid #DFF2D8"
          }}>
            <p className="text-xs font-medium mb-1" style={{ color: "#8B5E3C", opacity: 0.7 }}>
              Wins
            </p>
            <p className="text-xl font-bold" style={{ color: "#8B5E3C" }}>
              {winCount}
            </p>
          </div>
          <div className="flex-1 p-3 rounded-2xl text-center" style={{
            backgroundColor: "#FFE5E5",
            border: "2px solid #FFE5E5"
          }}>
            <p className="text-xs font-medium mb-1" style={{ color: "#8B5E3C", opacity: 0.7 }}>
              Losses
            </p>
            <p className="text-xl font-bold" style={{ color: "#8B5E3C" }}>
              {lossCount}
            </p>
          </div>
        </div>

        {/* Mochi Points */}
        <div className="p-4 rounded-2xl" style={{
          backgroundColor: "#FFF9F2",
          border: "2px solid #B5C0D0"
        }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" style={{ color: "#B5C0D0" }} />
              <span className="font-medium" style={{ color: "#8B5E3C" }}>
                Mochi Points
              </span>
            </div>
            <span className="text-2xl font-bold" style={{ color: "#B5C0D0" }}>
              {mochiPoints.toLocaleString()}
            </span>
          </div>
          <p className="text-xs mt-2" style={{ color: "#8B5E3C", opacity: 0.6 }}>
            Earn 10 points per $1 wagered on winning trades
          </p>
        </div>

        {/* Confidence Meter */}
        {totalSims > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span style={{ color: "#8B5E3C", opacity: 0.7 }}>Confidence Meter</span>
              <span style={{ color: "#8B5E3C" }}>{winRate.toFixed(0)}%</span>
            </div>
            <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: "#F0E4D7" }}>
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${winRate}%`,
                  backgroundColor: winRate >= 60 ? "#DFF2D8" : winRate >= 40 ? "#B5C0D0" : "#FFE5E5"
                }}
              />
            </div>
            <p className="text-xs text-center" style={{ color: "#8B5E3C", opacity: 0.6 }}>
              {winRate >= 60 ? "You're on fire! Keep it up!" : 
               winRate >= 40 ? "Getting there! Stay focused!" : 
               "Don't give up! Every loss is a lesson!"}
            </p>
          </div>
        )}

        {/* Empty State */}
        {totalSims === 0 && (
          <div className="text-center py-4">
            <p className="text-sm" style={{ color: "#8B5E3C", opacity: 0.6 }}>
              No ghost trades yet. Start simulating to see your performance!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default PerformanceCard
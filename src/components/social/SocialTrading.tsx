import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Trophy, Copy, Lightbulb, MessageSquare, TrendingUp, TrendingDown, Users, Star } from "lucide-react"

export default function SocialTrading() {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'copy' | 'ideas' | 'comments'>('leaderboard')

  const renderTabContent = () => {
    switch (activeTab) {
      case 'leaderboard':
        return <LeaderboardTab />
      case 'copy':
        return <CopyTradingTab />
      case 'ideas':
        return <TradeIdeasTab />
      case 'comments':
        return <CommentsTab />
      default:
        return null
    }
  }

  return (
    <Card className="w-full mb-4 border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Social Trading
          </CardTitle>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button
              variant={activeTab === 'leaderboard' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('leaderboard')}
              className="flex-1 sm:flex-none"
            >
              <Trophy className="h-4 w-4 mr-2" />
              Leaderboard
            </Button>
            <Button
              variant={activeTab === 'copy' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('copy')}
              className="flex-1 sm:flex-none"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Trading
            </Button>
            <Button
              variant={activeTab === 'ideas' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('ideas')}
              className="flex-1 sm:flex-none"
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              Ideas
            </Button>
            <Button
              variant={activeTab === 'comments' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('comments')}
              className="flex-1 sm:flex-none"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Discussion
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {renderTabContent()}
      </CardContent>
    </Card>
  )
}

function LeaderboardTab() {
  const leaderboardData = [
    { rank: 1, name: "CryptoWhale", profit: "+$12,450", winRate: "78%", roi: "+145%" },
    { rank: 2, name: "TrendSurfer", profit: "+$8,320", winRate: "72%", roi: "+98%" },
    { rank: 3, name: "PipsHunter", profit: "+$6,100", winRate: "68%", roi: "+76%" },
    { rank: 4, name: "AlphaSeeker", profit: "+$4,890", winRate: "65%", roi: "+54%" },
    { rank: 5, name: "SteadyGains", profit: "+$3,200", winRate: "62%", roi: "+41%" },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
          <tr>
            <th className="px-4 py-3 rounded-tl-lg">Rank</th>
            <th className="px-4 py-3">Trader</th>
            <th className="px-4 py-3 text-right">Profit</th>
            <th className="px-4 py-3 text-right">Win Rate</th>
            <th className="px-4 py-3 text-right rounded-tr-lg">ROI</th>
          </tr>
        </thead>
        <tbody>
          {leaderboardData.map((trader, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
              <td className="px-4 py-3 font-medium">
                {trader.rank === 1 ? <Trophy className="h-4 w-4 text-yellow-500" /> : 
                 trader.rank === 2 ? <Trophy className="h-4 w-4 text-gray-400" /> : 
                 trader.rank === 3 ? <Trophy className="h-4 w-4 text-amber-600" /> : 
                 <span className="pl-1">{trader.rank}</span>}
              </td>
              <td className="px-4 py-3 font-medium">{trader.name}</td>
              <td className="px-4 py-3 text-right text-profit">{trader.profit}</td>
              <td className="px-4 py-3 text-right">{trader.winRate}</td>
              <td className="px-4 py-3 text-right text-profit font-semibold">{trader.roi}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CopyTradingTab() {
  const topTraders = [
    { name: "CryptoWhale", rating: 4.9, followers: "12.5k", risk: "High", minCopy: "$500" },
    { name: "TrendSurfer", rating: 4.7, followers: "8.2k", risk: "Medium", minCopy: "$200" },
    { name: "SteadyGains", rating: 4.8, followers: "15.1k", risk: "Low", minCopy: "$100" },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {topTraders.map((trader, i) => (
        <div key={i} className="p-4 border rounded-lg bg-card/50 hover:bg-card transition-colors">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="font-bold text-base">{trader.name}</h4>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 mr-1" />
                {trader.rating} • {trader.followers} followers
              </div>
            </div>
            <div className={`text-xs px-2 py-1 rounded-full ${
              trader.risk === 'Low' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              trader.risk === 'Medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {trader.risk} Risk
            </div>
          </div>
          <div className="flex justify-between items-center mt-4 pt-4 border-t">
            <div className="text-xs text-muted-foreground">
              Min: <span className="font-semibold text-foreground">{trader.minCopy}</span>
            </div>
            <Button size="sm" className="gap-1 h-8">
              <Copy className="h-3 w-3" /> Copy
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function TradeIdeasTab() {
  const ideas = [
    { author: "ChartMaster", asset: "Volatility 100", direction: "Long", timeAgo: "2h ago", text: "Breaking out of descending triangle on 1H timeframe. Target 1500 points." },
    { author: "PipsHunter", asset: "Crash 500", direction: "Short", timeAgo: "4h ago", text: "Approaching major resistance level. Expecting a strong spike down soon." },
    { author: "AlphaSeeker", asset: "Boom 1000", direction: "Long", timeAgo: "5h ago", text: "RSI oversold on 15m. Good opportunity for a quick spike catch." },
  ]

  return (
    <div className="space-y-4">
      {ideas.map((idea, i) => (
        <div key={i} className="p-3 border rounded-lg bg-card/50">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{idea.author}</span>
              <span className="text-xs text-muted-foreground">• {idea.timeAgo}</span>
            </div>
            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded font-medium ${
              idea.direction === 'Long' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {idea.direction === 'Long' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {idea.asset} {idea.direction}
            </div>
          </div>
          <p className="text-sm text-foreground/90">{idea.text}</p>
        </div>
      ))}
    </div>
  )
}

function CommentsTab() {
  const comments = [
    { user: "TraderJoe", asset: "Volatility 75", text: "V75 is very choppy today, waiting for clear trend.", time: "10m ago" },
    { user: "SarahTrades", asset: "Crash 1000", text: "Just caught a massive spike! Anyone else in on that?", time: "25m ago" },
    { user: "MikePro", asset: "Step Index", text: "Support at 8200 holding strong on Step Index.", time: "1h ago" },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4">
        <input 
          type="text" 
          placeholder="Share your thoughts on an asset..." 
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button size="sm">Post</Button>
      </div>
      
      <div className="space-y-3">
        {comments.map((comment, i) => (
          <div key={i} className="pb-3 border-b last:border-0 last:pb-0">
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{comment.user}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{comment.asset}</span>
              </div>
              <span className="text-xs text-muted-foreground">{comment.time}</span>
            </div>
            <p className="text-sm">{comment.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

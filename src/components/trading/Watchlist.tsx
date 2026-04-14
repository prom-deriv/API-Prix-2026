import { useState, useEffect } from "react"
import { useTradingStore } from "../../stores/tradingStore"
import { Card, CardContent } from "../ui/card"
import { Button } from "../ui/button"
import { Star, X, Plus } from "lucide-react"

export default function Watchlist() {
  const { symbols, currentSymbol, setCurrentSymbol } = useTradingStore()
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const saved = localStorage.getItem("promo_watchlist")
    return saved ? JSON.parse(saved) : ["R_100", "R_50", "1HZ100V"]
  })

  useEffect(() => {
    localStorage.setItem("promo_watchlist", JSON.stringify(watchlist))
  }, [watchlist])

  const toggleWatchlist = (symbol: string) => {
    if (watchlist.includes(symbol)) {
      setWatchlist(watchlist.filter(s => s !== symbol))
    } else {
      if (watchlist.length < 5) {
        setWatchlist([...watchlist, symbol])
      }
    }
  }

  const isCurrentInWatchlist = watchlist.includes(currentSymbol)

  return (
    <Card className="border shadow-sm mb-4">
      <div className="border-b bg-muted/20 p-2 px-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-muted-foreground fill-current text-yellow-500" />
          <span className="text-sm font-medium text-muted-foreground">Watchlist</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => toggleWatchlist(currentSymbol)}
          disabled={!isCurrentInWatchlist && watchlist.length >= 5}
        >
          {isCurrentInWatchlist ? (
            <><X className="h-3 w-3 mr-1" /> Remove Current</>
          ) : (
            <><Plus className="h-3 w-3 mr-1" /> Add Current</>
          )}
        </Button>
      </div>
      <CardContent className="p-2">
        {watchlist.length === 0 ? (
          <p className="text-xs text-center text-muted-foreground py-2">No symbols in watchlist.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {watchlist.map(sym => {
              const symbolData = symbols.find(s => s.symbol === sym)
              const displayName = symbolData ? symbolData.display_name : sym
              return (
                <Button
                  key={sym}
                  variant={currentSymbol === sym ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setCurrentSymbol(sym)}
                >
                  {displayName}
                </Button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

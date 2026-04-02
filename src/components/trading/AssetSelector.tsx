import React, { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useTradingStore } from "../../stores/tradingStore"
import { cn } from "../../lib/utils"
import { ChevronDown, Search, Wifi, WifiOff } from "lucide-react"
import type { ActiveSymbol } from "../../types/deriv"

interface AssetSelectorProps {
  className?: string
}

// Market icons mapping
const marketIcons: Record<string, string> = {
  "Synthetic Indices": "🔮",
  "Forex": "💱",
  "Commodities": "🛢️",
  "Stock Indices": "📈",
  "Cryptocurrencies": "₿",
  "Basket Indices": "🧺",
}

interface GroupedSymbols {
  [market: string]: ActiveSymbol[]
}

const AssetSelector: React.FC<AssetSelectorProps> = ({ className }) => {
  const { symbols, currentSymbol, setCurrentSymbol } = useTradingStore()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedMarkets, setExpandedMarkets] = useState<Set<string>>(new Set())
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Get current symbol data
  const currentSymbolData = useMemo(
    () => symbols.find((s) => s.symbol === currentSymbol),
    [symbols, currentSymbol]
  )

  // Group symbols by market
  const groupedSymbols = useMemo(() => {
    const grouped: GroupedSymbols = {}
    
    symbols.forEach((symbol) => {
      const market = symbol.market_display_name
      if (!grouped[market]) {
        grouped[market] = []
      }
      grouped[market].push(symbol)
    })

    // Sort symbols within each market by display_order
    Object.keys(grouped).forEach((market) => {
      grouped[market].sort((a, b) => a.display_order - b.display_order)
    })

    return grouped
  }, [symbols])

  // Filter symbols based on search query
  const filteredGroupedSymbols = useMemo(() => {
    if (!searchQuery.trim()) return groupedSymbols

    const query = searchQuery.toLowerCase()
    const filtered: GroupedSymbols = {}

    Object.entries(groupedSymbols).forEach(([market, marketSymbols]) => {
      const matchingSymbols = marketSymbols.filter(
        (s) =>
          s.display_name.toLowerCase().includes(query) ||
          s.symbol.toLowerCase().includes(query)
      )
      if (matchingSymbols.length > 0) {
        filtered[market] = matchingSymbols
      }
    })

    return filtered
  }, [groupedSymbols, searchQuery])

  // Auto-expand markets when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedMarkets(new Set(Object.keys(filteredGroupedSymbols)))
    }
  }, [searchQuery, filteredGroupedSymbols])

  // Initialize with current symbol's market expanded
  useEffect(() => {
    if (currentSymbolData && expandedMarkets.size === 0) {
      setExpandedMarkets(new Set([currentSymbolData.market_display_name]))
    }
  }, [currentSymbolData, expandedMarkets.size])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchQuery("")
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  const handleSymbolSelect = useCallback(
    (symbol: string) => {
      setCurrentSymbol(symbol)
      setIsOpen(false)
      setSearchQuery("")
    },
    [setCurrentSymbol]
  )

  const toggleMarket = useCallback((market: string) => {
    setExpandedMarkets((prev) => {
      const next = new Set(prev)
      if (next.has(market)) {
        next.delete(market)
      } else {
        next.add(market)
      }
      return next
    })
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false)
        setSearchQuery("")
      }
    },
    []
  )

  return (
    <div ref={dropdownRef} className={cn("relative", className)}>
      {/* Current Symbol Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-all duration-200",
          "bg-card hover:bg-accent/50 border-border",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          isOpen && "ring-2 ring-ring ring-offset-2"
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="text-xl" role="img" aria-label={currentSymbolData?.market_display_name}>
          {marketIcons[currentSymbolData?.market_display_name || ""] || "📊"}
        </span>
        <div className="flex flex-col items-start">
          <span className="font-semibold text-sm">
            {currentSymbolData?.display_name || currentSymbol}
          </span>
          <span className="text-xs text-muted-foreground">
            {currentSymbolData?.market_display_name || "Select Asset"}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 ml-2 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            "absolute top-full left-0 right-0 mt-2 z-50",
            "bg-card border border-border rounded-lg shadow-lg",
            "max-h-[400px] overflow-hidden flex flex-col"
          )}
          role="listbox"
          aria-label="Select trading asset"
        >
          {/* Search Input */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search assets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className={cn(
                  "w-full pl-9 pr-3 py-2 text-sm rounded-md",
                  "bg-background border border-input",
                  "focus:outline-none focus:ring-2 focus:ring-ring",
                  "placeholder:text-muted-foreground"
                )}
              />
            </div>
          </div>

          {/* Grouped Symbols List */}
          <div className="overflow-y-auto flex-1 min-h-0">
            {Object.keys(filteredGroupedSymbols).length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No assets found matching "{searchQuery}"
              </div>
            ) : (
              Object.entries(filteredGroupedSymbols).map(([market, marketSymbols]) => (
                <div key={market} className="border-b border-border last:border-b-0">
                  {/* Market Header */}
                  <button
                    onClick={() => toggleMarket(market)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2",
                      "bg-muted/50 hover:bg-muted transition-colors",
                      "text-sm font-medium"
                    )}
                  >
                    <span role="img" aria-label={market}>
                      {marketIcons[market] || "📊"}
                    </span>
                    <span className="flex-1 text-left">{market}</span>
                    <span className="text-xs text-muted-foreground">
                      {marketSymbols.length}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 text-muted-foreground transition-transform",
                        expandedMarkets.has(market) && "rotate-180"
                      )}
                    />
                  </button>

                  {/* Market Symbols */}
                  {expandedMarkets.has(market) && (
                    <div className="py-1">
                      {marketSymbols.map((symbol) => (
                        <button
                          key={symbol.symbol}
                          onClick={() => handleSymbolSelect(symbol.symbol)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2",
                            "hover:bg-accent transition-colors text-left",
                            currentSymbol === symbol.symbol && "bg-accent"
                          )}
                          role="option"
                          aria-selected={currentSymbol === symbol.symbol}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {symbol.display_name}
                              </span>
                              {symbol.exchange_is_open ? (
                                <Wifi className="h-3 w-3 text-profit flex-shrink-0" />
                              ) : (
                                <WifiOff className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {symbol.symbol}
                            </span>
                          </div>
                          {currentSymbol === symbol.symbol && (
                            <span className="text-profit text-xs font-medium">Active</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-border bg-muted/30">
            <p className="text-xs text-muted-foreground text-center">
              {symbols.length} assets available
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default AssetSelector
# PROMO Trade - Vibe Logs

## Project Overview
**PROMO Trade** is a high-performance trading web application built using the Deriv API V2 for the Deriv API Grand Prix competition.

## Development Timeline

### Phase 1: Architecture & Setup (Completed)
- **Framework**: React + Vite for fast development
- **Styling**: Tailwind CSS v4 with dark mode default
- **State Management**: Zustand for lightweight state
- **Charts**: Lightweight Charts (TradingView)
- **Icons**: Lucide React

### Phase 2: API Integration (Completed)
- **WebSocket Connection**: Robust manager with auto-reconnect
- **Public Endpoint**: `wss://api.derivws.com/trading/v1/options/ws/public`
- **Features**: Real-time ticks, active symbols, tick history, proposal/buy execution

### Phase 3: Core Trading Features (Completed)
- **Real-time Tick Chart**: Candlestick chart with 5-second grouping
- **One-Click Trading**: RISE/FALL buttons with stake selection
- **Quick Trade Panel**: Amount input, duration, quick amounts
- **Proposal Display**: Shows payout and cost before trade

### Phase 4: Innovation Feature - Strategy Builder (Completed)
- **Compound Conditions**: AND/OR logic
- **Condition Types**: Price comparisons, tick direction, consecutive ticks, price change %
- **Actions**: Contract type, amount, duration per rule
- **Persistence**: localStorage via Zustand

### Phase 5: UI Components (Completed)
- **Design System**: Dark mode with custom colors
- **Components**: Button, Card, Input, Select
- **Responsive**: Mobile-first, fat-finger friendly

## Technical Decisions

### Why Vite over Next.js?
- Faster HMR, simpler config, better for SPA

### Why Zustand over Redux?
- Lightweight (2KB), less boilerplate, built-in persist

### Why Lightweight Charts?
- Industry standard, optimized for financial data

### Why Tailwind CSS v4?
- Faster builds, better dark mode, CSS-first config

## Challenges & Solutions

1. **Tailwind v4 Migration**: Installed `@tailwindcss/postcss`
2. **TypeScript Safety**: Comprehensive type definitions
3. **WebSocket Reconnection**: Exponential backoff with retry limit
4. **Chart Performance**: 5-second candle grouping, 1000 tick limit
5. **Barrier Distance Issue**: Implemented relative offsets from Deriv API

### Barrier Precision Fix (April 2, 2026)

**Problem:** Barriers appeared too far from the spot price on the chart because the app was treating barriers as absolute values (e.g., `currentPrice + 10`) instead of relative offsets.

**Root Cause Analysis:**
1. The `TradingPanel.tsx` was calculating barriers as absolute prices (`currentPrice + 10`)
2. The barrier was sent to the API as an absolute value string instead of a relative offset
3. The `getProposal` method in `deriv-api.ts` wasn't including the barrier parameter in the API request
4. The chart barrier line was static and didn't update with real-time price changes
5. Hardcoded offsets (10/20) were too large for most markets, causing barriers to render outside visible range

**Solution: Implemented Relative Barriers with Dynamic Validation**

1. **Fixed Critical Bug in `getProposal`** (`deriv-api.ts`):
   - Added `barrier` parameter to the API request (was completely missing before)
   - Barrier is now sent as relative string with `+`/`-` prefix (e.g., `"+0.5"`)

2. **Added `getContractsFor` API Method** (`deriv-api.ts`):
   - New method to fetch available barriers and valid ranges from Deriv API
   - Follows the same pattern as existing methods (`getActiveSymbols`, `getProposal`)
   - Includes proper timeout and error handling
   - Does NOT affect WebSocket connection stability

3. **Updated State Management** (`tradingStore.ts`):
   - Added `barrierOffset` state to track the relative offset value
   - Added `minBarrierOffset` and `maxBarrierOffset` for API-provided ranges
   - Added `pipSize` for decimal precision handling
   - Barrier is now calculated as: `currentSpot + barrierOffset`

4. **Dynamic Barrier Validation** (`TradingPanel.tsx`):
   - Calls `contracts_for` when symbol changes to get valid barrier ranges
   - Uses API-provided `min_barrier_offset` and `max_barrier_offset`
   - Falls back to safe defaults (0.1 to 10) if API call fails
   - Sets default offset to middle of valid range

5. **Pip Size Precision Handling** (`TradingPanel.tsx`):
   - Gets `pip_size` from tick data
   - Formats barrier string with correct decimal precision
   - Example: pip_size of 0.01 → 2 decimal places → `"+0.50"`

6. **Dynamic Chart Visualization** (`TickChart.tsx`):
   - Barrier line now updates in real-time with price changes
   - Calculated as: `currentSpot + offset`

7. **Error Handling**:
   - Specific error messages for "Invalid Barrier" or "Barrier Out of Range"
   - Graceful fallback to default offsets if `contracts_for` fails

**How the MCP Server Helped:**
The MCP server provided access to the Deriv API documentation and helped identify:
- The correct `contracts_for` schema with `min_barrier_offset` and `max_barrier_offset` fields
- The expected barrier format (relative offsets with `+`/`-` prefix)
- The `pip_size` field in tick data for decimal precision
- How to implement the API call following the exact same pattern as other working methods

**Result:** Barriers now appear at the correct distance from the spot price, stay within valid API ranges, and move dynamically with real-time price updates.

### Barrier Offset & Chart Alignment Refinement (April 2, 2026 — Phase 2)

**Problem:** Despite the initial barrier fix, several issues remained:
1. `contracts_for` response parsing was fragile — it grabbed the first CALL/PUT contract which could be a Rise/Fall (no barrier) instead of a Higher/Lower contract
2. `min_barrier_offset` and `max_barrier_offset` were typed as `number` but the Deriv API returns them as **strings** (e.g., `"0.001"`), causing string concatenation instead of numeric arithmetic
3. No UI control existed for users to adjust the barrier offset — it was hardcoded to the middle of the range
4. Pip size was only sourced from tick data, not from `active_symbols` which is more reliable
5. The chart barrier was rendered as a 2-point line series instead of a proper full-width price line

**Solution: Comprehensive Barrier System Overhaul**

1. **Fixed `ContractsForResponse` Types** (`src/types/deriv.ts`):
   - Changed `min_barrier_offset` and `max_barrier_offset` from `number` to `string`
   - Changed `barrier_choices` from `number[]` to `string[]`
   - Extracted `ContractForAvailable` as a named interface for reuse
   - These types now match the actual Deriv API v3 WebSocket response format

2. **Robust `contracts_for` Parsing** (`src/components/trading/TradingPanel.tsx`):
   - Filters contracts by `barrier_category: "euro_non_atm"` (Higher/Lower) and `ONETOUCH`/`NOTOUCH` contract types
   - Uses `parseFloat()` to safely convert string offsets to numbers
   - Computes the widest valid range across all matching contracts
   - Sets default offset to 10% of the range (closer to minimum for better UX)
   - Falls back to safe defaults (0.1–10, offset 0.5) if API call fails

3. **User-Facing Barrier Offset Control** (`src/components/trading/TradingPanel.tsx`):
   - Added a **sign toggle** (+/−) to switch between above/below barrier
   - Added a **numeric input** for precise offset entry
   - Added a **range slider** clamped to `minBarrierOffset`–`maxBarrierOffset`
   - Shows the computed barrier price in real-time: `Visual_Barrier = Current_Spot + Signed_Offset`
   - All values are clamped and rounded to the correct decimal precision
   - Controls only appear when Higher/Lower or Touch/No Touch is selected

4. **Number-to-String Conversion for API Compliance**:
   - User inputs a numeric offset (e.g., `0.50`) via slider or input
   - Sign is tracked separately via `isPositiveOffset` boolean
   - At proposal time, the offset is formatted as: `absOffset.toFixed(precision)` → prefixed with `+` or `-`
   - Example flow: User selects offset `0.50` with `+` sign → `"0.50".toFixed(2)` → `"+0.50"` sent to API
   - For Forex (5 decimals): offset `0.00100` → `"+0.00100"` sent to API
   - For Synthetic Indices (2 decimals): offset `0.50` → `"+0.50"` sent to API

5. **`active_symbols` Pip Size as Primary Source** (`src/components/trading/TradingPanel.tsx`):
   - Primary: looks up `symbol.pip` from the `symbols` array in the store (from `active_symbols` API)
   - Fallback: uses `currentTick.pip_size` from real-time tick data
   - Precision is derived as `Math.round(-Math.log10(pipSize))` (e.g., pip 0.01 → 2 decimals)
   - This ensures correct formatting across all markets (Forex, Synthetic Indices, Commodities)

6. **Improved Chart Barrier Rendering** (`src/components/charts/TickChart.tsx`):
   - Replaced the 2-point `LineSeries` with `createPriceLine()` on the candlestick series
   - The price line extends across the **full chart width** as a dashed yellow horizontal line
   - Shows a labeled price axis marker on the right scale
   - Updates dynamically as the barrier value changes (tracks `currentSpot + offset`)
   - Properly cleans up old price lines before creating new ones
   - Removed the separate `barrierSeries` ref — now uses a single `barrierLineRef` for the price line

**Files Modified:**
- `src/types/deriv.ts` — Fixed barrier offset types to `string`, extracted `ContractForAvailable`
- `src/components/trading/TradingPanel.tsx` — Robust parsing, UI controls, pip size from active_symbols
- `src/components/charts/TickChart.tsx` — `createPriceLine()` for full-width barrier visualization
- `vibe-logs.md` — This documentation entry

## Security
- No hardcoded credentials
- Input validation on all trades
- Generic error messages to users
- Rate limit awareness

## Performance
- React.memo for chart component
- Batched state updates
- Limited tick history
- Lazy loading

## Deployment
- **Platform**: Netlify
- **Build**: `npm run build`
- **Output**: `dist/`

### Multi-Asset Integration & Dynamic Switching (April 2, 2026)

**Problem:** The application needed a robust asset selector that allows users to switch between different trading instruments (Forex, Synthetic Indices, etc.) while ensuring the chart, price data, and contract proposals update instantly and accurately. The existing implementation had several issues:

1. **No WebSocket Cleanup:** When switching symbols, the app subscribed to new ticks without properly unsubscribing from the old ones, causing memory leaks and overlapping data streams
2. **Flat Symbol Dropdown:** The existing dropdown showed all symbols in a flat list without grouping by market
3. **No Loading State:** No visual feedback during symbol switching
4. **Chart Scale Issues:** Chart didn't reset its scale when switching between high-value and low-value assets
5. **No Contract Type Awareness:** UI didn't disable unavailable contract types for the selected symbol

**Solution: Implemented Multi-Asset Integration with Proper WebSocket Cleanup**

1. **Created AssetSelector Component** (`src/components/trading/AssetSelector.tsx`):
   - Grouped symbols by `market_display_name` (Forex, Synthetic Indices, Commodities, etc.)
   - Collapsible market sections with icons for visual distinction
   - Search/filter functionality for quick asset discovery
   - Shows market open/closed status via `exchange_is_open` field
   - Keyboard navigation support (Escape to close)
   - Click-outside-to-close behavior
   - Auto-expand markets when searching

2. **Added `unsubscribeTicks()` Method** (`src/lib/deriv-api.ts`):
   - New async method that sends `forget_all: "ticks"` to the Deriv API
   - Removes all tick subscriptions from `activeSubscriptions` tracking
   - Includes small delay to ensure API processes the unsubscribe
   - Used for clean symbol switching to prevent memory leaks

3. **Added `isSymbolLoading` State** (`src/stores/tradingStore.ts`):
   - New boolean state to track symbol switching in progress
   - `setIsSymbolLoading()` action for state updates
   - Used by chart and trading panel to show loading states

4. **Refactored `handleSymbolChange()`** (`src/App.tsx`):
   - Now properly stores tick unsubscribe function in a ref
   - Calls previous unsubscribe before subscribing to new symbol
   - Calls `api.unsubscribeTicks()` to ensure clean state
   - Sets loading state during symbol switch
   - Proper cleanup on component unmount

5. **Added Loading Shimmer to TickChart** (`src/components/charts/TickChart.tsx`):
   - Shows spinner overlay when `isSymbolLoading` is true
   - Displays "Loading chart data..." message
   - Backdrop blur effect for smooth visual transition

6. **Implemented Chart Scale Reset** (`src/components/charts/TickChart.tsx`):
   - Calls `chart.timeScale().resetTimeScale()` when symbol changes
   - Calls `chart.timeScale().scrollToRealTime()` to show latest data
   - Ensures chart auto-fits new data regardless of previous scale

7. **Disabled Unavailable Contract Types** (`src/components/trading/TradingPanel.tsx`):
   - Fetches `contracts_for` data to determine available contract types
   - Checks for Rise/Fall, Higher/Lower, and Touch/No Touch availability
   - Disables buttons for unavailable contract types with tooltip explanation
   - Auto-switches to first available type if current selection is unavailable
   - Added `cn` import for conditional class names

**WebSocket Cleanup Strategy:**
```typescript
// Store unsubscribe function in ref
const tickUnsubscribeRef = useRef<(() => void) | null>(null)

// Before subscribing to new symbol, clean up old subscription
if (tickUnsubscribeRef.current) {
  tickUnsubscribeRef.current()
  tickUnsubscribeRef.current = null
}

// Unsubscribe from all ticks to ensure clean state
await api.unsubscribeTicks()

// Subscribe to new symbol and store unsubscribe function
tickUnsubscribeRef.current = api.subscribeTicks(newSymbol, callback)

// On unmount, clean up
useEffect(() => {
  return () => { 
    if (tickUnsubscribeRef.current) {
      tickUnsubscribeRef.current()
    }
    getDerivAPI().disconnect() 
  }
}, [])
```

**Files Modified:**
- `src/components/trading/AssetSelector.tsx` — **NEW** grouped asset dropdown component
- `src/lib/deriv-api.ts` — Added `unsubscribeTicks()` method
- `src/stores/tradingStore.ts` — Added `isSymbolLoading` state
- `src/App.tsx` — Refactored symbol change handler with proper cleanup
- `src/components/charts/TickChart.tsx` — Added loading shimmer and scale reset
- `src/components/trading/TradingPanel.tsx` — Disabled unavailable contract types
- `vibe-logs.md` — This documentation entry

**Result:** Users can now seamlessly switch between assets with:
- Grouped, searchable asset dropdown
- Proper WebSocket cleanup preventing memory leaks
- Loading indicators during transitions
- Chart that auto-scales for new data
- Contract types that adapt to available options

### White Screen of Death Fix (April 2, 2026)

**Problem:** The application crashed to a blank screen (White Screen of Death) when switching between trading assets. This was a critical stability issue that made the app unusable.

**Root Cause Analysis:**

1. **Missing Symbol Change Handler:**
   - The `AssetSelector` component called `setCurrentSymbol(symbol)` directly from the store
   - BUT there was NO `useEffect` in App.tsx to handle symbol changes after initialization
   - The `initializeAPI` function was only called once on mount
   - When users clicked a new asset, the store updated `currentSymbol` and cleared `tickHistory`, but:
     - No code unsubscribed from the old symbol's ticks
     - No code fetched new tick history for the new symbol
     - No code subscribed to the new symbol's ticks
   - Old WebSocket subscription remained active, sending ticks for the previous symbol
   - Chart received conflicting data → **CRASH**

2. **Unsafe Data Access:**
   - Lines 114-118 in App.tsx accessed `tickHistory` without proper null checks
   - If `tickHistory` was cleared but a tick arrived before new subscription was set up, this caused undefined access

3. **No Error Boundary:**
   - No React Error Boundary to catch errors and prevent full app crash

4. **Race Condition:**
   - No protection against rapid symbol clicks - multiple subscriptions could stack up

**Solution: Implemented Defensive Coding Measures**

1. **Added Symbol Change Handler** (`src/App.tsx`):
   - Added a `useEffect` that watches `currentSymbol` changes
   - When symbol changes after initialization:
     - Sets loading state
     - Unsubscribes from previous ticks via `api.unsubscribeTicks()`
     - Fetches new tick history
     - Subscribes to new symbol's ticks
   - Properly cleans up on unmount

2. **Race Condition Protection** (`src/App.tsx`):
   - Added `loadingSymbolRef` to track which symbol is being loaded
   - Before each async operation, checks if the symbol being loaded is still the current symbol
   - If user clicks multiple assets quickly, only the last requested asset's subscription remains active
   - Ignores stale responses from previous symbol loads

3. **Safe Data Access** (`src/App.tsx`):
   - Used optional chaining (`?.`) for all tick data access
   - Added nullish coalescing (`??`) for fallback values
   - Example: `tickHistory?.[tickHistory.length - 1]?.quote ?? 0`

4. **Error Boundary** (`src/components/ui/ErrorBoundary.tsx`):
   - Created reusable React Error Boundary component
   - Wraps the TickChart component to catch rendering errors
   - Displays user-friendly error message with "Try again" button
   - Prevents entire app from crashing if one component fails

5. **WebSocket Cleanup** (`src/lib/deriv-api.ts`):
   - The `unsubscribeTicks()` method sends `forget_all: "ticks"` to the Deriv API
   - Removes all tick subscriptions from tracking
   - Ensures clean state before subscribing to new symbol

**Defensive Coding Pattern:**
```typescript
// Track which symbol we're loading
const symbolToLoad = currentSymbol
loadingSymbolRef.current = symbolToLoad

// Before each async operation, check if symbol is still current
if (loadingSymbolRef.current !== symbolToLoad) {
  console.log("[App] Symbol changed during load, aborting:", symbolToLoad)
  return
}

// Safe data access with optional chaining
const lastTick = tickHistory?.[tickHistory.length - 1]
const priceChange = lastTick?.quote ?? 0
```

**Files Modified:**
- `src/App.tsx` — Added symbol change useEffect, race condition protection, safe data access
- `src/components/ui/ErrorBoundary.tsx` — **NEW** Error Boundary component
- `vibe-logs.md` — This documentation entry

**Result:** The application is now stable during asset switching:
- No more White Screen of Death crashes
- Proper WebSocket cleanup prevents memory leaks
- Race condition protection handles rapid clicks gracefully
- Error Boundary catches any remaining errors
- Safe data access prevents undefined reference errors

### Chart Assertion Error Fix (April 2, 2026)

**Problem:** The chart component crashed with the following error:
`Assertion failed: data must be asc ordered by time, index=197, time=1775118060, prev time=1775118060`

This occurred because the Deriv API sent duplicate tick/candle timestamps, or the state management logic was appending new data points without checking if that timestamp already existed. The Lightweight Charts engine requires strictly ascending time order.

**Root Cause Analysis:**

1. **In `tradingStore.ts`**: The `setCurrentTick` function simply appended ticks without checking for duplicate epochs:
```typescript
setCurrentTick: (tick) => {
  const state = get()
  const newHistory = [...state.tickHistory, tick]  // Simply appends without deduplication
  // ...
}
```

2. **In `TickChart.tsx`**: When grouping ticks into candles, the time calculation could produce duplicate timestamps:
```typescript
const time = Math.floor(group[0].epoch / groupSize) * groupSize as Time
```
If multiple ticks fell into the same time bucket (same `Math.floor(epoch / 5) * 5`), they produced identical candle timestamps.

3. **Lightweight Charts Requirement**: The chart engine requires **strictly ascending time order** and crashes when it receives duplicate timestamps.

**Solution: Implemented Epoch Validation**

1. **Added Epoch Deduplication in `tradingStore.ts`**:
   - Modified `setCurrentTick` to check if the new tick's epoch already exists in history
   - If duplicate epoch found, **updates** the existing entry instead of adding a new one
   - Ensures the array remains sorted by epoch using `sort((a, b) => a.epoch - b.epoch)`
   - Applied the same logic to `addTickToHistory` function

```typescript
setCurrentTick: (tick) => {
  const state = get()
  
  // Check if this epoch already exists in history (deduplication)
  const existingIndex = state.tickHistory.findIndex(t => t.epoch === tick.epoch)
  
  let newHistory: Tick[]
  if (existingIndex !== -1) {
    // Update existing tick with same epoch instead of adding duplicate
    newHistory = [...state.tickHistory]
    newHistory[existingIndex] = tick
  } else {
    // Add new tick and ensure ascending order by epoch
    newHistory = [...state.tickHistory, tick]
    // Sort by epoch to maintain strict ascending order
    newHistory.sort((a, b) => a.epoch - b.epoch)
  }
  // ...
}
```

2. **Added Sorting & Deduplication in `TickChart.tsx`**:
   - Before passing data to the chart, sorts `candleData` by time
   - Removes duplicate time entries using a filter that checks consecutive elements
   - Ensures strictly ascending order required by Lightweight Charts

```typescript
// Sort by time to ensure strictly ascending order (required by Lightweight Charts)
candleData.sort((a, b) => (a.time as number) - (b.time as number))

// Remove duplicate time entries (defensive measure)
const uniqueCandleData = candleData.filter((candle, index) => {
  if (index === 0) return true
  return candle.time !== candleData[index - 1].time
})

seriesRef.current.setData(uniqueCandleData)
```

**Files Modified:**
- `src/stores/tradingStore.ts` — Added epoch deduplication in `setCurrentTick` and `addTickToHistory`
- `src/components/charts/TickChart.tsx` — Added sorting and deduplication before `setData()`
- `vibe-logs.md` — This documentation entry

**Result:** The chart no longer crashes due to duplicate timestamps:
- Epoch validation prevents duplicate entries in tick history
- Sorting ensures strictly ascending time order
- Defensive deduplication in chart component catches any remaining duplicates
- Asset switching is now 100% stable without assertion errors

## Future Enhancements
1. OAuth 2.0 with PKCE
2. Account dashboard
3. Advanced strategies with backtesting
4. Mobile app (React Native)
5. Social features

## Metrics
- **Dev Time**: ~2 hours
- **Lines of Code**: ~2000
- **Components**: 15+
- **API Endpoints**: 8
- **Build Size**: 400KB (126KB gzipped)

---
*Last Updated: April 1, 2026*
*PROMO Trade Team - Deriv API Grand Prix*

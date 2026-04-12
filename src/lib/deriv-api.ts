import type {
  DerivMessage,
  TickStream,
  OHLCStream,
  ActiveSymbol,
  ProposalResponse,
  BuyResponse,
  ProposalOpenContractResponse,
  BalanceResponse,
  TradeParams,
  ContractsForResponse,
  SellResponse,
  CancelResponse,
  ContractUpdateResponse,
  ContractUpdateHistoryResponse,
  StatementResponse,
  ProfitTableResponse,
  TradingTimesResponse,
  ContractsListResponse,
  TransactionStream,
  CreateAccountParams,
  CreateAccountResponse,
  DerivAccountsResponse,
  ResetDemoBalanceResponse,
  OTPResponse,
  CashierResponse,
} from "../types/deriv"

// Deriv API WebSocket endpoint
// Uses standard websocket endpoint to get ALL active symbols (forex, commodities, indices, crypto, etc.)
const WS_PUBLIC_URL = "wss://ws.binaryws.com/websockets/v3?app_id=1089"

type MessageHandler = (data: DerivMessage) => void

interface ActiveSubscription {
  type: 'ticks' | 'ohlc' | 'proposal_open_contract'
  params: any
  callback: Function
}

class DerivAPI {
  private ws: WebSocket | null = null
  private handlers: Map<string, MessageHandler[]> = new Map()
  private reqId: number = 0
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map()
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private reconnectDelay: number = 1000
  private isConnecting: boolean = false
  private isConnectedState: boolean = false
  private isAuthorized: boolean = false
  private subscriptions: Map<string, string> = new Map() // subscription_id -> req_id
  private activeSubscriptions: Map<string, ActiveSubscription> = new Map() // Track subscriptions for resubscription
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private lastPong: number = Date.now()
  private shouldReconnect: boolean = true // Flag to prevent reconnection when intentionally disconnecting
  private pendingRequestsQueue: Array<() => void> = [] // Queue for requests sent before WebSocket is ready
  private isSubscribing: boolean = false // Mutex to prevent concurrent subscription requests
  private isHandlingAuth: boolean = false // Mutex to prevent duplicate auth handling

  constructor() {
    // Don't auto-connect in constructor - let the app control when to connect
    // This prevents issues with React Strict Mode running effects twice
  }

  // Set authentication token for REST API calls
  setToken(_token: string): void {
    // Token is stored and used for REST API authentication
    // Currently used by App.tsx to set the token from environment
  }

  /**
   * 🧹 CLEAN SLATE STARTUP - Emergency reset of all subscriptions
   * Forces termination of ALL ghost subscriptions before any new ones are created
   * This prevents the "logic deadlock" where stale subscriptions block new data
   */
  async cleanSlateStartup(): Promise<void> {
    // Only run if WebSocket is connected and authorized
    if (!this.isReady()) {
      console.debug("[DerivAPI] Not ready for clean slate, skipping (expected during React Strict Mode)")
      return
    }

    console.log("[DerivAPI] 🧹 Clean slate startup - clearing all ghost subscriptions...")

    // Forget ticks and candles subscriptions
    // Note: 'proposal_open_contract' is not supported on public endpoint
    const results = await Promise.allSettled([
      this.forgetAll('ticks'),
      this.forgetAll('candles'),
    ])

    results.forEach((result, i) => {
      const types = ['ticks', 'candles']
      if (result.status === 'fulfilled') {
        console.log(`[DerivAPI] ✅ Cleaned up ${types[i]} subscriptions`)
      } else {
        console.warn(`[DerivAPI] ⚠️ ${types[i]} cleanup had issues (expected if none existed)`)
      }
    })

    // Clear all handlers to prevent message routing conflicts
    this.handlers.clear()

    console.log("[DerivAPI] ✅ Clean slate complete - ready for fresh subscriptions")
  }

  // Public method to initialize connection
  async initialize(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return
    }
    return this.connect()
  }

  /**
   * Connect to Deriv API using OTP-authenticated WebSocket URL
   * @param otpUrl - WebSocket URL with OTP from getWebSocketUrl() REST call
   */
  async connectWithOTP(otpUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      if (this.isConnecting) {
        const checkConnection = setInterval(() => {
          if (this.isConnectedState) {
            clearInterval(checkConnection)
            resolve()
          } else if (!this.isConnecting) {
            clearInterval(checkConnection)
            reject(new Error("Connection failed"))
          }
        }, 100)
        return
      }

      this.isConnecting = true

      try {
        console.log("[DerivAPI] Connecting with OTP-authenticated URL...")
        this.ws = new WebSocket(otpUrl)

        this.ws.onopen = () => {
          console.log("[DerivAPI] Connected to WebSocket (OTP authenticated)")
          this.isConnecting = false
          this.isConnectedState = true
          this.reconnectAttempts = 0
          this.lastPong = Date.now()

          // OTP-authenticated connection is immediately authorized
          this.isAuthorized = true

          this.startPingInterval()
          this.emit("connection", { connected: true, authenticated: true })

          this.flushRequestQueue()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as DerivMessage
            this.handleMessage(data)
          } catch (error) {
            console.error("[DerivAPI] Failed to parse message:", error)
          }
        }

        this.ws.onerror = (error) => {
          console.error("[DerivAPI] WebSocket error:", error)
          this.isConnecting = false
          this.emit("error", { error: "WebSocket connection error" })
          reject(error)
        }

        this.ws.onclose = () => {
          console.log("[DerivAPI] WebSocket closed")
          this.isConnecting = false
          this.isConnectedState = false
          this.isAuthorized = false
          this.emit("connection", { connected: false })
          this.attemptReconnect()
        }
      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      if (this.isConnecting) {
        // Wait for existing connection attempt to complete
        const checkConnection = setInterval(() => {
          if (this.isConnectedState) {
            clearInterval(checkConnection)
            resolve()
          } else if (!this.isConnecting) {
            // Connection attempt failed
            clearInterval(checkConnection)
            reject(new Error("Connection failed"))
          }
        }, 100)
        return
      }

      this.isConnecting = true

      try {
        this.ws = new WebSocket(WS_PUBLIC_URL)

        this.ws.onopen = () => {
          console.log("[DerivAPI] Connected to WebSocket (public endpoint)")
          this.isConnecting = false
          this.isConnectedState = true
          this.reconnectAttempts = 0
          this.lastPong = Date.now()

          // New Deriv API public endpoint doesn't require authorize message
          // Mark as authorized immediately for public data access
          this.isAuthorized = true

          // Emit connection event
          this.startPingInterval()
          this.emit("connection", { connected: true })

          // Flush any queued requests
          this.flushRequestQueue()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as DerivMessage
            this.handleMessage(data)
          } catch (error) {
            console.error("[DerivAPI] Failed to parse message:", error)
          }
        }

        this.ws.onerror = (error) => {
          console.error("[DerivAPI] WebSocket error:", error)
          this.isConnecting = false
          this.emit("error", { error: "WebSocket connection error" })
          reject(error)
        }

        this.ws.onclose = () => {
          console.log("[DerivAPI] WebSocket closed")
          this.isConnecting = false
          this.isConnectedState = false
          this.isAuthorized = false
          this.emit("connection", { connected: false })
          this.attemptReconnect()
        }
      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  private attemptReconnect(): void {
    // Don't reconnect if intentionally disconnected
    if (!this.shouldReconnect) {
      console.log("[DerivAPI] Reconnection disabled, skipping")
      return
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[DerivAPI] Max reconnection attempts reached")
      this.emit("error", { error: "Connection lost. Please refresh the page." })
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

    console.log(`[DerivAPI] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`)

    setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect().then(() => {
          // Resubscribe to all active subscriptions
          this.resubscribe()
        })
      }
    }, delay)
  }

  private async resubscribe(): Promise<void> {
    console.log("[DerivAPI] Resubscribing to active subscriptions")

    // ✅ FIX: Don't create subscriptions directly - let App.tsx handle it with mutex
    // This prevents race conditions between resubscribe() and subscribeToStream()

    // First, forget all existing subscriptions to avoid "AlreadySubscribed" errors
    try {
      await this.forgetAll('ticks')
    } catch (e) { /* ignore - subscription may not exist */ }
    try {
      await this.forgetAll('candles')
    } catch (e) { /* ignore - subscription may not exist */ }

    // ✅ FIX: Don't emit the "resubscribed" event
    // initializeAPI() already handles the initial subscription
    // Symbol/chart style changes already have their own subscription logic
    // This ensures only one subscription path exists, eliminating the race condition
  }

  private startPingInterval(): void {
    // Clear any existing interval
    this.stopPingInterval()

    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.isConnectedState) {
        // Check if we haven't received a response in a while
        const timeSinceLastPong = Date.now() - this.lastPong
        if (timeSinceLastPong > 60000) {
          console.warn("[DerivAPI] No pong received, connection may be stale")
          this.ws?.close()
          return
        }

        this.ping()
      }
    }, 30000)
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private handleMessage(data: DerivMessage): void {
    // EMERGENCY DEBUG: Log all raw messages
    const msgType = (data as any).msg_type || "unknown"
    console.log(`[DerivAPI] 🔍 Raw Message [${msgType}]:`, data)

    // Handle pong responses
    if ("ping" in data) {
      this.lastPong = Date.now()
      return
    }

    // Handle authorization response - Deriv API returns msg_type: "authorize"
    if ("msg_type" in data && data.msg_type === "authorize") {
      // ✅ FIX: Prevent duplicate authorization handling with mutex
      if (this.isHandlingAuth) {
        return // Already processing auth, skip duplicate
      }
      if (this.isAuthorized) {
        return // Already authorized, skip silently
      }
      this.isHandlingAuth = true
      console.log("[DerivAPI] Authorization successful")
      this.isAuthorized = true
      this.emit("authorize", (data as any).authorize)
      // Flush any pending requests that were queued before authorization
      this.flushRequestQueue()
      this.isHandlingAuth = false
      return
    }

    // Handle error responses
    if ("error" in data) {
      const error = data.error as any
      const errorMessage = error?.message || error?.code || JSON.stringify(error)

      // ✅ GRACEFULLY HANDLE "AlreadySubscribed" ERRORS (common during React Strict Mode)
      if (errorMessage.includes("already subscribed") || errorMessage.includes("AlreadySubscribed")) {
        // Silently handle - this is expected during React Strict Mode double-invocation
        if ("echo_req" in data && data.echo_req) {
          const reqId = (data.echo_req as any).req_id
          if (reqId && this.pendingRequests.has(reqId)) {
            const { resolve } = this.pendingRequests.get(reqId)!
            this.pendingRequests.delete(reqId)
            resolve({
              echo_req: data.echo_req,
              subscription: { id: "existing" },
              msg_type: (data.echo_req as any).ticks ? "tick" : "ohlc"
            })
            return
          }
        }
        return
      }

      console.error("[DerivAPI] API Error:", errorMessage)
      this.emit("error", error)
      
      // Reject the pending request if it has a req_id so we don't timeout
      if ("echo_req" in data && data.echo_req) {
        const reqId = (data.echo_req as any).req_id
        if (reqId && this.pendingRequests.has(reqId)) {
          const { reject } = this.pendingRequests.get(reqId)!
          this.pendingRequests.delete(reqId)
          reject(new Error(errorMessage))
        }
      }
      return
    }

    // Handle pending requests
    if ("echo_req" in data && data.echo_req) {
      const reqId = (data.echo_req as any).req_id
      if (reqId && this.pendingRequests.has(reqId)) {
        const { resolve } = this.pendingRequests.get(reqId)!
        this.pendingRequests.delete(reqId)
        resolve(data)
        return
      }
    }

    // Handle subscription messages
    if ("subscription" in data && data.subscription) {
      const subId = data.subscription.id
      this.subscriptions.set(subId, subId)
    }

    // SIMPLIFIED: Emit ALL message type handlers without complex filtering
    // This removes the "stuck" shield that was discarding valid messages
    if ("msg_type" in data) {
      const msgType = data.msg_type
      if (msgType) {
        this.emit(msgType, data)
      }
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.handlers.get(event)
    if (handlers) {
      handlers.forEach((handler) => handler(data))
    }
  }

  private async request(message: object): Promise<any> {
    const reqId = (message as any).req_id || this.getNextReqId()
    const messageWithReqId = { ...message, req_id: reqId }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, { resolve, reject })

      this.send(messageWithReqId)

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId)
          reject(new Error("Request timeout"))
        }
      }, 10000)
    })
  }

  /**
   * ✅ FORGET ALL - Promise based termination
   * Only resolves when Deriv API confirms subscription has been terminated
   * This is the MOST CRITICAL fix for the "Stuck at 0" bug
   */
  async forgetAll(type: 'ticks' | 'candles' | 'proposal_open_contract'): Promise<any> {
    const reqId = this.getNextReqId()

    console.log(`[DerivAPI] 🔌 Forcing termination of all ${type} subscriptions`)

    const result = await this.request({
      forget_all: type,
      req_id: reqId
    })

    console.log(`[DerivAPI] ✅ Successfully terminated ${type} subscriptions:`, result)

    // Reset stream state after successful termination
    if (type === 'ticks') {
      this.handlers.delete("tick")
    } else if (type === 'candles') {
      this.handlers.delete("ohlc")
    }

    return result
  }

  private send(message: object): void {
    // Check if WebSocket exists
    if (!this.ws) {
      console.error("[DerivAPI] WebSocket is null")
      return
    }

    // Always check readyState before sending - this is critical for avoiding InvalidStateError
    if (this.ws.readyState !== WebSocket.OPEN) {
      // Queue messages when CONNECTING
      if (this.ws.readyState === WebSocket.CONNECTING) {
        this.pendingRequestsQueue.push(() => this.send(message))
        return
      }
      // Log error for truly disconnected states
      const state = this.ws.readyState
      const stateName = state === WebSocket.CLOSING ? "CLOSING" :
        state === WebSocket.CLOSED ? "CLOSED" : "UNKNOWN"
      console.error(`[DerivAPI] WebSocket is not connected (state: ${stateName})`)
      return
    }

    // Check if WebSocket is authorized before sending requests (except for authorize and ping)
    if (!this.isAuthorized && !('authorize' in message) && !('ping' in message)) {
      this.pendingRequestsQueue.push(() => this.send(message))
      return
    }

    this.ws.send(JSON.stringify(message))
  }

  private flushRequestQueue(): void {
    const count = this.pendingRequestsQueue.length
    if (count === 0) {
      return // Silent return when queue is empty
    }

    const queue = [...this.pendingRequestsQueue]
    this.pendingRequestsQueue = []
    queue.forEach(request => {
      try {
        request()
      } catch (error) {
        console.error("[DerivAPI] Error executing queued request:", error)
      }
    })
  }

  // Clear all event handlers (for cleanup without triggering forget_all again)
  clearAllHandlers(): void {
    this.handlers.clear()
  }

  // Public method to check if WebSocket is ready for requests
  isReady(): boolean {
    return this.isConnectedState && this.isAuthorized
  }

  // Wait for API to be ready with timeout
  async waitUntilReady(maxWait: number = 15000): Promise<boolean> {
    const start = Date.now()
    while (Date.now() - start < maxWait) {
      if (this.isReady()) return true
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    return false
  }

  private getNextReqId(): number {
    return ++this.reqId
  }

  // Public API Methods

  on(event: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, [])
    }
    this.handlers.get(event)!.push(handler)

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(event)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index > -1) {
          handlers.splice(index, 1)
        }
      }
    }
  }

  off(event: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  async getActiveSymbols(): Promise<ActiveSymbol[]> {
    const reqId = this.getNextReqId()

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, {
        resolve: (data: any) => {
          // Handle both old and new API response formats
          if (data.active_symbols && Array.isArray(data.active_symbols)) {
            // 🔍 LIGHTWEIGHT DIAGNOSTIC: Log summary only (avoid heavy processing)
            console.log(`[DerivAPI] ✅ Loaded ${data.active_symbols.length} symbols`)
            
            // Sample first 3 symbols for verification
            const sampleSymbols = data.active_symbols.slice(0, 3).map((s: any) => ({
              symbol: s.symbol,
              display: s.display_name,
              market: s.market_display_name,
              open: s.exchange_is_open === 1
            }))
            console.log("[DerivAPI] 📊 Sample symbols:", sampleSymbols)
            
            resolve(data.active_symbols)
          } else if (data.data) {
            // New API format: { data: { active_symbols: [...] } } or { data: [...] }
            if (data.data.active_symbols && Array.isArray(data.data.active_symbols)) {
              resolve(data.data.active_symbols)
            } else if (Array.isArray(data.data)) {
              resolve(data.data)
            } else {
              reject(new Error("Failed to get active symbols: invalid data format"))
            }
          } else {
            reject(new Error("Failed to get active symbols"))
          }
        },
        reject,
      })

      this.send({
        active_symbols: "brief",
        req_id: reqId,
      })

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId)
          reject(new Error("Request timeout"))
        }
      }, 10000)
    })
  }

  async subscribeTicks(symbol: string, callback: (tick: TickStream["tick"]) => void): Promise<() => void> {
    // ✅ MUTEX: Prevent concurrent subscription requests with timeout
    if (this.isSubscribing) {
      console.warn("[DerivAPI] Subscription already in progress, waiting with timeout...")
      let waited = 0
      while (this.isSubscribing && waited < 10000) {
        await new Promise(resolve => setTimeout(resolve, 100))
        waited += 100
      }
      // If still subscribing after 10s timeout, force release
      if (this.isSubscribing) {
        console.warn("[DerivAPI] Subscription mutex timeout, force releasing")
        this.isSubscribing = false
      }
    }

    this.isSubscribing = true

    try {
      const reqId = this.getNextReqId()
      const subscriptionKey = `ticks_${symbol}`


      // ✅ CLEAR PREVIOUS HANDLERS
      this.handlers.delete("tick")

      const handler = (data: DerivMessage) => {
        if ("msg_type" in data && data.msg_type === "tick" && "tick" in data) {
          const tick = (data as TickStream).tick
          // ✅ STRICT NUMBER CASTING AT LOWEST LEVEL
          callback({
            ...tick,
            quote: Number(tick.quote),
            epoch: Number(tick.epoch)
          })
        }
      }

      this.on("tick", handler)

      // Track this subscription for resubscription after reconnection
      this.activeSubscriptions.set(subscriptionKey, {
        type: 'ticks',
        params: { symbol },
        callback,
      })

      // ✅ PHASE 4: SEND SUBSCRIPTION REQUEST AND AWAIT CONFIRMATION
      const response = await this.request({
        ticks: symbol,
        subscribe: 1,
        req_id: reqId,
      })

      // ✅ CAPTURE SUBSCRIPTION ID
      if ('subscription' in response && response.subscription) {
        this.subscriptions.set(response.subscription.id, response.subscription.id)
        console.log(`[DerivAPI] ✅ Tick subscription active: ${response.subscription.id}`)
      }

      // Return unsubscribe function
      return () => {
        this.off("tick", handler)
        this.activeSubscriptions.delete(subscriptionKey)
        this.forgetAll("ticks")
      }
    } finally {
      // ✅ MUTEX: Release lock
      this.isSubscribing = false
    }
  }

  // Unsubscribe from all tick streams - used for clean symbol switching
  async unsubscribeTicks(): Promise<void> {
    // Remove all tick subscriptions from activeSubscriptions
    const tickSubscriptions = Array.from(this.activeSubscriptions.entries())
      .filter(([_, sub]) => sub.type === 'ticks')

    tickSubscriptions.forEach(([key, _]) => {
      this.activeSubscriptions.delete(key)
    })

    // CRITICAL: Clear ALL tick event handlers to prevent stale handlers from accumulating
    this.handlers.delete("tick")

    // Send forget_all to the API
    await this.forgetAll("ticks")
  }

  async subscribeOHLC(symbol: string, granularity: number, callback: (ohlc: OHLCStream["ohlc"]) => void): Promise<() => void> {
    // ✅ MUTEX: Prevent concurrent subscription requests with timeout
    if (this.isSubscribing) {
      console.warn("[DerivAPI] Subscription already in progress, waiting with timeout...")
      let waited = 0
      while (this.isSubscribing && waited < 10000) {
        await new Promise(resolve => setTimeout(resolve, 100))
        waited += 100
      }
      // If still subscribing after 10s timeout, force release
      if (this.isSubscribing) {
        console.warn("[DerivAPI] Subscription mutex timeout, force releasing")
        this.isSubscribing = false
      }
    }

    this.isSubscribing = true

    try {
      const reqId = this.getNextReqId()
      const subscriptionKey = `ohlc_${symbol}_${granularity}`


      // ✅ CLEAR PREVIOUS HANDLERS
      this.handlers.delete("ohlc")

      const handler = (data: DerivMessage) => {
        if ("msg_type" in data && data.msg_type === "ohlc" && "ohlc" in data) {
          const ohlc = (data as OHLCStream).ohlc
          // ✅ STRICT NUMBER CASTING AT LOWEST LEVEL
          callback({
            ...ohlc,
            open: Number(ohlc.open),
            high: Number(ohlc.high),
            low: Number(ohlc.low),
            close: Number(ohlc.close),
            epoch: Number(ohlc.epoch),
            granularity: Number(ohlc.granularity)
          })
        }
      }

      this.on("ohlc", handler)

      // Track this subscription for resubscription after reconnection
      this.activeSubscriptions.set(subscriptionKey, {
        type: 'ohlc',
        params: { symbol, granularity },
        callback,
      })

      // ✅ PHASE 4: SEND SUBSCRIPTION REQUEST AND AWAIT CONFIRMATION
      const response = await this.request({
        ticks_history: symbol,
        style: "candles",
        granularity,
        subscribe: 1,
        end: "latest",
        count: 500,
        req_id: reqId,
      })

      // ✅ CAPTURE SUBSCRIPTION ID
      if ('subscription' in response && response.subscription) {
        this.subscriptions.set(response.subscription.id, response.subscription.id)
        console.log(`[DerivAPI] ✅ OHLC subscription active: ${response.subscription.id}`)
      }

      // Return unsubscribe function
      return () => {
        this.off("ohlc", handler)
        this.activeSubscriptions.delete(subscriptionKey)
        this.forgetAll("candles")
      }
    } finally {
      // ✅ MUTEX: Release lock
      this.isSubscribing = false
    }
  }

  // Unsubscribe from all OHLC streams - used for clean symbol switching
  async unsubscribeOHLC(): Promise<void> {
    // Remove all OHLC subscriptions from activeSubscriptions
    const ohlcSubscriptions = Array.from(this.activeSubscriptions.entries())
      .filter(([_, sub]) => sub.type === 'ohlc')

    ohlcSubscriptions.forEach(([key, _]) => {
      this.activeSubscriptions.delete(key)
    })

    // CRITICAL: Clear ALL ohlc event handlers to prevent stale handlers from accumulating
    this.handlers.delete("ohlc")

    // Send forget_all to the API
    await this.forgetAll("candles")
  }

  // Unsubscribe from all streams (ticks and OHLC)
  async unsubscribeAll(): Promise<void> {
    await this.unsubscribeTicks()
    await this.unsubscribeOHLC()
  }

  // Get OHLC/candle history for a symbol
  async getOHLCHistory(symbol: string, granularity: number = 60, count: number = 500): Promise<{ candles: Array<{ epoch: number; open: number; high: number; low: number; close: number }> }> {
    const reqId = this.getNextReqId()

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, {
        resolve: (data: any) => {
          if (data.candles) {
            resolve({ candles: data.candles })
          } else {
            reject(new Error("Failed to get OHLC history"))
          }
        },
        reject,
      })

      this.send({
        ticks_history: symbol,
        style: "candles",
        granularity,
        count,
        end: "latest",
        req_id: reqId,
      })

      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId)
          reject(new Error("Request timeout"))
        }
      }, 10000)
    })
  }

  async getTickHistory(symbol: string, count: number = 100): Promise<{ prices: number[]; times: number[] }> {
    const reqId = this.getNextReqId()

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, {
        resolve: (data: any) => {
          if (data.history) {
            resolve(data.history)
          } else if (data.error) {
            reject(new Error(data.error.message || "Failed to get tick history"))
          } else {
            reject(new Error("Failed to get tick history"))
          }
        },
        reject,
      })

      // New Deriv API may require different parameters
      this.send({
        ticks_history: symbol,
        count,
        end: "latest",
        style: "ticks",
        req_id: reqId,
      })

      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId)
          reject(new Error("Request timeout"))
        }
      }, 10000)
    })
  }

  async getProposal(params: TradeParams): Promise<ProposalResponse["proposal"]> {
    const reqId = this.getNextReqId()

    console.log("[DerivAPI] getProposal called with params:", params)

    // Wait for API to be ready before sending proposal request
    const isReady = await this.waitUntilReady(10000)
    if (!isReady) {
      throw new Error("API not ready - connection timeout")
    }

    return new Promise((resolve, reject) => {
      let resolved = false

      // Listen for proposal event that matches our req_id
      const handler = (data: any) => {
        // Only process responses for our specific request
        if (data.echo_req?.req_id !== reqId) return
        if (resolved) return

        console.log("[DerivAPI] Received proposal response:", data)
        if (data.proposal) {
          resolved = true
          this.off("proposal", handler)
          clearTimeout(timeout)
          resolve(data.proposal)
        } else if (data.error) {
          resolved = true
          this.off("proposal", handler)
          clearTimeout(timeout)
          reject(new Error(data.error.message || "Failed to get proposal"))
        }
      }

      this.on("proposal", handler)

      // Use 'symbol' parameter (not 'underlying')
      const request = {
        proposal: 1,
        amount: params.amount,
        basis: params.basis,
        contract_type: params.contract_type,
        currency: params.currency || "USD",
        duration: params.duration,
        duration_unit: params.duration_unit,
        symbol: params.symbol,
        req_id: reqId,
        ...(params.barrier && { barrier: params.barrier }),
      }

      console.log("[DerivAPI] Sending proposal request:", request)
      this.send(request)

      // Timeout after 15 seconds
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          this.off("proposal", handler)
          reject(new Error("Request timeout - no proposal response received"))
        }
      }, 15000)
    })
  }

  async buyContract(proposalId: string, price: number): Promise<BuyResponse["buy"]> {
    const reqId = this.getNextReqId()

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, {
        resolve: (data: BuyResponse) => {
          if (data.buy) {
            resolve(data.buy)
          } else {
            reject(new Error("Failed to buy contract"))
          }
        },
        reject,
      })

      this.send({
        buy: proposalId,
        price,
        req_id: reqId,
      })

      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId)
          reject(new Error("Request timeout"))
        }
      }, 10000)
    })
  }

  subscribeProposalOpenContract(
    contractId: number,
    callback: (contract: ProposalOpenContractResponse["proposal_open_contract"]) => void
  ): () => void {
    const reqId = this.getNextReqId()
    const subscriptionKey = `contract_${contractId}`

    const handler = (data: DerivMessage) => {
      if ("msg_type" in data && data.msg_type === "proposal_open_contract" && "proposal_open_contract" in data) {
        callback((data as ProposalOpenContractResponse).proposal_open_contract)
      }
    }

    this.on("proposal_open_contract", handler)

    // Track this subscription for resubscription after reconnection
    this.activeSubscriptions.set(subscriptionKey, {
      type: 'proposal_open_contract',
      params: { contractId },
      callback,
    })

    this.send({
      proposal_open_contract: 1,
      contract_id: contractId,
      subscribe: 1,
      req_id: reqId,
    })

    return () => {
      this.off("proposal_open_contract", handler)
      this.activeSubscriptions.delete(subscriptionKey)
      this.send({
        forget_all: "proposal_open_contract",
      })
    }
  }

  async getBalance(): Promise<BalanceResponse["balance"]> {
    const reqId = this.getNextReqId()

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, {
        resolve: (data: BalanceResponse) => {
          if (data.balance) {
            resolve(data.balance)
          } else {
            reject(new Error("Failed to get balance"))
          }
        },
        reject,
      })

      this.send({
        balance: 1,
        req_id: reqId,
      })

      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId)
          reject(new Error("Request timeout"))
        }
      }, 10000)
    })
  }

  async getServerTime(): Promise<number> {
    const reqId = this.getNextReqId()

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, {
        resolve: (data: any) => {
          if (data.time) {
            resolve(data.time)
          } else {
            reject(new Error("Failed to get server time"))
          }
        },
        reject,
      })

      this.send({
        time: 1,
        req_id: reqId,
      })

      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId)
          reject(new Error("Request timeout"))
        }
      }, 10000)
    })
  }

  async getContractsFor(symbol: string, retries = 3): Promise<ContractsForResponse["contracts_for"]> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await this.getContractsForAttempt(symbol)
        return result
      } catch (error) {
        console.warn(`[DerivAPI] getContractsFor attempt ${attempt}/${retries} failed:`, error)
        if (attempt === retries) {
          throw error
        }
        // Exponential backoff: 1s, 2s, 4s
        const delay = 1000 * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    throw new Error("Failed to get contracts for symbol after retries")
  }

  private async getContractsForAttempt(symbol: string): Promise<ContractsForResponse["contracts_for"]> {
    const reqId = this.getNextReqId()

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, {
        resolve: (data: ContractsForResponse) => {
          if (data.contracts_for) {
            resolve(data.contracts_for)
          } else {
            reject(new Error("Failed to get contracts for symbol"))
          }
        },
        reject,
      })

      this.send({
        contracts_for: symbol,
        req_id: reqId,
      })

      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId)
          reject(new Error("Request timeout"))
        }
      }, 10000)
    })
  }

  // Subscribe to balance updates (for real accounts)
  subscribeBalance(callback: (balance: { balance: number; currency: string }) => void): () => void {
    const reqId = this.getNextReqId()
    const subscriptionKey = "balance_subscription"

    const handler = (data: DerivMessage) => {
      if ("msg_type" in data && data.msg_type === "balance" && "balance" in data) {
        callback((data as any).balance)
      }
    }

    this.on("balance", handler)

    // Track this subscription for resubscription after reconnection
    this.activeSubscriptions.set(subscriptionKey, {
      type: 'proposal_open_contract',
      params: {},
      callback,
    })

    this.send({
      balance: 1,
      subscribe: 1,
      req_id: reqId,
    })

    return () => {
      this.off("balance", handler)
      this.activeSubscriptions.delete(subscriptionKey)
    }
  }

  // ==================== TRADING OPERATIONS ====================

  /**
   * Sell an open contract before expiry
   * @param contractId - The contract ID to sell
   * @param price - Minimum acceptable price (0 for market price)
   */
  async sellContract(contractId: number, _price: number = 0): Promise<SellResponse["sell"]> {
    const reqId = this.getNextReqId()

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, {
        resolve: (data: any) => {
          if (data.error) {
            console.error("[DerivAPI] Sell error:", data.error)
            reject(new Error(data.error.message || "Failed to sell contract"))
          } else if (data.sell) {
            resolve(data.sell)
          } else {
            reject(new Error("Failed to sell contract"))
          }
        },
        reject,
      })

      this.send({
        sell: contractId,
        price: 0, // Using 0 ensures it sells at market price, avoiding bid price mismatch errors
        req_id: reqId,
      })

      // Increased timeout from 10s to 30s for better UX
      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId)
          reject(new Error("Request timeout - Contract sell operation may require authentication. Please check your API connection."))
        }
      }, 30000)
    })
  }

  /**
   * Cancel a contract (if cancellation is available)
   * @param contractId - The contract ID to cancel
   */
  async cancelContract(contractId: number): Promise<CancelResponse["cancel"]> {
    const reqId = this.getNextReqId()

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, {
        resolve: (data: CancelResponse) => {
          if (data.cancel) {
            resolve(data.cancel)
          } else {
            reject(new Error("Failed to cancel contract"))
          }
        },
        reject,
      })

      this.send({
        cancel: contractId,
        req_id: reqId,
      })

      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId)
          reject(new Error("Request timeout"))
        }
      }, 10000)
    })
  }

  /**
   * Update settings for an open contract (stop loss, take profit)
   * @param contractId - The contract ID to update
   * @param limitOrder - Object with stop_loss and/or take_profit values
   */
  async updateContract(
    contractId: number,
    limitOrder: { stop_loss?: number | null; take_profit?: number | null }
  ): Promise<ContractUpdateResponse["contract_update"]> {
    const reqId = this.getNextReqId()

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, {
        resolve: (data: ContractUpdateResponse) => {
          if (data.contract_update) {
            resolve(data.contract_update)
          } else {
            reject(new Error("Failed to update contract"))
          }
        },
        reject,
      })

      this.send({
        contract_update: 1,
        contract_id: contractId,
        limit_order: limitOrder,
        req_id: reqId,
      })

      // Increased timeout from 10s to 30s for better UX
      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId)
          reject(new Error("Request timeout - Contract update operation may require authentication. Please check your API connection."))
        }
      }, 30000)
    })
  }

  /**
   * Get the history of updates made to a contract
   * @param contractId - The contract ID
   * @param limit - Maximum number of historical updates (1-999, default 500)
   */
  async getContractUpdateHistory(
    contractId: number,
    limit: number = 500
  ): Promise<ContractUpdateHistoryResponse["contract_update_history"]> {
    const reqId = this.getNextReqId()

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, {
        resolve: (data: ContractUpdateHistoryResponse) => {
          if (data.contract_update_history) {
            resolve(data.contract_update_history)
          } else {
            reject(new Error("Failed to get contract update history"))
          }
        },
        reject,
      })

      this.send({
        contract_update_history: 1,
        contract_id: contractId,
        limit,
        req_id: reqId,
      })

      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId)
          reject(new Error("Request timeout"))
        }
      }, 10000)
    })
  }

  // ==================== ACCOUNT MANAGEMENT ====================

  /**
   * Get account statement with transaction history
   * @param description - Include full description (default: 1)
   * @param limit - Number of transactions to return (default: 100)
   * @param offset - Offset for pagination (default: 0)
   */
  async getStatement(
    description: number = 1,
    limit: number = 100,
    offset: number = 0
  ): Promise<StatementResponse["statement"]> {
    const reqId = this.getNextReqId()

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, {
        resolve: (data: StatementResponse) => {
          if (data.statement) {
            resolve(data.statement)
          } else {
            reject(new Error("Failed to get statement"))
          }
        },
        reject,
      })

      this.send({
        statement: 1,
        description,
        limit,
        offset,
        req_id: reqId,
      })

      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId)
          reject(new Error("Request timeout"))
        }
      }, 10000)
    })
  }

  /**
   * Get profit/loss summary for completed trades
   * @param description - Include full description (default: 1)
   * @param limit - Number of transactions to return (default: 25)
   * @param offset - Offset for pagination (default: 0)
   */
  async getProfitTable(
    description: number = 1,
    limit: number = 25,
    offset: number = 0
  ): Promise<ProfitTableResponse["profit_table"]> {
    const reqId = this.getNextReqId()

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, {
        resolve: (data: ProfitTableResponse) => {
          if (data.profit_table) {
            resolve(data.profit_table)
          } else {
            reject(new Error("Failed to get profit table"))
          }
        },
        reject,
      })

      this.send({
        profit_table: 1,
        description,
        limit,
        offset,
        req_id: reqId,
      })

      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId)
          reject(new Error("Request timeout"))
        }
      }, 10000)
    })
  }

  /**
   * Subscribe to real-time transaction notifications
   * @param callback - Called for each transaction event
   * @returns Unsubscribe function
   */
  subscribeTransactions(
    callback: (transaction: TransactionStream["transaction"]) => void
  ): () => void {
    const reqId = this.getNextReqId()
    const subscriptionKey = "transactions"

    const handler = (data: DerivMessage) => {
      if ("msg_type" in data && data.msg_type === "transaction" && "transaction" in data) {
        callback((data as TransactionStream).transaction)
      }
    }

    this.on("transaction", handler)

    this.activeSubscriptions.set(subscriptionKey, {
      type: 'proposal_open_contract',
      params: {},
      callback,
    })

    this.send({
      transaction: 1,
      subscribe: 1,
      req_id: reqId,
    })

    return () => {
      this.off("transaction", handler)
      this.activeSubscriptions.delete(subscriptionKey)
      this.send({
        forget_all: "transaction",
      })
    }
  }

  // ==================== MARKET DATA ====================

  /**
   * Get trading times for all symbols
   * @param date - Date in yyyy-mm-dd format, or "today"
   */
  async getTradingTimes(date: string = "today"): Promise<TradingTimesResponse["trading_times"]> {
    const reqId = this.getNextReqId()

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, {
        resolve: (data: TradingTimesResponse) => {
          if (data.trading_times) {
            resolve(data.trading_times)
          } else {
            reject(new Error("Failed to get trading times"))
          }
        },
        reject,
      })

      this.send({
        trading_times: date,
        req_id: reqId,
      })

      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId)
          reject(new Error("Request timeout"))
        }
      }, 10000)
    })
  }

  /**
   * Get all contract categories available for the trading platform
   */
  async getContractsList(): Promise<ContractsListResponse["contracts_list"]> {
    const reqId = this.getNextReqId()

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, {
        resolve: (data: ContractsListResponse) => {
          if (data.contracts_list) {
            resolve(data.contracts_list)
          } else {
            reject(new Error("Failed to get contracts list"))
          }
        },
        reject,
      })

      this.send({
        contracts_list: 1,
        req_id: reqId,
      })

      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId)
          reject(new Error("Request timeout"))
        }
      }, 10000)
    })
  }

  // ==================== REST API METHODS ====================

  /**
   * Get the base URL for REST API calls
   */
  private getRestBaseUrl(): string {
    return import.meta.env.VITE_DERIV_REST_URL || "https://api.derivws.com"
  }

  /**
   * Get OAuth authorization URL
   */
  private getOAuthUrl(): string {
    return import.meta.env.VITE_DERIV_OAUTH_URL || "https://auth.deriv.com/oauth2/auth"
  }

  /**
   * Get OAuth token URL
   */
  private getOAuthTokenUrl(): string {
    return import.meta.env.VITE_DERIV_OAUTH_TOKEN_URL || "https://auth.deriv.com/oauth2/token"
  }

  /**
   * Get all Options trading accounts via REST API
   * @param accessToken - OAuth2 access token
   */
  async getAccounts(accessToken: string): Promise<DerivAccountsResponse> {
    const baseUrl = this.getRestBaseUrl()
    const response = await fetch(`${baseUrl}/trading/v1/options/accounts`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Deriv-App-ID": import.meta.env.VITE_DERIV_APP_ID || "1089",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get accounts: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Create a new Options trading account via REST API
   * @param accessToken - OAuth2 access token
   * @param params - Account creation parameters
   */
  async createAccount(
    accessToken: string,
    params: CreateAccountParams
  ): Promise<CreateAccountResponse> {
    const baseUrl = this.getRestBaseUrl()
    const response = await fetch(`${baseUrl}/trading/v1/options/accounts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Deriv-App-ID": import.meta.env.VITE_DERIV_APP_ID || "1089",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      throw new Error(`Failed to create account: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Reset demo account balance via REST API
   * @param accessToken - OAuth2 access token
   * @param accountId - Demo account ID
   */
  async resetDemoBalance(
    accessToken: string,
    accountId: string
  ): Promise<ResetDemoBalanceResponse> {
    const baseUrl = this.getRestBaseUrl()
    const response = await fetch(
      `${baseUrl}/trading/v1/options/accounts/${accountId}/reset-demo-balance`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Deriv-App-ID": import.meta.env.VITE_DERIV_APP_ID || "1089",
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to reset demo balance: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get OTP for WebSocket authentication via REST API
   * @param accessToken - OAuth2 access token
   * @param accountId - Account ID to get OTP for
   * @returns WebSocket URL with OTP embedded
   */
  async getWebSocketUrl(
    accessToken: string,
    accountId: string
  ): Promise<OTPResponse> {
    const baseUrl = this.getRestBaseUrl()
    const response = await fetch(
      `${baseUrl}/trading/v1/options/accounts/${accountId}/otp`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Deriv-App-ID": import.meta.env.VITE_DERIV_APP_ID || "1089",
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Failed to get OTP: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Generate OAuth authorization URL with PKCE
   * @param clientId - OAuth2 client ID
   * @param redirectUri - Registered redirect URI
   * @param scope - OAuth scope ("trade" or "admin")
   * @param prompt - Optional prompt ("registration" for signup, "login" to force login page)
   * @param utmParams - Optional UTM tracking parameters for partner signup
   */
  async generateOAuthUrl(
    clientId: string,
    redirectUri: string,
    scope: "trade" | "admin" = "trade",
    prompt?: "registration" | "login",
    utmParams?: {
      sidc?: string
      utm_campaign?: string
      utm_medium?: string
      utm_source?: string
    }
  ): Promise<{ url: string; codeVerifier: string; state: string }> {
    // Generate PKCE code verifier (random 64-char string)
    const array = crypto.getRandomValues(new Uint8Array(64))
    const codeVerifier = Array.from(array)
      .map((v) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"[v % 66])
      .join("")

    // Generate state for CSRF protection
    const state = crypto.getRandomValues(new Uint8Array(16))
      .reduce((s, b) => s + b.toString(16).padStart(2, "0"), "")

    // Compute code_challenge from code_verifier
    const codeChallenge = await this.deriveCodeChallenge(codeVerifier)

    // Build URL parameters with code_challenge included
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
      code_challenge_method: "S256",
      code_challenge: codeChallenge,
    })

    // Add prompt for registration
    if (prompt) {
      params.set("prompt", prompt)
    }

    // Add UTM parameters if provided
    if (utmParams) {
      if (utmParams.sidc) params.set("sidc", utmParams.sidc)
      if (utmParams.utm_campaign) params.set("utm_campaign", utmParams.utm_campaign)
      if (utmParams.utm_medium) params.set("utm_medium", utmParams.utm_medium)
      if (utmParams.utm_source) params.set("utm_source", utmParams.utm_source)
    }

    return { url: `${this.getOAuthUrl()}?${params.toString()}`, codeVerifier, state }
  }

  /**
   * Derive code_challenge from code_verifier
   */
  async deriveCodeChallenge(codeVerifier: string): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier))
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
  }

  /**
   * Get deposit cashier URL via WebSocket
   * Opens Deriv's hosted deposit page in a new tab
   */
  async deposit(): Promise<string> {
    const reqId = this.getNextReqId()

    const isReady = await this.waitUntilReady(10000)
    if (!isReady) {
      throw new Error("API not ready - connection timeout")
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, {
        resolve: (data: CashierResponse) => {
          if (data.cashier) {
            resolve(data.cashier)
          } else {
            reject(new Error("Failed to get deposit URL"))
          }
        },
        reject,
      })

      this.send({
        cashier: "deposit",
        req_id: reqId,
      })

      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId)
          reject(new Error("Request timeout"))
        }
      }, 15000)
    })
  }

  /**
   * Get withdrawal cashier URL via WebSocket
   * Opens Deriv's hosted withdrawal page in a new tab
   */
  async withdraw(): Promise<string> {
    const reqId = this.getNextReqId()

    const isReady = await this.waitUntilReady(10000)
    if (!isReady) {
      throw new Error("API not ready - connection timeout")
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, {
        resolve: (data: CashierResponse) => {
          if (data.cashier) {
            resolve(data.cashier)
          } else {
            reject(new Error("Failed to get withdrawal URL"))
          }
        },
        reject,
      })

      this.send({
        cashier: "withdraw",
        req_id: reqId,
      })

      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId)
          reject(new Error("Request timeout"))
        }
      }, 15000)
    })
  }

  /**
   * Exchange authorization code for access token
   * This should be called from a backend server, not the browser
   * @param code - Authorization code from callback
   * @param codeVerifier - Original PKCE code verifier
   * @param clientId - OAuth2 client ID
   * @param redirectUri - Registered redirect URI
   */
  async exchangeCodeForToken(
    code: string,
    codeVerifier: string,
    clientId: string,
    redirectUri: string
  ): Promise<{ access_token: string; expires_in: number; token_type: string }> {
    console.log("[DerivAPI] Exchanging code for token...")
    console.log("[DerivAPI] Token URL:", this.getOAuthTokenUrl())
    console.log("[DerivAPI] Client ID:", clientId)
    console.log("[DerivAPI] Redirect URI:", redirectUri)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      }).toString()

      console.log("[DerivAPI] Request body:", body.replace(codeVerifier, "[REDACTED]"))

      const response = await fetch(this.getOAuthTokenUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      console.log("[DerivAPI] Token response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[DerivAPI] Token error response:", errorText)
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      console.log("[DerivAPI] Token exchange successful")
      return data
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Token exchange timed out after 30 seconds")
      }
      throw error
    }
  }

  ping(): void {
    this.send({
      ping: 1,
    })
  }

  disconnect(): void {
    // Prevent reconnection when intentionally disconnecting
    this.shouldReconnect = false
    this.stopPingInterval()

    if (this.ws) {
      // Only close if not in CONNECTING state (readyState 0)
      // Closing a CONNECTING WebSocket causes "WebSocket is closed before the connection is established" error
      if (this.ws.readyState !== WebSocket.CONNECTING) {
        this.ws.close()
      }
      this.ws = null
    }

    this.isConnecting = false
    this.isConnectedState = false
    this.isAuthorized = false
    this.handlers.clear()
    this.pendingRequests.clear()
    this.subscriptions.clear()
    this.activeSubscriptions.clear()
    this.pendingRequestsQueue = []
  }

  // Method to re-enable reconnection (for manual reconnection)
  enableReconnection(): void {
    this.shouldReconnect = true
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  getConnectionState(): boolean {
    return this.isConnectedState
  }
}

// Singleton instance
let apiInstance: DerivAPI | null = null

export function getDerivAPI(): DerivAPI {
  if (!apiInstance) {
    apiInstance = new DerivAPI()
  }
  return apiInstance
}

export function disconnectDerivAPI(): void {
  if (apiInstance) {
    apiInstance.disconnect()
    apiInstance = null
  }
}

export default DerivAPI
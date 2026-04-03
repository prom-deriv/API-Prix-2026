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
} from "../types/deriv"

const DERIV_APP_ID = import.meta.env.VITE_DERIV_APP_ID || "1089"
const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`

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
  private hasReceivedOnOpen: boolean = false // Track if onopen event has fired
  private subscriptions: Map<string, string> = new Map() // subscription_id -> req_id
  private activeSubscriptions: Map<string, ActiveSubscription> = new Map() // Track subscriptions for resubscription
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private lastPong: number = Date.now()
  private shouldReconnect: boolean = true // Flag to prevent reconnection when intentionally disconnecting
  private token: string | null = null
  private pendingRequestsQueue: Array<() => void> = [] // Queue for requests sent before WebSocket is ready
  private currentStreamType: 'ticks' | 'ohlc' | null = null // Style-aware guard to discard mismatched messages
  private isSubscriptionHandshakeActive: boolean = false // Disables filtering during subscription switch
  private expectedSubscriptionId: string | null = null // Only accept messages with matching subscription id

  constructor() {
    // Don't auto-connect in constructor - let the app control when to connect
    // This prevents issues with React Strict Mode running effects twice
  }

  // Set authentication token
  setToken(token: string): void {
    this.token = token
  }

  // Public method to initialize connection
  async initialize(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return
    }
    return this.connect()
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
        this.ws = new WebSocket(WS_URL)

        this.ws.onopen = () => {
          console.log("[DerivAPI] Connected to WebSocket")
          this.isConnecting = false
          this.isConnectedState = true
          this.hasReceivedOnOpen = true // Mark that onopen has fired
          this.reconnectAttempts = 0
          this.lastPong = Date.now()

          // Send authorization if token is set
          if (this.token) {
            this.send({ authorize: this.token })
          }

          // Emit connection event
          this.startPingInterval()
          this.emit("connection", { connected: true })
          
          // Use setTimeout to flush queue after the current event loop completes
          // This ensures the WebSocket readyState has fully transitioned to OPEN
          setTimeout(() => {
            this.flushRequestQueue()
            resolve()
          }, 0)
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
          this.hasReceivedOnOpen = false // Reset onopen flag on close
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

    // First, forget all existing subscriptions to avoid "AlreadySubscribed" errors
    try {
      await this.forgetAll('ticks')
    } catch (e) { /* ignore - subscription may not exist */ }
    try {
      await this.forgetAll('candles')
    } catch (e) { /* ignore - subscription may not exist */ }
    try {
      await this.forgetAll('proposal_open_contract')
    } catch (e) { /* ignore - subscription may not exist */ }

    // Resubscribe to all active subscriptions
    this.activeSubscriptions.forEach((sub) => {
      console.log(`[DerivAPI] Resubscribing to ${sub.type}`)

      if (sub.type === 'ticks') {
        this.send({
          ticks: sub.params.symbol,
          subscribe: 1,
          req_id: this.getNextReqId(),
        })
      } else if (sub.type === 'ohlc') {
        this.send({
          ticks_history: sub.params.symbol,
          style: "candles",
          granularity: sub.params.granularity,
          subscribe: 1,
          end: "latest",
          count: 500,
          req_id: this.getNextReqId(),
        })
      } else if (sub.type === 'proposal_open_contract') {
        this.send({
          proposal_open_contract: 1,
          contract_id: sub.params.contractId,
          subscribe: 1,
          req_id: this.getNextReqId(),
        })
      }
    })

    this.emit("resubscribed", { success: true })
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
    // Handle pong responses
    if ("ping" in data) {
      this.lastPong = Date.now()
      return
    }

    // Handle authorization response - Deriv API returns msg_type: "authorize"
    if ("msg_type" in data && data.msg_type === "authorize") {
      console.log("[DerivAPI] Authorization successful")
      this.isAuthorized = true
      this.emit("authorize", (data as any).authorize)
      // Flush any pending requests that were queued before authorization
      this.flushRequestQueue()
      return
    }

    // Handle error responses
    if ("error" in data) {
      console.error("[DerivAPI] API Error:", data.error)
      this.emit("error", data.error)
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

    // Emit to message type handlers — with style-aware guard
    if ("msg_type" in data) {
      const msgType = data.msg_type
      if (msgType) {
        // STYLE-AWARE GUARD: Discard tick/ohlc messages that don't match the current stream type
        // This prevents crashes when stale messages arrive during stream switching
        if (msgType === "tick" && this.currentStreamType !== "ticks") {
          console.warn("[DerivAPI] Discarding stale tick message (current stream:", this.currentStreamType, ")")
          return
        }
        if (msgType === "ohlc" && this.currentStreamType !== "ohlc") {
          console.warn("[DerivAPI] Discarding stale ohlc message (current stream:", this.currentStreamType, ")")
          return
        }

        // ✅ SELF-HEALING DETECTION
        if (this.isSubscriptionHandshakeActive) {
          if (msgType === "tick" && this.currentStreamType === "ohlc") {
            console.warn("[DerivAPI] ⚠️ Mismatch: Received tick message during OHLC subscription")
            this.forgetAll('ticks')
            return
          }
          if (msgType === "ohlc" && this.currentStreamType === "ticks") {
            console.warn("[DerivAPI] ⚠️ Mismatch: Received OHLC message during tick subscription")
            this.forgetAll('candles')
            return
          }
        }

        // ✅ SHIELD ACTIVATION: Only filter after handshake is complete
        if (!this.isSubscriptionHandshakeActive && this.expectedSubscriptionId) {
          // Verify subscription id matches if available
          if ('subscription' in data && data.subscription && data.subscription.id !== this.expectedSubscriptionId) {
            console.warn(`[DerivAPI] 🛡️ Discarding message from old subscription: ${data.subscription.id}`)
            return
          }
        }

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
    // If we've received onopen, trust that the WebSocket is ready even if readyState is still CONNECTING
    // This is a browser quirk where readyState doesn't immediately transition to OPEN when onopen fires
    if (!this.hasReceivedOnOpen && this.ws?.readyState !== WebSocket.OPEN) {
      // Queue messages when CONNECTING (not just when not authorized)
      if (this.ws?.readyState === WebSocket.CONNECTING) {
        console.warn("[DerivAPI] WebSocket is CONNECTING, queuing request")
        this.pendingRequestsQueue.push(() => this.send(message))
        return
      }
      // Log error for truly disconnected states
      const state = this.ws?.readyState
      const stateName = state === WebSocket.CLOSING ? "CLOSING" :
        state === WebSocket.CLOSED ? "CLOSED" : "UNKNOWN"
      console.error(`[DerivAPI] WebSocket is not connected (state: ${stateName})`)
      return
    }

    // Check if WebSocket is authorized before sending requests (except for authorize and ping)
    if (!this.isAuthorized && !('authorize' in message) && !('ping' in message)) {
      console.warn("[DerivAPI] WebSocket not authorized, queuing request")
      this.pendingRequestsQueue.push(() => this.send(message))
      return
    }

    this.ws!.send(JSON.stringify(message))
  }

  private flushRequestQueue(): void {
    console.log(`[DerivAPI] Flushing ${this.pendingRequestsQueue.length} queued requests`)
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

  // Public method to check if WebSocket is ready for requests
  isReady(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.isAuthorized
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
          if (data.active_symbols) {
            resolve(data.active_symbols)
          } else {
            reject(new Error("Failed to get active symbols"))
          }
        },
        reject,
      })

      this.send({
        active_symbols: "brief",
        product_type: "basic",
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
    const reqId = this.getNextReqId()
    const subscriptionKey = `ticks_${symbol}`

    // ✅ PHASE 1: HANDSHAKE INIT - Disable filtering
    this.isSubscriptionHandshakeActive = true
    this.expectedSubscriptionId = null
    this.currentStreamType = null
    
    // ✅ PHASE 2: FULLY TERMINATE PREVIOUS STREAM - AWAIT CONFIRMATION
    await this.forgetAll('candles')
    
    // Clear previous handlers completely
    this.handlers.delete("tick")
    
    // ✅ PHASE 3: ACTIVATE NEW STREAM TYPE
    this.currentStreamType = 'ticks'

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

    // ✅ PHASE 5: CAPTURE SUBSCRIPTION ID AND ACTIVATE SHIELD
    if ('subscription' in response && response.subscription) {
      this.expectedSubscriptionId = response.subscription.id
      this.subscriptions.set(response.subscription.id, response.subscription.id)
      console.log(`[DerivAPI] ✅ Tick subscription active: ${response.subscription.id}`)
    }
    
    // Handshake complete - enable filtering
    this.isSubscriptionHandshakeActive = false

    // Return unsubscribe function
    return () => {
      this.off("tick", handler)
      this.activeSubscriptions.delete(subscriptionKey)
      this.forgetAll("ticks")
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
    const reqId = this.getNextReqId()
    const subscriptionKey = `ohlc_${symbol}_${granularity}`

    // ✅ PHASE 1: HANDSHAKE INIT - Disable filtering
    this.isSubscriptionHandshakeActive = true
    this.expectedSubscriptionId = null
    this.currentStreamType = null
    
    // ✅ PHASE 2: FULLY TERMINATE PREVIOUS STREAM - AWAIT CONFIRMATION
    await this.forgetAll('ticks')
    
    // Clear previous handlers completely
    this.handlers.delete("ohlc")
    
    // ✅ PHASE 3: ACTIVATE NEW STREAM TYPE
    this.currentStreamType = 'ohlc'

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

    // ✅ PHASE 5: CAPTURE SUBSCRIPTION ID AND ACTIVATE SHIELD
    if ('subscription' in response && response.subscription) {
      this.expectedSubscriptionId = response.subscription.id
      this.subscriptions.set(response.subscription.id, response.subscription.id)
      console.log(`[DerivAPI] ✅ OHLC subscription active: ${response.subscription.id}`)
    }
    
    // Handshake complete - enable filtering
    this.isSubscriptionHandshakeActive = false

    // Return unsubscribe function
    return () => {
      this.off("ohlc", handler)
      this.activeSubscriptions.delete(subscriptionKey)
      this.forgetAll("candles")
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
          } else {
            reject(new Error("Failed to get tick history"))
          }
        },
        reject,
      })

      this.send({
        ticks_history: symbol,
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

  async getProposal(params: TradeParams): Promise<ProposalResponse["proposal"]> {
    const reqId = this.getNextReqId()

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(reqId, {
        resolve: (data: ProposalResponse) => {
          if (data.proposal) {
            resolve(data.proposal)
          } else {
            reject(new Error("Failed to get proposal"))
          }
        },
        reject,
      })

      this.send({
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
      })

      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId)
          reject(new Error("Request timeout"))
        }
      }, 10000)
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
    this.hasReceivedOnOpen = false // Reset onopen flag on disconnect
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
import type {
  DerivMessage,
  TickStream,
  ActiveSymbol,
  ProposalResponse,
  BuyResponse,
  ProposalOpenContractResponse,
  BalanceResponse,
  TradeParams,
} from "../types/deriv"

const DERIV_APP_ID = import.meta.env.VITE_DERIV_APP_ID || "1089"
const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}`

type MessageHandler = (data: DerivMessage) => void

interface ActiveSubscription {
  type: 'ticks' | 'proposal_open_contract'
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
  private subscriptions: Map<string, string> = new Map() // subscription_id -> req_id
  private activeSubscriptions: Map<string, ActiveSubscription> = new Map() // Track subscriptions for resubscription
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private lastPong: number = Date.now()
  private shouldReconnect: boolean = true // Flag to prevent reconnection when intentionally disconnecting
  private token: string | null = null

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
          this.reconnectAttempts = 0
          this.lastPong = Date.now()

          // Send authorization if token is set
          if (this.token) {
            this.send({ authorize: this.token })
          }

          // Add a small delay to ensure the WebSocket is fully ready
          // This helps prevent race conditions where send() is called before the connection is stable
          setTimeout(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.startPingInterval()
              this.emit("connection", { connected: true })
              resolve()
            } else {
              console.warn("[DerivAPI] WebSocket closed immediately after opening")
              reject(new Error("WebSocket closed immediately after opening"))
            }
          }, 100)
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

  private resubscribe(): void {
    console.log("[DerivAPI] Resubscribing to active subscriptions")

    // Resubscribe to all active subscriptions
    this.activeSubscriptions.forEach((sub) => {
      console.log(`[DerivAPI] Resubscribing to ${sub.type}`)

      if (sub.type === 'ticks') {
        this.send({
          ticks: sub.params.symbol,
          subscribe: 1,
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
      this.emit("authorize", (data as any).authorize)
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

    // Emit to message type handlers
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

  private send(message: object): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      const state = this.ws?.readyState
      const stateName = state === WebSocket.CONNECTING ? "CONNECTING" :
        state === WebSocket.CLOSING ? "CLOSING" :
          state === WebSocket.CLOSED ? "CLOSED" : "UNKNOWN"
      console.error(`[DerivAPI] WebSocket is not connected (state: ${stateName})`)
      return
    }

    this.ws.send(JSON.stringify(message))
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

  subscribeTicks(symbol: string, callback: (tick: TickStream["tick"]) => void): () => void {
    const reqId = this.getNextReqId()
    const subscriptionKey = `ticks_${symbol}`

    const handler = (data: DerivMessage) => {
      if ("msg_type" in data && data.msg_type === "tick" && "tick" in data) {
        callback((data as TickStream).tick)
      }
    }

    this.on("tick", handler)

    // Track this subscription for resubscription after reconnection
    this.activeSubscriptions.set(subscriptionKey, {
      type: 'ticks',
      params: { symbol },
      callback,
    })

    this.send({
      ticks: symbol,
      subscribe: 1,
      req_id: reqId,
    })

    // Return unsubscribe function
    return () => {
      this.off("tick", handler)
      this.activeSubscriptions.delete(subscriptionKey)
      this.send({
        forget_all: "ticks",
      })
    }
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
    this.handlers.clear()
    this.pendingRequests.clear()
    this.subscriptions.clear()
    this.activeSubscriptions.clear()
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
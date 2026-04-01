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

const PUBLIC_WS_URL = "wss://api.derivws.com/trading/v1/options/ws/public"

type MessageHandler = (data: DerivMessage) => void

class DerivAPI {
  private ws: WebSocket | null = null
  private handlers: Map<string, MessageHandler[]> = new Map()
  private reqId: number = 0
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map()
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 5
  private reconnectDelay: number = 1000
  private isConnecting: boolean = false
  private subscriptions: Map<string, string> = new Map() // subscription_id -> req_id

  constructor() {
    this.connect()
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      if (this.isConnecting) {
        return
      }

      this.isConnecting = true

      try {
        this.ws = new WebSocket(PUBLIC_WS_URL)

        this.ws.onopen = () => {
          console.log("[DerivAPI] Connected to WebSocket")
          this.isConnecting = false
          this.reconnectAttempts = 0
          this.emit("connection", { connected: true })
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
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[DerivAPI] Max reconnection attempts reached")
      this.emit("error", { error: "Connection lost. Please refresh the page." })
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

    console.log(`[DerivAPI] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`)

    setTimeout(() => {
      this.connect().then(() => {
        // Resubscribe to all active subscriptions
        this.resubscribe()
      })
    }, delay)
  }

  private resubscribe(): void {
    // Resubscribe logic would go here
    console.log("[DerivAPI] Resubscribing to active subscriptions")
  }

  private handleMessage(data: DerivMessage): void {
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
      console.error("[DerivAPI] WebSocket is not connected")
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

    const handler = (data: DerivMessage) => {
      if ("msg_type" in data && data.msg_type === "tick" && "tick" in data) {
        callback((data as TickStream).tick)
      }
    }

    this.on("tick", handler)

    this.send({
      ticks: symbol,
      subscribe: 1,
      req_id: reqId,
    })

    // Return unsubscribe function
    return () => {
      this.off("tick", handler)
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

    const handler = (data: DerivMessage) => {
      if ("msg_type" in data && data.msg_type === "proposal_open_contract" && "proposal_open_contract" in data) {
        callback((data as ProposalOpenContractResponse).proposal_open_contract)
      }
    }

    this.on("proposal_open_contract", handler)

    this.send({
      proposal_open_contract: 1,
      contract_id: contractId,
      subscribe: 1,
      req_id: reqId,
    })

    return () => {
      this.off("proposal_open_contract", handler)
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
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.handlers.clear()
    this.pendingRequests.clear()
    this.subscriptions.clear()
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
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
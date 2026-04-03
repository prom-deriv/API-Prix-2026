// Deriv API Types

export interface Tick {
  epoch: number
  quote: number
  symbol: string
  pip_size?: number
}

export interface TickHistory {
  echo_req: {
    ticks_history: string
    count: number
    end: string
  }
  history: {
    prices: number[]
    times: number[]
  }
  msg_type: "history"
}

export interface TickStream {
  tick: {
    ask: number
    bid: number
    epoch: number
    id: string
    pip_size: number
    quote: number
    symbol: string
  }
  msg_type: "tick"
}

// OHLC Types for candlestick/OHLC charts
export interface OHLC {
  open: number
  high: number
  low: number
  close: number
  epoch: number
  granularity: number
  symbol?: string
}

export interface OHLCStream {
  ohlc: {
    close: number
    epoch: number
    granularity: number
    high: number
    id: string
    low: number
    open: number
    open_time: number
    pip_size: number
    symbol: string
  }
  msg_type: "ohlc"
}

export interface OHLCHistory {
  echo_req: {
    ticks_history: string
    count: number
    end: string
    granularity?: number
  }
  candles: Array<{
    close: number
    epoch: number
    granularity: number
    high: number
    low: number
    open: number
    open_time: number
  }>
  msg_type: "candles"
}

export interface ActiveSymbol {
  allow_forward_starting: number
  display_name: string
  display_order: number
  exchange_is_open: number
  is_trading_suspended: number
  market: string
  market_display_name: string
  pip: number
  submarket: string
  submarket_display_name: string
  symbol: string
  symbol_type: string
}

export interface Proposal {
  ask_price: number
  date_start: number
  display_value: number
  id: string
  longcode: string
  payout: number
  spot: number
  spot_time: number
}

export interface ProposalResponse {
  echo_req: {
    proposal: number
    amount: number
    basis: string
    contract_type: string
    currency: string
    duration: number
    duration_unit: string
    symbol: string
  }
  proposal: Proposal
  msg_type: "proposal"
}

export interface BuyResponse {
  buy: {
    balance_after: number
    contract_id: number
    longcode: string
    payout: number
    purchase_time: number
    shortcode: string
    start_time: number
    transaction_id: number
  }
  msg_type: "buy"
}

export interface ProposalOpenContract {
  audit: {
    all_ticks: Array<{
      epoch: number
      tick: number
    }>
  }
  barrier: number
  bid_price: number
  buy_price: number
  contract_id: number
  contract_type: string
  currency: string
  current_spot: number
  current_spot_display_value: string
  current_spot_time: number
  date_expiry: number
  date_settlement: number
  date_start: number
  display_name: string
  entry_spot: number
  entry_spot_display_value: string
  expiry_time: number
  id: string
  is_expired: number
  is_forward_starting: number
  is_intraday: number
  is_path_dependent: number
  is_settleable: number
  is_sold: number
  longcode: string
  payout: number
  profit: number
  profit_percentage: number
  purchase_time: number
  sell_price: number
  sell_spot: number
  sell_spot_display_value: string
  sell_spot_time: number
  shortcode: string
  status: "open" | "sold" | "won" | "lost"
  transaction_ids: {
    buy: number
    sell?: number
  }
  underlying: string
}

export interface ProposalOpenContractResponse {
  proposal_open_contract: ProposalOpenContract
  msg_type: "proposal_open_contract"
  subscription?: {
    id: string
  }
}

export interface Balance {
  balance: number
  currency: string
  loginid: string
}

export interface BalanceResponse {
  balance: Balance
  msg_type: "balance"
}

export interface Portfolio {
  contracts: ProposalOpenContract[]
}

export interface PortfolioResponse {
  portfolio: Portfolio
  msg_type: "portfolio"
}

export interface ProfitTable {
  count: number
  transactions: Array<{
    app_id: number
    buy_price: number
    contract_id: number
    contract_type: string
    currency: string
    date_expiry: number
    date_start: number
    longcode: string
    payout: number
    profit: number
    sell_price: number
    sell_time: number
    shortcode: string
    transaction_id: number
  }>
}

export interface ProfitTableResponse {
  profit_table: ProfitTable
  msg_type: "profit_table"
}

export interface ServerTime {
  time: number
}

export interface ServerTimeResponse {
  time: number
  msg_type: "time"
}

export interface TradingTimes {
  trading_times: Array<{
    close: Array<{ open: string }>
    events: Array<{ dates: string; descrip: string }>
    name: string
    open: Array<{ open: string }>
    symbol: string
    times: {
      close: string[]
      open: string[]
    }
  }>
}

export interface TradingTimesResponse {
  trading_times: TradingTimes
  msg_type: "trading_times"
}

// Chart Style Types
export type ChartStyle = 'area' | 'line' | 'ohlc' | 'candlestick'

// WebSocket Message Types
export type DerivMessage =
  | TickStream
  | TickHistory
  | OHLCStream
  | OHLCHistory
  | ProposalResponse
  | BuyResponse
  | ProposalOpenContractResponse
  | BalanceResponse
  | PortfolioResponse
  | ProfitTableResponse
  | ServerTimeResponse
  | TradingTimesResponse
  | { msg_type: "forget"; echo_req: { forget: string } }
  | { msg_type: "forget_all"; echo_req: { forget_all: string } }
  | { msg_type: "ping"; ping: number }
  | { msg_type: "authorize"; authorize: any }
  | { error: { code: string; message: string; details?: any } }

// Trading Types
export type ContractType = "CALL" | "PUT" | "RISE" | "FALL" | "ONETOUCH" | "NOTOUCH"
export type Basis = "stake" | "payout"
export type DurationUnit = "t" | "s" | "m" | "h" | "d"

export interface TradeParams {
  symbol: string
  amount: number
  basis: Basis
  contract_type: ContractType
  duration: number
  duration_unit: DurationUnit
  currency?: string
  barrier?: string
}

export interface TradeResult {
  contract_id: number
  longcode: string
  payout: number
  purchase_time: number
  transaction_id: number
}

// Account Types
export interface Account {
  account_type: string
  balance: number
  currency: string
  is_disabled: number
  is_virtual: number
  loginid: string
}

// Strategy Types
export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal"
  | "less_than_or_equal"
  | "crosses_above"
  | "crosses_below"
  | "consecutive_up"
  | "consecutive_down"

export type ConditionField =
  | "price"
  | "tick_direction"
  | "consecutive_ticks"
  | "price_change_percent"

export type LogicalOperator = "AND" | "OR"

export interface StrategyCondition {
  id: string
  field: ConditionField
  operator: ConditionOperator
  value: number | string
}

export interface StrategyRule {
  id: string
  conditions: StrategyCondition[]
  logicalOperator: LogicalOperator
  action: {
    contract_type: ContractType
    amount: number
    basis: Basis
    duration: number
    duration_unit: DurationUnit
  }
  enabled: boolean
}

export interface Strategy {
  id: string
  name: string
  symbol: string
  rules: StrategyRule[]
  isActive: boolean
  createdAt: number
  updatedAt: number
}

// UI State Types
export interface ConnectionState {
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  lastConnected: number | null
}

export interface ContractForAvailable {
  barrier: string | number
  barrier_choices: string[]
  barrier_category: string
  contract_type: string
  exchange_name: string
  expiry_type: string
  market: string
  max_barrier_offset: string
  max_contract_duration: string
  min_barrier_offset: string
  min_contract_duration: string
  sentiment: string
  submarket: string
  symbol: string
}

export interface ContractsForResponse {
  contracts_for: {
    available: ContractForAvailable[]
    close: number
    feed_license: string
    hit_count: number
    id: string
    non_available: Array<{
      contract_type: string
      exchange_name: string
      market: string
      submarket: string
      symbol: string
    }>
    open: number
    spot: number
  }
  msg_type: "contracts_for"
}

export interface TradingState {
  currentSymbol: string
  symbols: ActiveSymbol[]
  currentTick: Tick | null
  tickHistory: Tick[]
  isTrading: boolean
  activeContracts: ProposalOpenContract[]
  recentTrades: ProfitTable["transactions"]
}
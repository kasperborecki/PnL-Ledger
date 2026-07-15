export type TradeDirection = 'Long' | 'Short'
export type TradeResult = 'Win' | 'Loss' | 'BE'
export type TradeSession = 'Asia' | 'London' | 'New York'
export type TradeEmotion = string

export interface TradeScreenshot {
  label: string
  url: string | null
}

export interface Trade {
  id: string
  date: string
  time: string
  symbol: string
  direction: TradeDirection
  setup: string
  session: TradeSession
  emotion: TradeEmotion
  result: TradeResult
  netPnl: number
  grossPnl: number
  commission: number
  rr: number
  holdMinutes: number
  entry: number
  exit: number
  stopLoss: number
  takeProfit: number
  size: number
  riskPercent: number
  whyEntered: string
  whatWentWell: string
  whatToImprove: string
  notes: string
  tags: string[]
  screenshots: TradeScreenshot[]
}

export interface OpenTrade {
  id: string
  date: string
  time: string
  symbol: string
  direction: TradeDirection
  setup: string
  session: TradeSession
  emotion: TradeEmotion
  entry: number
  stopLoss: number
  takeProfit: number
  size: number
  riskPercent: number
  whyEntered: string
  notes: string
  screenshotLabel: string
  screenshotUrl: string | null
  screenshotStoragePath: string | null
}

export interface NavigationItem {
  label: string
  to: string
  icon: string
}

export interface SelectOption {
  label: string
  value: string
}

export const navigationItems: NavigationItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: 'mdi-view-grid-outline' },
  { label: 'Trades', to: '/trades', icon: 'mdi-book-open-page-variant-outline' },
  { label: 'Forum', to: '/forum', icon: 'mdi-forum-outline' },
  { label: 'Analytics', to: '/analytics', icon: 'mdi-chart-box-outline' },
  { label: 'Calendar', to: '/calendar', icon: 'mdi-calendar-month-outline' },
  { label: 'Journal', to: '/journal', icon: 'mdi-notebook-outline' },
  { label: 'Playbook', to: '/playbook', icon: 'mdi-bullseye-arrow' },
  { label: 'Lot Calculator', to: '/lot-calculator', icon: 'mdi-calculator-variant-outline' },
  { label: 'Plugins', to: '/plugins', icon: 'mdi-puzzle-outline' },
  { label: 'Settings', to: '/settings', icon: 'mdi-cog-outline' },
]

export const rangeOptions: SelectOption[] = [
  { label: 'Today', value: 'Today' },
  { label: 'Week', value: 'Week' },
  { label: 'Month', value: 'Month' },
  { label: 'All', value: 'All' },
]

export const exportOptions: SelectOption[] = [
  { label: 'Export CSV', value: 'csv' },
  { label: 'Export PDF', value: 'pdf' },
  { label: 'Export Report', value: 'report' },
]

export const symbolOptions: SelectOption[] = [
  { label: 'All Symbols', value: 'All' },
  { label: 'NAS100', value: 'NAS100' },
  { label: 'US30', value: 'US30' },
  { label: 'XAUUSD', value: 'XAUUSD' },
  { label: 'EURUSD', value: 'EURUSD' },
  { label: 'GBPUSD', value: 'GBPUSD' },
  { label: 'EURCHF', value: 'EURCHF' },
  { label: 'GBPCHF', value: 'GBPCHF' },
  { label: 'USDCHF', value: 'USDCHF' },
  { label: 'BTCUSD', value: 'BTCUSD' },
  { label: 'ETHUSD', value: 'ETHUSD' },
  { label: 'US500', value: 'US500' },
]

export const setupOptions: SelectOption[] = [
  { label: 'All Setups', value: 'All' },
  { label: 'Liquidity Sweep', value: 'Liquidity Sweep' },
  { label: 'Breakout', value: 'Breakout' },
  { label: 'Trend Continuation', value: 'Trend Continuation' },
  { label: 'Pullback', value: 'Pullback' },
  { label: 'Range Trade', value: 'Range Trade' },
  { label: 'Reversal', value: 'Reversal' },
]

export const sessionOptions: SelectOption[] = [
  { label: 'All Sessions', value: 'All' },
  { label: 'Asia', value: 'Asia' },
  { label: 'London', value: 'London' },
  { label: 'New York', value: 'New York' },
]

export const emotionOptions: SelectOption[] = [
  { label: 'All Emotions', value: 'All' },
  { label: 'Calm', value: 'Calm' },
  { label: 'Confidence', value: 'Confidence' },
  { label: 'Greed', value: 'Greed' },
  { label: 'Hesitation', value: 'Hesitation' },
  { label: 'Frustration', value: 'Frustration' },
  { label: 'Impulse', value: 'Impulse' },
]

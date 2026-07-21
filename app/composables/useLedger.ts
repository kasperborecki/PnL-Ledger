import { computed, onMounted, ref } from 'vue'
import {
  emotionOptions as fallbackEmotionOptions,
  exportOptions,
  navigationItems,
  rangeOptions,
  sessionOptions,
  setupOptions as fallbackSetupOptions,
  symbolOptions as fallbackSymbolOptions,
  type OpenTrade,
  type Trade,
  type TradeScreenshot,
} from '~/data/ledger'
import {
  requireChoice,
  requireCurrencyCode,
  requireDate,
  requireNumber,
  requireText,
  requireTime,
  validateImageFile,
} from '~/utils/validation'

type Timeframe = 'Today' | 'Week' | 'Month' | 'All'
type CalendarMonth = `${number}-${string}`
type ExportFormat = 'csv' | 'pdf' | 'report'

type TradeDraft = {
  date: string
  time: string
  symbol: string
  direction: Trade['direction']
  setup: string
  session: Trade['session']
  emotion: Trade['emotion']
  result: Trade['result']
  netPnl: number
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
  tags: string
}

type OpenTradeDraft = {
  date: string
  time: string
  symbol: string
  direction: Trade['direction']
  setup: string
  session: Trade['session']
  emotion: Trade['emotion']
  entry: number
  stopLoss: number
  takeProfit: number
  size: number
  riskPercent: number
  whyEntered: string
  notes: string
}

type PlaybookDraft = {
  name: string
  grade: 'A' | 'B' | 'C' | 'D'
  trades: number
  winRate: number
  avgRR: number
  pnl: number
  thesis: string
}

type PlaybookCard = {
  name: string
  trades: number
  wins: number
  losses: number
  winRate: number
  avgRR: number
  pnl: number
  grade: string
  expectancy: number
  expectancyLabel: string
  avgRRLabel: string
  profitFactor: string
}

type DbTradeRow = {
  id: string
  symbol: string
  trade_date: string
  trade_time: string
  direction: Trade['direction']
  setup: string
  session: Trade['session']
  emotion: Trade['emotion']
  result: Trade['result']
  net_pnl: number | string
  gross_pnl: number | string
  commission: number | string
  rr: number | string
  hold_minutes: number
  entry: number | string
  exit: number | string
  stop_loss: number | string
  take_profit: number | string
  size: number | string
  risk_percent: number | string
  why_entered: string
  what_went_well: string
  what_to_improve: string
  notes: string
  tags: string[]
}

type DbScreenshotRow = {
  id?: string
  trade_id: string
  user_id?: string
  slot: number
  label: string
  storage_path: string | null
  public_url: string | null
}

type DbOpenTradeRow = {
  id: string
  symbol: string
  trade_date: string
  trade_time: string
  direction: Trade['direction']
  setup: string
  session: Trade['session']
  emotion: Trade['emotion']
  entry: number | string
  stop_loss: number | string
  take_profit: number | string
  size: number | string
  risk_percent: number | string
  why_entered: string
  notes: string
  screenshot_label: string
  screenshot_storage_path: string | null
  screenshot_public_url: string | null
}

type DbPlaybookRow = {
  id: string
  name: string
  grade: 'A' | 'B' | 'C' | 'D'
  trades: number | string
  wins: number | string
  losses: number | string
  win_rate: number | string
  avg_rr: number | string
  pnl: number | string
  expectancy: number | string
  profit_factor: number | string
  thesis: string
}

type DbLookupRow = {
  name: string
  description: string
  sort_order: number | string
  is_active: boolean
}

type DbInstrumentRow = {
  symbol: string
  display_name: string
  asset_class: 'forex' | 'index' | 'commodity' | 'crypto' | 'stock'
  price_precision: number | string
  is_active: boolean
}

type TradeScreenshotDraft = {
  slot: 1 | 2
  label: string
  file: File | null | undefined
}

type OpenTradeScreenshotDraft = {
  label: string
  file: File | null | undefined
}

const screenshotBucket = 'trade-screenshots'

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const plainMoney = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const percent = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

const decimal = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const preciseDecimal = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 8,
})

function formatTruncatedDecimal(value: number | string | null | undefined, digits = 2) {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric)) {
    return '-'
  }

  const sign = numeric < 0 ? '-' : ''
  const raw = Math.abs(numeric).toString()
  if (raw.includes('e')) {
    const factor = 10 ** digits
    return `${sign}${(Math.trunc(Math.abs(numeric) * factor) / factor).toFixed(digits)}`
  }

  const [integer, fraction = ''] = raw.split('.')
  return `${sign}${integer}.${fraction.padEnd(digits, '0').slice(0, digits)}`
}

const weekOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function toMonthKey(date: string) {
  return date.slice(0, 7)
}

function shiftMonth(monthKey: string, delta: number) {
  const [yearPart, monthPart] = monthKey.split('-')
  const year = Number(yearPart)
  const monthIndex = Number(monthPart) - 1
  const shifted = new Date(Date.UTC(year, monthIndex + delta, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}` as CalendarMonth
}

function createDraft(date = todayKey()): TradeDraft {
  return {
    date,
    time: '09:30',
    symbol: 'NAS100',
    direction: 'Long',
    setup: 'Breakout',
    session: 'New York',
    emotion: 'Calm',
    result: 'Win',
    netPnl: 0,
    commission: 0,
    rr: 2,
    holdMinutes: 30,
    entry: 0,
    exit: 0,
    stopLoss: 0,
    takeProfit: 0,
    size: 1,
    riskPercent: 1,
    whyEntered: '',
    whatWentWell: '',
    whatToImprove: '',
    notes: '',
    tags: '',
  }
}

function createOpenTradeDraft(date = todayKey()): OpenTradeDraft {
  return {
    date,
    time: '09:30',
    symbol: 'NAS100',
    direction: 'Long',
    setup: 'Breakout',
    session: 'New York',
    emotion: 'Calm',
    entry: 0,
    stopLoss: 0,
    takeProfit: 0,
    size: 1,
    riskPercent: 1,
    whyEntered: '',
    notes: '',
  }
}

function createOpenTradeDraftFromTrade(trade: OpenTrade): OpenTradeDraft {
  return {
    date: trade.date,
    time: trade.time,
    symbol: trade.symbol,
    direction: trade.direction,
    setup: trade.setup,
    session: trade.session,
    emotion: trade.emotion,
    entry: trade.entry,
    stopLoss: trade.stopLoss,
    takeProfit: trade.takeProfit,
    size: trade.size,
    riskPercent: trade.riskPercent,
    whyEntered: trade.whyEntered,
    notes: trade.notes,
  }
}

function createPlaybookDraft(): PlaybookDraft {
  return {
    name: '',
    grade: 'B',
    trades: 1,
    winRate: 50,
    avgRR: 2,
    pnl: 0,
    thesis: '',
  }
}

function createDraftFromTrade(trade: Trade): TradeDraft {
  return {
    date: trade.date,
    time: trade.time,
    symbol: trade.symbol,
    direction: trade.direction,
    setup: trade.setup,
    session: trade.session,
    emotion: trade.emotion,
    result: trade.result,
    netPnl: trade.netPnl,
    commission: trade.commission,
    rr: trade.rr,
    holdMinutes: trade.holdMinutes,
    entry: trade.entry,
    exit: trade.exit,
    stopLoss: trade.stopLoss,
    takeProfit: trade.takeProfit,
    size: trade.size,
    riskPercent: trade.riskPercent,
    whyEntered: trade.whyEntered,
    whatWentWell: trade.whatWentWell,
    whatToImprove: trade.whatToImprove,
    notes: trade.notes,
    tags: trade.tags.join(', '),
  }
}

function createDraftFromOpenTrade(trade: OpenTrade): TradeDraft {
  return {
    date: trade.date,
    time: trade.time,
    symbol: trade.symbol,
    direction: trade.direction,
    setup: trade.setup,
    session: trade.session,
    emotion: trade.emotion,
    result: 'BE',
    netPnl: 0,
    commission: 0,
    rr: 2,
    holdMinutes: 30,
    entry: trade.entry,
    exit: 0,
    stopLoss: trade.stopLoss,
    takeProfit: trade.takeProfit,
    size: trade.size,
    riskPercent: trade.riskPercent,
    whyEntered: trade.whyEntered,
    whatWentWell: '',
    whatToImprove: '',
    notes: trade.notes,
    tags: '',
  }
}

function normalizeTradePnl(result: Trade['result'], rawPnl: number) {
  const amount = Math.abs(Number(rawPnl) || 0)

  if (result === 'Loss') {
    return -amount
  }

  if (result === 'Win') {
    return amount
  }

  return 0
}

function validateTradeSubmission(
  draft: TradeDraft,
  screenshots: TradeScreenshotDraft[],
  allowedSymbols: string[],
  allowedSetups: string[],
  allowedEmotions: string[],
) {
  const date = requireDate(draft.date, 'Trade date')
  const time = requireTime(draft.time, 'Trade time')
  const symbol = requireChoice(draft.symbol, 'Symbol', allowedSymbols)
  const setup = requireChoice(draft.setup, 'Setup', allowedSetups)
  const session = requireChoice(draft.session, 'Session', sessionOptions.map((option) => option.value).filter((value) => value !== 'All'))
  const emotion = requireChoice(draft.emotion, 'Emotion', allowedEmotions)
  const result = requireChoice(draft.result, 'Result', ['Win', 'Loss', 'BE'])

  if (!/^[A-Z0-9/_-]{1,20}$/.test(symbol)) {
    throw new Error('Symbol can only contain letters, numbers, slash, dash or underscore.')
  }

  return {
    date,
    time,
    symbol,
    setup,
    session,
    emotion,
    result,
    netPnl: requireNumber(draft.netPnl, 'P&L', { min: -1_000_000_000, max: 1_000_000_000 }),
    commission: requireNumber(draft.commission, 'Commission', { min: 0, max: 1_000_000_000 }),
    rr: requireNumber(draft.rr, 'R:R', { min: 0, max: 1_000_000_000 }),
    holdMinutes: requireNumber(draft.holdMinutes, 'Hold minutes', { min: 0, integer: true, max: 1_000_000 }),
    entry: requireNumber(draft.entry, 'Entry', { min: 0, max: 1_000_000_000 }),
    exit: requireNumber(draft.exit, 'Exit', { min: 0, max: 1_000_000_000 }),
    stopLoss: requireNumber(draft.stopLoss, 'Stop loss', { min: 0, max: 1_000_000_000 }),
    takeProfit: requireNumber(draft.takeProfit, 'Take profit', { min: 0, max: 1_000_000_000 }),
    size: requireNumber(draft.size, 'Size', { min: 0, max: 1_000_000_000 }),
    riskPercent: requireNumber(draft.riskPercent, 'Risk %', { min: 0, max: 100 }),
    whyEntered: requireText(draft.whyEntered, 'Why I entered', { allowEmpty: true, maxLength: 4000 }),
    whatWentWell: requireText(draft.whatWentWell, 'What went well', { allowEmpty: true, maxLength: 4000 }),
    whatToImprove: requireText(draft.whatToImprove, 'What to improve', { allowEmpty: true, maxLength: 4000 }),
    notes: requireText(draft.notes, 'Notes', { allowEmpty: true, maxLength: 4000 }),
    tags: requireText(draft.tags, 'Tags', { allowEmpty: true, maxLength: 2000 }),
    screenshots: screenshots.map((screenshot) => ({
      ...screenshot,
      file: validateImageFile(screenshot.file, screenshot.label, { allowEmpty: true, maxBytes: 10 * 1024 * 1024 }),
    })),
  }
}

function validateOpenTradeSubmission(
  draft: OpenTradeDraft,
  screenshot: OpenTradeScreenshotDraft,
  allowedSymbols: string[],
  allowedSetups: string[],
  allowedEmotions: string[],
  options: {
    requireScreenshot?: boolean
  } = {},
) {
  const date = requireDate(draft.date, 'Trade date')
  const time = requireTime(draft.time, 'Trade time')
  const symbol = requireChoice(draft.symbol, 'Symbol', allowedSymbols)
  const direction = requireChoice(draft.direction, 'Direction', ['Long', 'Short']) as Trade['direction']
  const setup = requireChoice(draft.setup, 'Setup', allowedSetups)
  const session = requireChoice(draft.session, 'Session', sessionOptions.map((option) => option.value).filter((value) => value !== 'All'))
  const emotion = requireChoice(draft.emotion, 'Emotion', allowedEmotions)

  if (!/^[A-Z0-9/_-]{1,20}$/.test(symbol)) {
    throw new Error('Symbol can only contain letters, numbers, slash, dash or underscore.')
  }

  return {
    date,
    time,
    symbol,
    direction,
    setup,
    session,
    emotion,
    entry: requireNumber(draft.entry, 'Entry', { min: 0, max: 1_000_000_000 }),
    stopLoss: requireNumber(draft.stopLoss, 'Stop loss', { min: 0, max: 1_000_000_000 }),
    takeProfit: requireNumber(draft.takeProfit, 'Take profit', { min: 0, max: 1_000_000_000 }),
    size: requireNumber(draft.size, 'Size', { min: 0, max: 1_000_000_000 }),
    riskPercent: requireNumber(draft.riskPercent, 'Risk %', { min: 0, max: 100 }),
    whyEntered: requireText(draft.whyEntered, 'Why I entered', { allowEmpty: true, maxLength: 4000 }),
    notes: requireText(draft.notes, 'Notes', { allowEmpty: true, maxLength: 4000 }),
    screenshot: {
      label: requireText(screenshot.label, 'Screenshot label', { maxLength: 120 }),
      file: validateImageFile(screenshot.file, screenshot.label, {
        allowEmpty: options.requireScreenshot === false,
        maxBytes: 10 * 1024 * 1024,
      }),
    },
  }
}

function parseList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0) || 0
}

function formatSign(value: number) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${money.format(value)}`
}

function getDayName(date: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  )
}

function getMonthLabel(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

function buildDailySeries(series: Trade[]) {
  const grouped = new Map<string, Trade[]>()

  for (const trade of series) {
    const list = grouped.get(trade.date) ?? []
    list.push(trade)
    grouped.set(trade.date, list)
  }

  return [...grouped.entries()]
    .map(([date, items]) => {
      const pnl = items.reduce((sum, trade) => sum + trade.netPnl, 0)
      return {
        date,
        label: new Intl.DateTimeFormat('en-US', {
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
        }).format(new Date(`${date}T00:00:00Z`)),
        dayName: getDayName(date).slice(0, 3),
        pnl,
        trades: items.length,
        wins: items.filter((trade) => trade.result === 'Win').length,
        losses: items.filter((trade) => trade.result === 'Loss').length,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

function buildCalendar(series: Trade[], monthKey: string) {
  const grouped = new Map<string, ReturnType<typeof buildDailySeries>[number]>()

  for (const day of buildDailySeries(series)) {
    grouped.set(day.date, day)
  }

  const days = []
  const [yearPart, monthPart] = monthKey.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart) - 1
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1

  for (let index = 0; index < 42; index += 1) {
    const dayNumber = index - startOffset + 1
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      days.push({
        key: `empty-${index}`,
        empty: true,
        day: null,
        date: null,
        pnl: 0,
        trades: 0,
        status: 'none' as const,
        label: '',
      })
      continue
    }

    const date = `${monthKey}-${String(dayNumber).padStart(2, '0')}`
    const summary = grouped.get(date)
    const pnl = summary?.pnl ?? 0
    const tradesCount = summary?.trades ?? 0
    const status =
      tradesCount === 0
        ? 'none'
        : pnl > 0
          ? 'positive'
          : pnl < 0
            ? 'negative'
            : 'neutral'

    days.push({
      key: date,
      empty: false,
      day: dayNumber,
      date,
      pnl,
      trades: tradesCount,
      status,
      label: summary?.label ?? `${dayNumber}`,
    })
  }

  return days
}

function buildGroupStats(series: Trade[], key: keyof Trade) {
  const grouped = new Map<string, Trade[]>()

  for (const trade of series) {
    const current = grouped.get(String(trade[key])) ?? []
    current.push(trade)
    grouped.set(String(trade[key]), current)
  }

  return [...grouped.entries()]
    .map(([name, items]) => {
      const pnl = items.reduce((sum, trade) => sum + trade.netPnl, 0)
      const wins = items.filter((trade) => trade.result === 'Win').length
      const losses = items.filter((trade) => trade.result === 'Loss').length
      const winRate = items.length ? (wins / items.length) * 100 : 0
      const avgRR = items.length
        ? items.reduce((sum, trade) => sum + trade.rr, 0) / items.length
        : 0

      return {
        name,
        trades: items.length,
        wins,
        losses,
        winRate,
        avgRR,
        pnl,
      }
    })
    .sort((a, b) => b.pnl - a.pnl)
}

function sortChronologically(series: Trade[]) {
  return [...series].sort((left, right) => {
    const a = `${left.date}T${left.time}`
    const b = `${right.date}T${right.time}`
    return a.localeCompare(b)
  })
}

function getWinStreak(series: Trade[]) {
  let currentWin = 0
  let currentLoss = 0
  let best = 0
  let worst = 0

  for (const trade of sortChronologically(series)) {
    if (trade.result === 'Win') {
      currentWin += 1
      currentLoss = 0
      best = Math.max(best, currentWin)
      continue
    }

    currentLoss += 1
    currentWin = 0
    worst = Math.max(worst, currentLoss)
  }

  return { best, worst }
}

function cleanLabel(value: string) {
  return value.replace(/\.[^.]+$/, '').trim() || 'Screenshot'
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildScreenshotPath(userId: string, tradeId: string, slot: number, fileName: string) {
  const name = fileName.replace(/\.[^.]+$/, '')
  const extensionMatch = fileName.match(/(\.[^.]+)$/)
  const extension = extensionMatch?.[1] ?? ''
  const uniqueId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${slot}`
  const safeName = slugify(name) || 'screenshot'
  return `${userId}/${tradeId}/${String(slot).padStart(2, '0')}-${uniqueId}-${safeName}${extension}`
}

function buildPlaybookCard(draft: PlaybookDraft): PlaybookCard {
  const trades = Math.max(0, Math.round(Number(draft.trades) || 0))
  const pnl = Number(draft.pnl) || 0
  const winRate = Math.max(0, Math.min(100, Number(draft.winRate) || 0))
  const avgRR = Math.max(0, Number(draft.avgRR) || 0)
  const wins = Math.round((trades * winRate) / 100)
  const losses = Math.max(0, trades - wins)
  const profitFactor = losses === 0 ? 'Infinity' : (wins / losses).toFixed(2)

  return {
    name: draft.name.trim() || 'Custom Setup',
    trades,
    wins,
    losses,
    winRate,
    avgRR,
    pnl,
    grade: draft.grade,
    expectancy: trades ? pnl / trades : 0,
    expectancyLabel: formatSign(trades ? pnl / trades : 0),
    avgRRLabel: `1 : ${formatTruncatedDecimal(avgRR)}`,
    profitFactor,
  }
}

function toTrade(row: DbTradeRow, screenshots: TradeScreenshot[]) {
  return {
    id: row.id,
    date: row.trade_date,
    time: row.trade_time.slice(0, 5),
    symbol: row.symbol,
    direction: row.direction,
    setup: row.setup,
    session: row.session,
    emotion: row.emotion,
    result: row.result,
    netPnl: toNumber(row.net_pnl),
    grossPnl: toNumber(row.gross_pnl),
    commission: toNumber(row.commission),
    rr: toNumber(row.rr),
    holdMinutes: row.hold_minutes,
    entry: toNumber(row.entry),
    exit: toNumber(row.exit),
    stopLoss: toNumber(row.stop_loss),
    takeProfit: toNumber(row.take_profit),
    size: toNumber(row.size),
    riskPercent: toNumber(row.risk_percent),
    whyEntered: row.why_entered,
    whatWentWell: row.what_went_well,
    whatToImprove: row.what_to_improve,
    notes: row.notes,
    tags: row.tags ?? [],
    screenshots: screenshots.length
      ? screenshots
      : [
          { label: 'Before trade', url: null },
          { label: 'After trade', url: null },
        ],
  } satisfies Trade
}

function toOpenTrade(row: DbOpenTradeRow) {
  return {
    id: row.id,
    date: row.trade_date,
    time: row.trade_time.slice(0, 5),
    symbol: row.symbol,
    direction: row.direction,
    setup: row.setup,
    session: row.session,
    emotion: row.emotion,
    entry: toNumber(row.entry),
    stopLoss: toNumber(row.stop_loss),
    takeProfit: toNumber(row.take_profit),
    size: toNumber(row.size),
    riskPercent: toNumber(row.risk_percent),
    whyEntered: row.why_entered,
    notes: row.notes,
    screenshotLabel: row.screenshot_label || 'Before trade',
    screenshotUrl: row.screenshot_public_url,
    screenshotStoragePath: row.screenshot_storage_path,
  } satisfies OpenTrade
}

function toPlaybookCard(row: DbPlaybookRow): PlaybookCard {
  const trades = toNumber(row.trades)
  const pnl = toNumber(row.pnl)
  const wins = toNumber(row.wins)
  const losses = toNumber(row.losses)
  const winRate = toNumber(row.win_rate)
  const avgRR = toNumber(row.avg_rr)
  const profitFactor = losses === 0 ? 'Infinity' : toNumber(row.profit_factor).toFixed(2)

  return {
    name: row.name,
    trades,
    wins,
    losses,
    winRate,
    avgRR,
    pnl,
    grade: row.grade,
    expectancy: toNumber(row.expectancy),
    expectancyLabel: formatSign(toNumber(row.expectancy)),
    avgRRLabel: `1 : ${formatTruncatedDecimal(avgRR)}`,
    profitFactor,
  }
}

function getCsvValue(value: unknown) {
  const raw = String(value ?? '')
  if (/[",\n]/.test(raw)) {
    return `"${raw.replaceAll('"', '""')}"`
  }
  return raw
}

function buildCsv(trades: Trade[]) {
  const header = [
    'date',
    'time',
    'symbol',
    'direction',
    'setup',
    'session',
    'emotion',
    'result',
    'netPnl',
    'grossPnl',
    'commission',
    'rr',
    'holdMinutes',
    'entry',
    'exit',
    'stopLoss',
    'takeProfit',
    'size',
    'riskPercent',
    'whyEntered',
    'whatWentWell',
    'whatToImprove',
    'notes',
    'tags',
  ]

  const rows = trades.map((trade) => [
    trade.date,
    trade.time,
    trade.symbol,
    trade.direction,
    trade.setup,
    trade.session,
    trade.emotion,
    trade.result,
    trade.netPnl,
    trade.grossPnl,
    trade.commission,
    trade.rr,
    trade.holdMinutes,
    trade.entry,
    trade.exit,
    trade.stopLoss,
    trade.takeProfit,
    trade.size,
    trade.riskPercent,
    trade.whyEntered,
    trade.whatWentWell,
    trade.whatToImprove,
    trade.notes,
    trade.tags.join(' | '),
  ].map(getCsvValue).join(','))

  return [header.join(','), ...rows].join('\n')
}

function buildReport(trades: Trade[]) {
  const count = trades.length
  const netPnl = trades.reduce((sum, trade) => sum + trade.netPnl, 0)
  const wins = trades.filter((trade) => trade.result === 'Win').length
  const losses = trades.filter((trade) => trade.result === 'Loss').length
  const winRate = count ? (wins / count) * 100 : 0

  return [
    '# P&L Ledger Report',
    '',
    `Trades: ${count}`,
    `P&L: ${formatSign(netPnl)}`,
    `Win rate: ${decimal.format(winRate)}%`,
    `Wins: ${wins}`,
    `Losses: ${losses}`,
    '',
    '## Recent trades',
    ...trades.slice(0, 20).map((trade) => `- ${trade.date} ${trade.time} ${trade.symbol} ${trade.direction} ${formatSign(trade.netPnl)}`),
  ].join('\n')
}

function buildPrintableHtml(trades: Trade[]) {
  const rows = trades
    .map(
      (trade) => `
        <tr>
          <td>${escapeHtml(trade.date)}</td>
          <td>${escapeHtml(trade.time)}</td>
          <td>${escapeHtml(trade.symbol)}</td>
          <td>${escapeHtml(trade.direction)}</td>
          <td>${escapeHtml(trade.setup)}</td>
          <td>${escapeHtml(formatSign(trade.netPnl))}</td>
          <td>${escapeHtml(trade.result)}</td>
        </tr>
      `,
    )
    .join('')

  const total = trades.reduce((sum, trade) => sum + trade.netPnl, 0)
  const winRate = trades.length ? (trades.filter((trade) => trade.result === 'Win').length / trades.length) * 100 : 0

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>P&L Ledger Report</title>
        <style>
          body {
            font-family: Inter, ui-sans-serif, system-ui, sans-serif;
            margin: 32px;
            color: #111827;
            background: #f8fafc;
          }
          h1, h2, p { margin: 0 0 12px; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 18px;
          }
          th, td {
            border-bottom: 1px solid #e5e7eb;
            padding: 10px 8px;
            text-align: left;
          }
          th {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: .08em;
          }
        </style>
      </head>
      <body>
        <h1>P&L Ledger Report</h1>
        <p>Trades: ${trades.length}</p>
        <p>Net P&L: ${total.toFixed(2)}</p>
        <p>Win rate: ${winRate.toFixed(1)}%</p>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Symbol</th>
              <th>Dir</th>
              <th>Setup</th>
              <th>P&L</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </body>
    </html>
  `
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  if (import.meta.server) {
    return
  }

  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function openPrintableReport(html: string) {
  if (import.meta.server) {
    return
  }

  const preview = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=900')
  if (!preview) {
    return
  }

  preview.document.open()
  preview.document.write(html)
  preview.document.close()
  preview.focus()
  preview.print()
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function useLedger() {
  const auth = useAuth()
  const timeframe = useState<Timeframe>('pnl-ledger-timeframe', () => 'Month')
  const selectedSymbol = useState('pnl-ledger-symbol', () => 'All')
  const selectedSetup = useState('pnl-ledger-setup', () => 'All')
  const selectedSession = useState('pnl-ledger-session', () => 'All')
  const selectedEmotion = useState('pnl-ledger-emotion', () => 'All')
  const tradeItems = useState<Trade[]>('pnl-ledger-trades', () => [])
  const openTradeItems = useState<OpenTrade[]>('pnl-ledger-open-trades', () => [])
  const savedPlaybookCards = useState<PlaybookCard[]>('pnl-ledger-saved-playbook', () => [])
  const setupRows = useState<DbLookupRow[]>('pnl-ledger-setup-rows', () => [])
  const emotionRows = useState<DbLookupRow[]>('pnl-ledger-emotion-rows', () => [])
  const instrumentRows = useState<DbInstrumentRow[]>('pnl-ledger-instruments', () => [])
  const selectedTradeId = useState('pnl-ledger-trade', () => '')
  const selectedOpenTradeId = useState('pnl-ledger-open-trade', () => '')
  const editingTradeId = useState<string | null>('pnl-ledger-editing-trade', () => null)
  const selectedDay = useState('pnl-ledger-day', () => todayKey())
  const selectedMonth = useState<CalendarMonth>('pnl-ledger-month', () => `${todayKey().slice(0, 7)}` as CalendarMonth)
  const isTradeDialogOpen = useState('pnl-ledger-trade-dialog-open', () => false)
  const isOpenTradeDialogOpen = useState('pnl-ledger-open-trade-dialog-open', () => false)
  const openTradeDialogMode = useState<'start' | 'edit' | 'close'>('pnl-ledger-open-trade-dialog-mode', () => 'start')
  const editingOpenTradeId = useState<string | null>('pnl-ledger-editing-open-trade', () => null)
  const closingOpenTradeId = useState<string | null>('pnl-ledger-closing-open-trade', () => null)
  const newTradeDraft = useState<TradeDraft>('pnl-ledger-trade-draft', () => createDraft(selectedDay.value))
  const openTradeDraft = useState<OpenTradeDraft>('pnl-ledger-open-trade-draft', () => createOpenTradeDraft(selectedDay.value))
  const closeTradeDraft = useState<TradeDraft>('pnl-ledger-close-trade-draft', () => createDraft(selectedDay.value))
  const playbookDraft = useState<PlaybookDraft>('pnl-ledger-playbook-draft', () => createPlaybookDraft())
  const exportFormat = useState<ExportFormat>('pnl-ledger-export-format', () => 'csv')
  const searchQuery = ref('')
  const isLoading = useState<boolean>('pnl-ledger-data-loading', () => false)
  const loadError = useState<string | null>('pnl-ledger-data-error', () => null)
  const hasLoaded = useState<boolean>('pnl-ledger-data-loaded', () => false)

  function clearLedgerData() {
    tradeItems.value = []
    openTradeItems.value = []
    savedPlaybookCards.value = []
    setupRows.value = []
    emotionRows.value = []
    selectedTradeId.value = ''
    selectedOpenTradeId.value = ''
    editingTradeId.value = null
    editingOpenTradeId.value = null
    closingOpenTradeId.value = null
    selectedDay.value = todayKey()
    selectedMonth.value = `${todayKey().slice(0, 7)}` as CalendarMonth
    hasLoaded.value = false
  }

  function normalizeFilterSelections() {
    const symbolValues = new Set(symbolOptions.value.map((option) => option.value))
    const setupValues = new Set(setupOptions.value.map((option) => option.value))
    const emotionValues = new Set(emotionOptions.value.map((option) => option.value))

    if (!symbolValues.has(selectedSymbol.value)) {
      selectedSymbol.value = 'All'
    }

    if (!setupValues.has(selectedSetup.value)) {
      selectedSetup.value = 'All'
    }

    if (!emotionValues.has(selectedEmotion.value)) {
      selectedEmotion.value = 'All'
    }

    if (!sessionOptions.some((option) => option.value === selectedSession.value)) {
      selectedSession.value = 'All'
    }
  }

  async function fetchTradeScreenshotRows(currentUserId: string, tradeId: string) {
    const supabase = useSupabase()
    const { data, error } = await supabase
      .from('trade_screenshots')
      .select('*')
      .eq('user_id', currentUserId)
      .eq('trade_id', tradeId)
      .order('slot', { ascending: true })

    if (error) {
      throw error
    }

    return (data ?? []) as DbScreenshotRow[]
  }

  async function removeScreenshotStorage(rows: DbScreenshotRow[]) {
    const paths = rows.map((row) => row.storage_path).filter((path): path is string => Boolean(path))
    if (!paths.length) {
      return
    }

    const supabase = useSupabase()
    const { error } = await supabase.storage.from(screenshotBucket).remove(paths)
    if (error) {
      const message = error.message?.toLowerCase?.() ?? ''
      if (message.includes('bucket not found')) {
        console.warn('Trade screenshots bucket is missing. Run supabase/002_trade_screenshots_bucket.sql.', error)
        return
      }

      throw error
    }
  }

  async function saveTradeScreenshots(
    currentUserId: string,
    tradeId: string,
    screenshots: TradeScreenshotDraft[],
    existingRows: DbScreenshotRow[] = [],
  ) {
    const supabase = useSupabase()
    const existingBySlot = new Map(existingRows.map((row) => [row.slot, row]))

    for (const screenshot of screenshots) {
      const file = screenshot.file
      if (!file || !(file.type.startsWith('image/') || !file.type)) {
        continue
      }

      const previousRow = existingBySlot.get(screenshot.slot)
      const storagePath = buildScreenshotPath(currentUserId, tradeId, screenshot.slot, file.name)

      try {
        const { error: uploadError } = await supabase.storage
          .from(screenshotBucket)
          .upload(storagePath, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: true,
          })

        if (uploadError) {
          throw uploadError
        }

        const { data: publicData } = supabase.storage.from(screenshotBucket).getPublicUrl(storagePath)

        const { error: upsertError } = await supabase.from('trade_screenshots').upsert(
          {
            user_id: currentUserId,
            trade_id: tradeId,
            slot: screenshot.slot,
            label: screenshot.label,
            storage_path: storagePath,
            public_url: publicData.publicUrl,
          },
          { onConflict: 'trade_id,slot' },
        )

        if (upsertError) {
          throw upsertError
        }

        if (previousRow?.storage_path && previousRow.storage_path !== storagePath) {
          await removeScreenshotStorage([previousRow])
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        if (message.toLowerCase().includes('bucket not found')) {
          console.warn('Trade screenshots bucket is missing. Run supabase/002_trade_screenshots_bucket.sql.', caught)
          continue
        }

        console.warn(`Failed to upload ${screenshot.label}`, caught)
      }
    }
  }

  async function uploadOpenTradeScreenshot(
    currentUserId: string,
    openTradeId: string,
    screenshot: OpenTradeScreenshotDraft & { file: File },
  ) {
    const supabase = useSupabase()
    const storagePath = buildScreenshotPath(currentUserId, openTradeId, 1, screenshot.file.name)

    const { error: uploadError } = await supabase.storage
      .from(screenshotBucket)
      .upload(storagePath, screenshot.file, {
        contentType: screenshot.file.type || 'application/octet-stream',
        upsert: true,
      })

    if (uploadError) {
      throw uploadError
    }

    const { data: publicData } = supabase.storage.from(screenshotBucket).getPublicUrl(storagePath)

    return {
      label: screenshot.label,
      storagePath,
      publicUrl: publicData.publicUrl || null,
    }
  }

  async function attachExistingScreenshotToTrade(
    currentUserId: string,
    tradeId: string,
    screenshot: {
      label: string
      storagePath: string | null
      publicUrl: string | null
    },
  ) {
    if (!screenshot.storagePath && !screenshot.publicUrl) {
      return
    }

    const supabase = useSupabase()
    const resolvedUrl =
      screenshot.publicUrl ||
      (screenshot.storagePath
        ? supabase.storage.from(screenshotBucket).getPublicUrl(screenshot.storagePath).data.publicUrl
        : null)

    const { error } = await supabase.from('trade_screenshots').upsert(
      {
        user_id: currentUserId,
        trade_id: tradeId,
        slot: 1,
        label: screenshot.label,
        storage_path: screenshot.storagePath,
        public_url: resolvedUrl,
      },
      { onConflict: 'trade_id,slot' },
    )

    if (error) {
      throw error
    }
  }

  async function refreshLedger() {
    if (isLoading.value) {
      return
    }

    isLoading.value = true
    loadError.value = null

    try {
      await auth.ensureAuthReady()
      const currentUser = auth.user.value

      if (!currentUser) {
        clearLedgerData()
        hasLoaded.value = true
        return
      }

      const supabase = useSupabase()
      const [
        { data: tradeRows, error: tradeError },
        { data: openTradeRows, error: openTradeError },
        { data: playbookRows, error: playbookError },
        { data: setupRowsData, error: setupError },
        { data: emotionRowsData, error: emotionError },
        { data: instrumentRowsData, error: instrumentError },
      ] = await Promise.all([
        supabase
          .from('trades')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('trade_date', { ascending: false })
          .order('trade_time', { ascending: false }),
        supabase
          .from('open_trades')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('trade_date', { ascending: false })
          .order('trade_time', { ascending: false }),
        supabase
          .from('playbook_setups')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('pnl', { ascending: false }),
        supabase
          .from('trade_setups')
          .select('*')
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('name', { ascending: true }),
        supabase
          .from('trade_emotions')
          .select('*')
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('name', { ascending: true }),
        supabase
          .from('instruments')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('display_name', { ascending: true }),
      ])

      if (tradeError) throw tradeError
      if (openTradeError) throw openTradeError
      if (playbookError) {
        console.warn('Failed to load playbook setups.', playbookError)
      }
      if (setupError) {
        console.warn('Failed to load trade setups dictionary.', setupError)
      }
      if (emotionError) {
        console.warn('Failed to load trade emotions dictionary.', emotionError)
      }
      if (instrumentError) {
        console.warn('Failed to load instruments dictionary.', instrumentError)
      }

      const rows = (tradeRows ?? []) as DbTradeRow[]
      const openRows = (openTradeRows ?? []) as DbOpenTradeRow[]
      instrumentRows.value = instrumentError ? [] : (instrumentRowsData ?? []) as DbInstrumentRow[]
      setupRows.value = setupError ? [] : (setupRowsData ?? []) as DbLookupRow[]
      emotionRows.value = emotionError ? [] : (emotionRowsData ?? []) as DbLookupRow[]
      const tradeIds = rows.map((row) => row.id)
      let screenshotMap = new Map<string, TradeScreenshot[]>()

      if (tradeIds.length) {
        try {
          const { data: screenshotRows, error: screenshotError } = await supabase
            .from('trade_screenshots')
            .select('*')
            .eq('user_id', currentUser.id)
            .in('trade_id', tradeIds)
            .order('slot', { ascending: true })

          if (screenshotError) {
            throw screenshotError
          }

          screenshotMap = new Map<string, TradeScreenshot[]>()
          for (const row of (screenshotRows ?? []) as DbScreenshotRow[]) {
            const resolvedUrl =
              row.public_url ||
              (row.storage_path ? supabase.storage.from(screenshotBucket).getPublicUrl(row.storage_path).data.publicUrl : null)
            const list = screenshotMap.get(row.trade_id) ?? []
            list.push({
              label: row.label || `Screenshot ${list.length + 1}`,
              url: resolvedUrl || null,
            })
            screenshotMap.set(row.trade_id, list)
          }
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : String(caught)
          console.warn('Failed to load trade screenshots.', caught)
          if (!message.toLowerCase().includes('bucket not found')) {
            loadError.value = message
          }
        }
      }

      const nextTrades = rows.map((row) => toTrade(row, screenshotMap.get(row.id) ?? []))
      const nextOpenTrades = openRows.map((row) => toOpenTrade(row))
      tradeItems.value = nextTrades
      openTradeItems.value = nextOpenTrades
      savedPlaybookCards.value = playbookError ? [] : (playbookRows ?? []).map((row) => toPlaybookCard(row as DbPlaybookRow))

      normalizeFilterSelections()

      if (nextTrades.length) {
        const fallbackTrade = nextTrades[0]
        const currentSelection = nextTrades.find((trade) => trade.id === selectedTradeId.value) ?? fallbackTrade
        selectedTradeId.value = currentSelection.id

        if (!nextTrades.some((trade) => trade.date === selectedDay.value)) {
          selectedDay.value = currentSelection.date
        }

        if (!nextTrades.some((trade) => toMonthKey(trade.date) === selectedMonth.value)) {
          selectedMonth.value = toMonthKey(currentSelection.date) as CalendarMonth
        }
      } else {
        selectedTradeId.value = ''
        selectedDay.value = todayKey()
        selectedMonth.value = `${todayKey().slice(0, 7)}` as CalendarMonth
      }

      if (nextOpenTrades.length) {
        if (!nextOpenTrades.some((trade) => trade.id === selectedOpenTradeId.value)) {
          selectedOpenTradeId.value = !nextTrades.length ? nextOpenTrades[0].id : ''
        }
      } else {
        selectedOpenTradeId.value = ''
      }

      hasLoaded.value = true
    } catch (caught) {
      loadError.value = caught instanceof Error ? caught.message : String(caught)
      hasLoaded.value = true
    } finally {
      isLoading.value = false
    }
  }

  async function refreshLedgerAndProfile() {
    await Promise.all([
      refreshLedger(),
      auth.refreshAuth(),
    ])
  }

  async function submitPlaybookDraft() {
    await auth.ensureAuthReady()
    const currentUser = auth.user.value
    if (!currentUser) {
      throw new Error('You need to be logged in to save a playbook setup.')
    }

    const draft = playbookDraft.value
    const nextCard = buildPlaybookCard(draft)
    const supabase = useSupabase()

    const { error } = await supabase.from('playbook_setups').insert({
      user_id: currentUser.id,
      name: nextCard.name,
      grade: nextCard.grade,
      trades: nextCard.trades,
      wins: nextCard.wins,
      losses: nextCard.losses,
      win_rate: nextCard.winRate,
      avg_rr: nextCard.avgRR,
      pnl: nextCard.pnl,
      expectancy: nextCard.expectancy,
      profit_factor: nextCard.profitFactor === 'Infinity' ? 0 : Number(nextCard.profitFactor),
      thesis: draft.thesis.trim(),
    })

    if (error) {
      throw error
    }

    playbookDraft.value = createPlaybookDraft()
    await refreshLedger()
  }

  async function submitOpenTradeDraft(screenshot: OpenTradeScreenshotDraft) {
    await auth.ensureAuthReady()
    const currentUser = auth.user.value
    if (!currentUser) {
      throw new Error('You need to be logged in to start a trade.')
    }

    const supabase = useSupabase()
    const draft = openTradeDraft.value
    const allowedSymbols = symbolOptions.value.map((option) => option.value).filter((value) => value !== 'All')
    const allowedSetups = setupOptions.value.map((option) => option.value).filter((value) => value !== 'All')
    const allowedEmotions = emotionOptions.value.map((option) => option.value).filter((value) => value !== 'All')
    const isEditingOpenTrade = Boolean(editingOpenTradeId.value)
    const validated = validateOpenTradeSubmission(draft, screenshot, allowedSymbols, allowedSetups, allowedEmotions, {
      requireScreenshot: !isEditingOpenTrade,
    })

    const payload = {
      user_id: currentUser.id,
      symbol: validated.symbol,
      trade_date: validated.date,
      trade_time: validated.time,
      direction: validated.direction,
      setup: validated.setup,
      session: validated.session,
      emotion: validated.emotion,
      entry: validated.entry,
      stop_loss: validated.stopLoss,
      take_profit: validated.takeProfit,
      size: validated.size,
      risk_percent: validated.riskPercent,
      why_entered: validated.whyEntered,
      notes: validated.notes,
      screenshot_label: validated.screenshot.label,
    }

    let openTradeId = editingOpenTradeId.value

    if (editingOpenTradeId.value) {
      const existingOpenTrade = openTradeItems.value.find((item) => item.id === editingOpenTradeId.value)
      const { error } = await supabase
        .from('open_trades')
        .update(payload)
        .eq('id', editingOpenTradeId.value)
        .eq('user_id', currentUser.id)

      if (error) {
        throw error
      }

      if (validated.screenshot.file) {
        try {
          const uploadedScreenshot = await uploadOpenTradeScreenshot(currentUser.id, editingOpenTradeId.value, {
            label: validated.screenshot.label,
            file: validated.screenshot.file,
          })

          const { error: updateError } = await supabase
            .from('open_trades')
            .update({
              screenshot_label: uploadedScreenshot.label,
              screenshot_storage_path: uploadedScreenshot.storagePath,
              screenshot_public_url: uploadedScreenshot.publicUrl,
            })
            .eq('id', editingOpenTradeId.value)
            .eq('user_id', currentUser.id)

          if (updateError) {
            throw updateError
          }

          if (existingOpenTrade?.screenshotStoragePath && existingOpenTrade.screenshotStoragePath !== uploadedScreenshot.storagePath) {
            await removeScreenshotStorage([
              {
                trade_id: existingOpenTrade.id,
                slot: 1,
                label: existingOpenTrade.screenshotLabel,
                storage_path: existingOpenTrade.screenshotStoragePath,
                public_url: existingOpenTrade.screenshotUrl,
              },
            ])
          }
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : String(caught)
          if (!message.toLowerCase().includes('bucket not found')) {
            throw caught
          }

          console.warn('Trade screenshots bucket is missing. Run supabase/002_trade_screenshots_bucket.sql.', caught)
        }
      }
    } else {
      const { data: insertedTrade, error } = await supabase
        .from('open_trades')
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        throw error
      }

      openTradeId = insertedTrade?.id ?? null
      if (!openTradeId) {
        throw new Error('Trade was started but no id was returned.')
      }

      try {
        const uploadedScreenshot = await uploadOpenTradeScreenshot(currentUser.id, openTradeId, {
          label: validated.screenshot.label,
          file: validated.screenshot.file as File,
        })

        const { error: updateError } = await supabase
          .from('open_trades')
          .update({
            screenshot_label: uploadedScreenshot.label,
            screenshot_storage_path: uploadedScreenshot.storagePath,
            screenshot_public_url: uploadedScreenshot.publicUrl,
          })
          .eq('id', openTradeId)
          .eq('user_id', currentUser.id)

        if (updateError) {
          throw updateError
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught)
        if (!message.toLowerCase().includes('bucket not found')) {
          throw caught
        }

        console.warn('Trade screenshots bucket is missing. Run supabase/002_trade_screenshots_bucket.sql.', caught)
      }
    }

    openTradeDraft.value = createOpenTradeDraft(validated.date)
    editingOpenTradeId.value = null
    selectedOpenTradeId.value = openTradeId
    selectedTradeId.value = ''
    selectedDay.value = validated.date
    selectedMonth.value = toMonthKey(validated.date) as CalendarMonth
    isOpenTradeDialogOpen.value = false
    await refreshLedger()
  }

  async function submitTradeDraft(screenshots: TradeScreenshotDraft[] = []) {
    await auth.ensureAuthReady()
    const currentUser = auth.user.value
    if (!currentUser) {
      throw new Error('You need to be logged in to save a trade.')
    }

    const draft = newTradeDraft.value
    const supabase = useSupabase()
    const allowedSymbols = symbolOptions.value.map((option) => option.value).filter((value) => value !== 'All')
    const allowedSetups = setupOptions.value.map((option) => option.value).filter((value) => value !== 'All')
    const allowedEmotions = emotionOptions.value.map((option) => option.value).filter((value) => value !== 'All')
    const validated = validateTradeSubmission(draft, screenshots, allowedSymbols, allowedSetups, allowedEmotions)
    const netPnl = normalizeTradePnl(validated.result, validated.netPnl)
    const commission = validated.commission
    const result = validated.result || (netPnl > 0 ? 'Win' : netPnl < 0 ? 'Loss' : 'BE')

    const payload = {
      user_id: currentUser.id,
      symbol: validated.symbol,
      trade_date: validated.date,
      trade_time: validated.time,
      direction: draft.direction,
      setup: validated.setup,
      session: validated.session,
      emotion: validated.emotion,
      result,
      net_pnl: netPnl,
      gross_pnl: Number(netPnl + commission),
      commission,
      rr: validated.rr,
      hold_minutes: validated.holdMinutes,
      entry: validated.entry,
      exit: validated.exit,
      stop_loss: validated.stopLoss,
      take_profit: validated.takeProfit,
      size: validated.size,
      risk_percent: validated.riskPercent,
      why_entered: validated.whyEntered,
      what_went_well: validated.whatWentWell,
      what_to_improve: validated.whatToImprove,
      notes: validated.notes,
      tags: parseList(validated.tags),
    }

    let savedTradeId = editingTradeId.value

    if (editingTradeId.value) {
      const existingScreenshotRows = await fetchTradeScreenshotRows(currentUser.id, editingTradeId.value)
      const { error } = await supabase
        .from('trades')
        .update(payload)
        .eq('id', editingTradeId.value)
        .eq('user_id', currentUser.id)

      if (error) {
        throw error
      }

      await saveTradeScreenshots(currentUser.id, editingTradeId.value, validated.screenshots, existingScreenshotRows)
    } else {
      const { data: insertedTrade, error } = await supabase
        .from('trades')
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        throw error
      }

      savedTradeId = insertedTrade?.id ?? null

      if (savedTradeId && validated.screenshots.length) {
        await saveTradeScreenshots(currentUser.id, savedTradeId, validated.screenshots)
      }
    }

    newTradeDraft.value = createDraft(validated.date)
    editingTradeId.value = null
    selectedTradeId.value = savedTradeId ?? selectedTradeId.value
    selectedDay.value = validated.date
    selectedMonth.value = toMonthKey(validated.date) as CalendarMonth
    isTradeDialogOpen.value = false
    await refreshLedgerAndProfile()
  }

  async function submitOpenTradeCloseDraft(screenshots: TradeScreenshotDraft[] = []) {
    await auth.ensureAuthReady()
    const currentUser = auth.user.value
    if (!currentUser) {
      throw new Error('You need to be logged in to close a trade.')
    }

    const openTradeId = closingOpenTradeId.value
    if (!openTradeId) {
      throw new Error('Choose an active trade before closing it.')
    }

    const openTrade = openTradeItems.value.find((item) => item.id === openTradeId)
    if (!openTrade) {
      throw new Error('The active trade could not be found.')
    }

    const draft = closeTradeDraft.value
    const supabase = useSupabase()
    const allowedSymbols = symbolOptions.value.map((option) => option.value).filter((value) => value !== 'All')
    const allowedSetups = setupOptions.value.map((option) => option.value).filter((value) => value !== 'All')
    const allowedEmotions = emotionOptions.value.map((option) => option.value).filter((value) => value !== 'All')
    const validated = validateTradeSubmission(draft, screenshots, allowedSymbols, allowedSetups, allowedEmotions)
    const netPnl = normalizeTradePnl(validated.result, validated.netPnl)
    const commission = validated.commission
    const result = validated.result || (netPnl > 0 ? 'Win' : netPnl < 0 ? 'Loss' : 'BE')

    const payload = {
      user_id: currentUser.id,
      symbol: validated.symbol,
      trade_date: validated.date,
      trade_time: validated.time,
      direction: draft.direction,
      setup: validated.setup,
      session: validated.session,
      emotion: validated.emotion,
      result,
      net_pnl: netPnl,
      gross_pnl: Number(netPnl + commission),
      commission,
      rr: validated.rr,
      hold_minutes: validated.holdMinutes,
      entry: validated.entry,
      exit: validated.exit,
      stop_loss: validated.stopLoss,
      take_profit: validated.takeProfit,
      size: validated.size,
      risk_percent: validated.riskPercent,
      why_entered: validated.whyEntered,
      what_went_well: validated.whatWentWell,
      what_to_improve: validated.whatToImprove,
      notes: validated.notes,
      tags: parseList(validated.tags),
    }

    const { data: insertedTrade, error } = await supabase
      .from('trades')
      .insert(payload)
      .select('id')
      .single()

    if (error) {
      throw error
    }

    const tradeId = insertedTrade?.id
    if (!tradeId) {
      throw new Error('Closed trade was saved but no id was returned.')
    }

    try {
      await attachExistingScreenshotToTrade(currentUser.id, tradeId, {
        label: openTrade.screenshotLabel || 'Before trade',
        storagePath: openTrade.screenshotStoragePath,
        publicUrl: openTrade.screenshotUrl,
      })
    } catch (caught) {
      console.warn('Failed to attach the start screenshot to the closed trade.', caught)
    }

    if (validated.screenshots.length) {
      await saveTradeScreenshots(currentUser.id, tradeId, validated.screenshots)
    }

    const { error: deleteError } = await supabase
      .from('open_trades')
      .delete()
      .eq('id', openTradeId)
      .eq('user_id', currentUser.id)

    if (deleteError) {
      throw deleteError
    }

    closeTradeDraft.value = createDraft(validated.date)
    closingOpenTradeId.value = null
    selectedOpenTradeId.value = ''
    selectedTradeId.value = tradeId
    selectedDay.value = validated.date
    selectedMonth.value = toMonthKey(validated.date) as CalendarMonth
    isOpenTradeDialogOpen.value = false
    await refreshLedgerAndProfile()
  }

  function openTradeDialog(date = selectedDay.value) {
    editingTradeId.value = null
    newTradeDraft.value = createDraft(date)
    isTradeDialogOpen.value = true
  }

  function openStartTradeDialog(date = selectedDay.value) {
    openTradeDialogMode.value = 'start'
    editingOpenTradeId.value = null
    closingOpenTradeId.value = null
    openTradeDraft.value = createOpenTradeDraft(date)
    isOpenTradeDialogOpen.value = true
  }

  function openOpenTradeEditDialog(openTradeId: string) {
    const trade = openTradeItems.value.find((item) => item.id === openTradeId)
    if (!trade) {
      return
    }

    selectedOpenTradeId.value = trade.id
    openTradeDialogMode.value = 'edit'
    editingOpenTradeId.value = trade.id
    closingOpenTradeId.value = null
    openTradeDraft.value = createOpenTradeDraftFromTrade(trade)
    isOpenTradeDialogOpen.value = true
  }

  function openOpenTradeCloseDialog(openTradeId: string) {
    const trade = openTradeItems.value.find((item) => item.id === openTradeId)
    if (!trade) {
      return
    }

    selectedOpenTradeId.value = trade.id
    openTradeDialogMode.value = 'close'
    editingOpenTradeId.value = null
    closingOpenTradeId.value = trade.id
    closeTradeDraft.value = createDraftFromOpenTrade(trade)
    isOpenTradeDialogOpen.value = true
  }

  function openTradeEditDialog(tradeId: string) {
    const trade = tradeItems.value.find((item) => item.id === tradeId)
    if (!trade) {
      return
    }

    editingTradeId.value = trade.id
    newTradeDraft.value = createDraftFromTrade(trade)
    isTradeDialogOpen.value = true
  }

  function closeTradeDialog() {
    editingTradeId.value = null
    isTradeDialogOpen.value = false
  }

  function closeOpenTradeDialog() {
    editingOpenTradeId.value = null
    closingOpenTradeId.value = null
    isOpenTradeDialogOpen.value = false
  }

  function setCalendarMonth(monthKey: string) {
    selectedMonth.value = monthKey as CalendarMonth
    const monthTrades = tradeItems.value.filter((trade) => toMonthKey(trade.date) === monthKey)
    selectedDay.value = monthTrades[0]?.date ?? `${monthKey}-01`
  }

  function previousCalendarMonth() {
    setCalendarMonth(shiftMonth(selectedMonth.value, -1))
  }

  function nextCalendarMonth() {
    setCalendarMonth(shiftMonth(selectedMonth.value, 1))
  }

  function selectFirstAvailableTrade() {
    const firstTrade = tradeItems.value[0]
    if (!firstTrade) {
      return
    }

    selectedTradeId.value = firstTrade.id
    selectedDay.value = firstTrade.date
    selectedMonth.value = toMonthKey(firstTrade.date) as CalendarMonth
  }

  async function deleteTrade(tradeId: string) {
    await auth.ensureAuthReady()
    const currentUser = auth.user.value
    if (!currentUser) {
      throw new Error('You need to be logged in to delete a trade.')
    }

    const trade = tradeItems.value.find((item) => item.id === tradeId)
    if (!trade) {
      return
    }

    if (!window.confirm(`Delete trade ${trade.symbol} ${trade.date} ${trade.time}?`)) {
      return
    }

    try {
      const supabase = useSupabase()
      const screenshotRows = await fetchTradeScreenshotRows(currentUser.id, tradeId)
      await removeScreenshotStorage(screenshotRows)

      const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', tradeId)
        .eq('user_id', currentUser.id)

      if (error) {
        throw error
      }

      if (editingTradeId.value === tradeId) {
        editingTradeId.value = null
        isTradeDialogOpen.value = false
      }

      if (selectedTradeId.value === tradeId) {
        selectedTradeId.value = ''
      }

      await refreshLedgerAndProfile()
    } catch (caught) {
      loadError.value = caught instanceof Error ? caught.message : String(caught)
    }
  }

  async function deleteOpenTrade(openTradeId: string) {
    await auth.ensureAuthReady()
    const currentUser = auth.user.value
    if (!currentUser) {
      throw new Error('You need to be logged in to delete an active trade.')
    }

    const trade = openTradeItems.value.find((item) => item.id === openTradeId)
    if (!trade) {
      return
    }

    if (!window.confirm(`Remove active trade ${trade.symbol} ${trade.date} ${trade.time}?`)) {
      return
    }

    try {
      if (trade.screenshotStoragePath) {
        await removeScreenshotStorage([
          {
            trade_id: trade.id,
            slot: 1,
            label: trade.screenshotLabel,
            storage_path: trade.screenshotStoragePath,
            public_url: trade.screenshotUrl,
          },
        ])
      }

      const supabase = useSupabase()
      const { error } = await supabase
        .from('open_trades')
        .delete()
        .eq('id', openTradeId)
        .eq('user_id', currentUser.id)

      if (error) {
        throw error
      }

      if (closingOpenTradeId.value === openTradeId) {
        closingOpenTradeId.value = null
        isOpenTradeDialogOpen.value = false
      }

      if (editingOpenTradeId.value === openTradeId) {
        editingOpenTradeId.value = null
        isOpenTradeDialogOpen.value = false
      }

      if (selectedOpenTradeId.value === openTradeId) {
        selectedOpenTradeId.value = ''
      }

      await refreshLedger()
    } catch (caught) {
      loadError.value = caught instanceof Error ? caught.message : String(caught)
    }
  }

  async function exportCurrentView(format: ExportFormat = exportFormat.value) {
    const trades = filteredTrades.value

    if (format === 'csv') {
      downloadTextFile(`pnl-ledger-${selectedMonth.value}.csv`, buildCsv(trades), 'text/csv')
      return
    }

    if (format === 'report') {
      downloadTextFile(`pnl-ledger-report-${selectedMonth.value}.md`, buildReport(trades), 'text/markdown')
      return
    }

    openPrintableReport(buildPrintableHtml(trades))
  }

  const filteredTrades = computed(() => {
    const query = String(searchQuery.value ?? '').trim().toLowerCase()
    const anchorDate =
      tradeItems.value.reduce((latest, trade) => (trade.date > latest ? trade.date : latest), tradeItems.value[0]?.date ?? todayKey())

    return tradeItems.value.filter((trade) => {
      const matchesSearch =
        !query ||
        [trade.symbol, trade.setup, trade.notes, trade.whyEntered, trade.whatWentWell, trade.whatToImprove]
          .join(' ')
          .toLowerCase()
          .includes(query)
      const matchesSymbol = selectedSymbol.value === 'All' || trade.symbol === selectedSymbol.value
      const matchesSetup = selectedSetup.value === 'All' || trade.setup === selectedSetup.value
      const matchesSession = selectedSession.value === 'All' || trade.session === selectedSession.value
      const matchesEmotion = selectedEmotion.value === 'All' || trade.emotion === selectedEmotion.value
      const matchesTimeframe =
        timeframe.value === 'All'
          ? true
          : timeframe.value === 'Today'
            ? trade.date === anchorDate
            : timeframe.value === 'Week'
              ? (() => {
                  const delta = new Date(`${anchorDate}T00:00:00Z`).getTime() - new Date(`${trade.date}T00:00:00Z`).getTime()
                  return delta >= 0 && delta <= 6 * 24 * 60 * 60 * 1000
                })()
              : trade.date.slice(0, 7) === anchorDate.slice(0, 7)

      return matchesSearch && matchesSymbol && matchesSetup && matchesSession && matchesEmotion && matchesTimeframe
    })
  })

  const filteredOpenTrades = computed(() => {
    const query = String(searchQuery.value ?? '').trim().toLowerCase()
    const anchorDate =
      openTradeItems.value.reduce((latest, trade) => (trade.date > latest ? trade.date : latest), openTradeItems.value[0]?.date ?? todayKey())

    return openTradeItems.value.filter((trade) => {
      const matchesSearch =
        !query ||
        [trade.symbol, trade.setup, trade.notes, trade.whyEntered]
          .join(' ')
          .toLowerCase()
          .includes(query)
      const matchesSymbol = selectedSymbol.value === 'All' || trade.symbol === selectedSymbol.value
      const matchesSetup = selectedSetup.value === 'All' || trade.setup === selectedSetup.value
      const matchesSession = selectedSession.value === 'All' || trade.session === selectedSession.value
      const matchesEmotion = selectedEmotion.value === 'All' || trade.emotion === selectedEmotion.value
      const matchesTimeframe =
        timeframe.value === 'All'
          ? true
          : timeframe.value === 'Today'
            ? trade.date === anchorDate
            : timeframe.value === 'Week'
              ? (() => {
                  const delta = new Date(`${anchorDate}T00:00:00Z`).getTime() - new Date(`${trade.date}T00:00:00Z`).getTime()
                  return delta >= 0 && delta <= 6 * 24 * 60 * 60 * 1000
                })()
              : trade.date.slice(0, 7) === anchorDate.slice(0, 7)

      return matchesSearch && matchesSymbol && matchesSetup && matchesSession && matchesEmotion && matchesTimeframe
    })
  })

  const symbolOptions = computed(() => {
    const activeInstruments = instrumentRows.value.filter((instrument) => instrument.is_active)

    if (!activeInstruments.length) {
      return fallbackSymbolOptions
    }

    return [
      fallbackSymbolOptions[0],
      ...activeInstruments.map((instrument) => ({
        label: instrument.display_name || instrument.symbol,
        value: instrument.symbol,
      })),
    ]
  })

  const setupOptions = computed(() => {
    if (!setupRows.value.length) {
      return fallbackSetupOptions
    }

    return [
      { label: 'All Setups', value: 'All' },
      ...setupRows.value
        .filter((setup) => setup.is_active)
        .map((setup) => ({
          label: setup.name,
          value: setup.name,
        })),
    ]
  })

  const emotionOptions = computed(() => {
    if (!emotionRows.value.length) {
      return fallbackEmotionOptions
    }

    return [
      { label: 'All Emotions', value: 'All' },
      ...emotionRows.value
        .filter((emotion) => emotion.is_active)
        .map((emotion) => ({
          label: emotion.name,
          value: emotion.name,
        })),
    ]
  })

  const stats = computed(() => {
    const series = filteredTrades.value
    const totalTrades = series.length
    const wins = series.filter((trade) => trade.result === 'Win')
    const losses = series.filter((trade) => trade.result === 'Loss')
    const breakeven = series.filter((trade) => trade.result === 'BE')
    const netPnl = series.reduce((sum, trade) => sum + trade.netPnl, 0)
    const grossWins = wins.reduce((sum, trade) => sum + trade.netPnl, 0)
    const grossLosses = Math.abs(losses.reduce((sum, trade) => sum + trade.netPnl, 0))
    const profitFactor = grossLosses === 0 ? grossWins : grossWins / grossLosses
    const averageWin = wins.length ? grossWins / wins.length : 0
    const averageLoss = losses.length ? grossLosses / losses.length : 0
    const avgRR = totalTrades
      ? series.reduce((sum, trade) => sum + trade.rr, 0) / totalTrades
      : 0
    const expectancy = totalTrades ? netPnl / totalTrades : 0
    const winRate = totalTrades ? (wins.length / totalTrades) * 100 : 0
    const streak = getWinStreak(series)

    return {
      totalTrades,
      wins: wins.length,
      losses: losses.length,
      breakeven: breakeven.length,
      netPnl,
      grossWins,
      grossLosses,
      profitFactor,
      averageWin,
      averageLoss,
      avgRR,
      expectancy,
      winRate,
      streak,
      avgHoldMinutes: totalTrades
        ? Math.round(series.reduce((sum, trade) => sum + trade.holdMinutes, 0) / totalTrades)
        : 0,
    }
  })

  const recentTrades = computed(() => [...filteredTrades.value].sort((a, b) => {
    const left = `${a.date}T${a.time}:00`
    const right = `${b.date}T${b.time}:00`
    return right.localeCompare(left)
  }))

  const selectedTrade = computed(() =>
    tradeItems.value.find((trade) => trade.id === selectedTradeId.value) ?? tradeItems.value[0] ?? null,
  )
  const selectedOpenTrade = computed(() =>
    openTradeItems.value.find((trade) => trade.id === selectedOpenTradeId.value) ?? null,
  )

  const selectedDayTrades = computed(() => {
    const day = selectedDay.value
    return tradeItems.value
      .filter((trade) => trade.date === day)
      .sort((a, b) => b.time.localeCompare(a.time))
  })

  const dailySeries = computed(() => buildDailySeries(filteredTrades.value))
  const calendarDays = computed(() => buildCalendar(filteredTrades.value, selectedMonth.value))
  const setups = computed(() => buildGroupStats(filteredTrades.value, 'setup'))
  const sessions = computed(() => buildGroupStats(filteredTrades.value, 'session'))
  const emotions = computed(() => buildGroupStats(filteredTrades.value, 'emotion'))
  const symbols = computed(() => buildGroupStats(filteredTrades.value, 'symbol'))

  const equitySeries = computed(() => {
    let running = 0
    return dailySeries.value.map((day) => {
      running += day.pnl
      return {
        x: day.label,
        y: Number(running.toFixed(2)),
      }
    })
  })

  const hourlySeries = computed(() =>
    Array.from({ length: 24 }, (_, hour) => {
      const matching = filteredTrades.value.filter((trade) => Number.parseInt(trade.time.slice(0, 2), 10) === hour)
      const pnl = matching.reduce((sum, trade) => sum + trade.netPnl, 0)
      return { hour, pnl, trades: matching.length }
    }),
  )

  const sessionBars = computed(() =>
    sessions.value.map((item) => ({
      ...item,
      display: formatSign(item.pnl),
    })),
  )

  const setupBars = computed(() =>
    setups.value.map((item) => ({
      ...item,
      grade: item.pnl > 250 ? 'A' : item.pnl > 0 ? 'B' : 'D',
    })),
  )

  const playbookCards = computed(() =>
    setupBars.value.map((item) => ({
      ...item,
      winRateLabel: `${decimal.format(item.winRate)}%`,
      avgRRLabel: `1 : ${formatTruncatedDecimal(item.avgRR)}`,
      expectancy: item.trades ? item.pnl / item.trades : 0,
      expectancyLabel: formatSign(item.trades ? item.pnl / item.trades : 0),
      profitFactor: item.losses === 0 ? 'Infinity' : (item.wins ? item.wins / item.losses : 0).toFixed(2),
    })),
  )

  const combinedPlaybookCards = computed(() => [
    ...savedPlaybookCards.value,
    ...playbookCards.value,
  ].sort((left, right) => right.pnl - left.pnl))

  const heatmapSeries = computed(() =>
    Array.from({ length: 7 }, (_, weekdayIndex) => {
      const dayName = weekOrder[weekdayIndex]
      return {
        name: dayName,
        data: Array.from({ length: 24 }, (_, hour) => {
          const tradesAtHour = filteredTrades.value.filter(
            (trade) =>
              getDayName(trade.date) === dayName &&
              Number.parseInt(trade.time.slice(0, 2), 10) === hour,
          )
          return tradesAtHour.reduce((sum, trade) => sum + trade.netPnl, 0)
        }),
      }
    }),
  )

  const journalDays = computed(() => {
    const grouped = new Map<string, Trade[]>()
    for (const trade of filteredTrades.value) {
      const bucket = grouped.get(trade.date) ?? []
      bucket.push(trade)
      grouped.set(trade.date, bucket)
    }

    return [...grouped.entries()]
      .map(([date, items]) => ({
        date,
        label: new Intl.DateTimeFormat('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          timeZone: 'UTC',
        }).format(new Date(`${date}T00:00:00Z`)),
        pnl: items.reduce((sum, trade) => sum + trade.netPnl, 0),
        trades: items.sort((a, b) => a.time.localeCompare(b.time)),
        wins: items.filter((trade) => trade.result === 'Win').length,
        losses: items.filter((trade) => trade.result === 'Loss').length,
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
  })

  const dashboardKpis = computed(() => [
    {
      label: 'P&L',
      value: formatSign(stats.value.netPnl),
      note: `${stats.value.totalTrades} trades`,
      icon: 'mdi-currency-usd',
      tone: 'positive',
    },
    {
      label: 'Win Rate',
      value: `${decimal.format(stats.value.winRate)}%`,
      note: `${stats.value.wins}W - ${stats.value.losses}L - ${stats.value.breakeven}BE`,
      icon: 'mdi-target',
      tone: 'neutral',
      progress: stats.value.winRate / 100,
    },
    {
      label: 'Profit Factor',
      value: stats.value.profitFactor.toFixed(2),
      note: 'Expectancy + edge quality',
      icon: 'mdi-scale-balance',
      tone: 'positive',
    },
    {
      label: 'Avg R:R',
      value: `1 : ${formatTruncatedDecimal(stats.value.avgRR)}`,
      note: `Hold ${stats.value.avgHoldMinutes}m`,
      icon: 'mdi-trending-up',
      tone: 'neutral',
    },
    {
      label: 'Avg Win',
      value: formatSign(stats.value.averageWin),
      note: `Best streak ${stats.value.streak.best}`,
      icon: 'mdi-arrow-top-right',
      tone: 'positive',
    },
    {
      label: 'Avg Loss',
      value: formatSign(-stats.value.averageLoss),
      note: `Worst streak ${stats.value.streak.worst}`,
      icon: 'mdi-arrow-bottom-right',
      tone: 'negative',
    },
    {
      label: 'Total Trades',
      value: decimal.format(stats.value.totalTrades),
      note: 'Since inception',
      icon: 'mdi-waveform',
      tone: 'neutral',
    },
  ])

  const calendarMonthLabel = computed(() => getMonthLabel(`${selectedMonth.value}-01`))

  onMounted(() => {
    if (!hasLoaded.value && !isLoading.value) {
      void refreshLedger()
    }
  })

  return {
    timeframe,
    rangeOptions,
    exportOptions,
    exportFormat,
    navigationItems,
    trades: tradeItems,
    openTrades: openTradeItems,
    setupOptions,
    sessionOptions,
    emotionOptions,
    symbolOptions,
    selectedSymbol,
    selectedSetup,
    selectedSession,
    selectedEmotion,
    selectedTradeId,
    selectedOpenTradeId,
    editingTradeId,
    editingOpenTradeId,
    selectedDay,
    selectedMonth,
    calendarMonthLabel,
    isTradeDialogOpen,
    isOpenTradeDialogOpen,
    openTradeDialogMode,
    isLoading,
    loadError,
    hasLoaded,
    newTradeDraft,
    openTradeDraft,
    closeTradeDraft,
    playbookDraft,
    searchQuery,
    filteredTrades,
    filteredOpenTrades,
    recentTrades,
    selectedTrade,
    selectedOpenTrade,
    selectedDayTrades,
    stats,
    dailySeries,
    calendarDays,
    setups,
    sessions,
    emotions,
    symbols,
    dashboardKpis,
    equitySeries,
    hourlySeries,
    sessionBars,
    setupBars,
    playbookCards,
    savedPlaybookCards,
    combinedPlaybookCards,
    heatmapSeries,
    journalDays,
    openTradeDialog,
    openStartTradeDialog,
    openOpenTradeEditDialog,
    openOpenTradeCloseDialog,
    openTradeEditDialog,
    closeTradeDialog,
    closeOpenTradeDialog,
    submitPlaybookDraft,
    submitOpenTradeDraft,
    submitTradeDraft,
    submitOpenTradeCloseDraft,
    deleteTrade,
    deleteOpenTrade,
    setCalendarMonth,
    previousCalendarMonth,
    nextCalendarMonth,
    selectFirstAvailableTrade,
    refreshLedger,
    clearLedgerData,
    exportCurrentView,
    formatMoney: (value: number) => money.format(value),
    formatPlainMoney: (value: number) => plainMoney.format(value),
    formatPercent: (value: number) => percent.format(value),
    formatSignedMoney: formatSign,
    formatNumber: (value: number) => decimal.format(value),
    formatRatio: (value: number | string | null | undefined) => formatTruncatedDecimal(value),
    formatPrice: (value: number) => preciseDecimal.format(value),
    getMonthLabel,
  }
}

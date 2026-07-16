type SupportedSymbol =
  | 'EURUSD'
  | 'GBPUSD'
  | 'USDJPY'
  | 'USDCHF'
  | 'EURCHF'
  | 'GBPCHF'
  | 'XAUUSD'
  | 'NAS100'
  | 'NASDAQ'
  | 'US30'
  | 'US500'

type QuoteStatus = 'ok' | 'fallback' | 'error'

type QuoteItem = {
  symbol: string
  price: number | null
  timestamp: string
  status: QuoteStatus
  source: 'yahoo' | 'frankfurter' | 'none'
}

type QuoteResponse = {
  status: 'ok' | 'fallback' | 'partial' | 'error'
  data: QuoteItem[]
}

type YahooQuote = {
  symbol: string
  regularMarketPrice?: number
  regularMarketTime?: number
}

const YAHOO_TARGETS: Record<string, string[]> = {
  EURUSD: ['EURUSD=X'],
  GBPUSD: ['GBPUSD=X'],
  USDJPY: ['USDJPY=X'],
  USDCHF: ['USDCHF=X'],
  EURCHF: ['EURCHF=X'],
  GBPCHF: ['GBPCHF=X'],
  XAUUSD: ['XAUUSD=X', 'GC=F'],
  NAS100: ['^NDX', 'NQ=F'],
  NASDAQ: ['^IXIC'],
  US30: ['^DJI', 'YM=F'],
  US500: ['^GSPC', 'ES=F'],
}

const FX_FALLBACK_SYMBOLS = new Set<SupportedSymbol>(['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'EURCHF', 'GBPCHF'])

function parseRequestedSymbols(query: Record<string, string | string[] | undefined>) {
  const rawValues = [query.symbol, query.symbols]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter((value): value is string => typeof value === 'string' && value.length > 0)

  const requested = rawValues
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean)

  return [...new Set(requested)]
}

function targetSymbolsFor(requested: string) {
  return YAHOO_TARGETS[requested] ?? [requested]
}

function toIsoTimestamp(seconds?: number) {
  if (!seconds) {
    return new Date().toISOString()
  }

  return new Date(seconds * 1000).toISOString()
}

function resolveFxFallback(symbol: SupportedSymbol, usdRates: Record<string, number>) {
  const match = symbol.match(/^([A-Z]{3})([A-Z]{3})$/)
  if (!match) {
    return null
  }

  const [, baseCurrency, quoteCurrency] = match
  const baseRate = baseCurrency === 'USD' ? 1 : usdRates[baseCurrency]
  const quoteRate = quoteCurrency === 'USD' ? 1 : usdRates[quoteCurrency]

  if (!baseRate || !quoteRate || !Number.isFinite(baseRate) || !Number.isFinite(quoteRate)) {
    return null
  }

  return quoteRate / baseRate
}

async function fetchYahooQuotes(targets: string[]) {
  if (!targets.length) {
    return new Map<string, YahooQuote>()
  }

  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(targets.join(','))}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Yahoo Finance request failed with status ${response.status}.`)
  }

  const payload = await response.json() as {
    quoteResponse?: {
      result?: YahooQuote[]
    }
  }

  const quotes = new Map<string, YahooQuote>()
  for (const quote of payload.quoteResponse?.result ?? []) {
    quotes.set(quote.symbol, quote)
  }

  return quotes
}

async function fetchFxFallbackRates() {
  const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CHF')
  if (!response.ok) {
    throw new Error(`FX fallback request failed with status ${response.status}.`)
  }

  const payload = await response.json() as {
    rates?: Record<string, number>
  }

  return payload.rates ?? {}
}

function buildResultItem(symbol: string, price: number | null, timestamp: string, status: QuoteStatus, source: QuoteItem['source']): QuoteItem {
  return {
    symbol,
    price,
    timestamp,
    status,
    source,
  }
}

export default defineEventHandler(async (event): Promise<QuoteResponse> => {
  const searchParams = getQuery(event)
  const requestedSymbols = parseRequestedSymbols(searchParams)
  if (!requestedSymbols.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Pass symbol or symbols.',
    })
  }

  const yahooTargets = [...new Set(requestedSymbols.flatMap((symbol) => targetSymbolsFor(symbol)))]
  const yahooQuotes = await fetchYahooQuotes(yahooTargets).catch(() => new Map<string, YahooQuote>())
  const fxFallbackRates = await fetchFxFallbackRates().catch(() => ({} as Record<string, number>))

  const data = requestedSymbols.map((symbol) => {
    const targets = targetSymbolsFor(symbol)
    const yahooQuote = targets.map((target) => yahooQuotes.get(target)).find((quote) => quote && typeof quote.regularMarketPrice === 'number')
    if (yahooQuote) {
      return buildResultItem(
        symbol,
        yahooQuote.regularMarketPrice ?? null,
        toIsoTimestamp(yahooQuote.regularMarketTime),
        'ok',
        'yahoo',
      )
    }

    if (FX_FALLBACK_SYMBOLS.has(symbol as SupportedSymbol)) {
      const fallbackPrice = resolveFxFallback(symbol as SupportedSymbol, fxFallbackRates)
      if (fallbackPrice !== null) {
        return buildResultItem(symbol, fallbackPrice, new Date().toISOString(), 'fallback', 'frankfurter')
      }
    }

    return buildResultItem(symbol, null, new Date().toISOString(), 'error', 'none')
  })

  const status = data.every((item) => item.status === 'ok')
    ? 'ok'
    : data.some((item) => item.price !== null)
      ? data.some((item) => item.status === 'error')
        ? 'partial'
        : 'fallback'
      : 'error'

  return {
    status,
    data,
  }
})

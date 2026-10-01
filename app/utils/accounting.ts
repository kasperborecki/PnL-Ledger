export type Payout = {
  id: string
  account_id: string
  status: 'requested' | 'approved' | 'received' | 'rejected'
  requested_on: string
  received_on: string | null
  gross_amount: number
  profit_split: number
  received_amount: number
  currency: string
  balance_effect: number
  notes: string
}

export type CashEntry = {
  id: string
  account_id: string
  kind: 'challenge' | 'reset' | 'fee' | 'refund'
  amount: number
  currency: string
  happened_on: string
  notes: string
}

// Personal cash result is grouped by settlement currency, never by account size.
export function cashSummary(payouts: Payout[], entries: CashEntry[]) {
  const totals = new Map<string, { currency: string; received: number; costs: number; refunds: number; net: number }>()
  const bucket = (currency: string) => {
    if (!totals.has(currency)) totals.set(currency, { currency, received: 0, costs: 0, refunds: 0, net: 0 })
    return totals.get(currency)!
  }
  for (const payout of payouts) {
    if (payout.status === 'received') bucket(payout.currency).received += Number(payout.received_amount)
  }
  for (const entry of entries) {
    const total = bucket(entry.currency)
    if (entry.kind === 'refund') total.refunds += Number(entry.amount)
    else total.costs += Number(entry.amount)
  }
  return [...totals.values()].map(total => ({ ...total, net: Math.round((total.received + total.refunds - total.costs) * 100) / 100 })).sort((a, b) => a.currency.localeCompare(b.currency))
}

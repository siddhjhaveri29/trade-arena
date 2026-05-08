import { useEffect } from 'react'
import { usePriceContext } from '../context/PriceContext'

export function usePrices(symbols, market) {
  const { prices, subscribe, unsubscribe } = usePriceContext()

  useEffect(() => {
    if (!symbols || symbols.length === 0) return
    subscribe(symbols, market)
    return () => unsubscribe(symbols, market)
  }, [symbols?.join(','), market])

  if (!symbols) return {}
  return symbols.reduce((acc, sym) => {
    acc[sym] = prices[sym] ?? null
    return acc
  }, {})
}

export function usePrice(symbol, market) {
  const { prices, subscribe, unsubscribe } = usePriceContext()

  useEffect(() => {
    if (!symbol) return
    subscribe([symbol], market)
    return () => unsubscribe([symbol], market)
  }, [symbol, market])

  return prices[symbol] ?? null
}

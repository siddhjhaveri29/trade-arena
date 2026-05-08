import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { apiFetch } from './AuthContext'

const PriceContext = createContext(null)

const WS_URL = import.meta.env.PROD
  ? `wss://${window.location.host}/ws`
  : (import.meta.env.VITE_WS_URL || 'ws://localhost:3001') + '/ws'

export function PriceProvider({ children }) {
  const [prices, setPrices] = useState({})
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const pollTimer = useRef(null)
  const subscribedSymbols = useRef({ IN: new Set(), US: new Set() })
  const mountedRef = useRef(true)

  const updatePrices = useCallback((newPrices) => {
    setPrices(prev => ({ ...prev, ...newPrices }))
  }, [])

  // Polling fallback
  function startPolling() {
    if (pollTimer.current) return
    pollTimer.current = setInterval(async () => {
      const allSymbols = [
        ...Array.from(subscribedSymbols.current.IN),
        ...Array.from(subscribedSymbols.current.US)
      ]
      if (allSymbols.length === 0) return
      try {
        const API_BASE = import.meta.env.VITE_API_URL || ''
        const res = await fetch(`${API_BASE}/api/prices?symbols=${allSymbols.join(',')}`)
        const data = await res.json()
        if (mountedRef.current) updatePrices(data)
      } catch (e) {/* ignore */}
    }, 3000)
  }

  function stopPolling() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
  }

  function connect() {
    if (!mountedRef.current) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      setConnected(true)
      stopPolling()
      console.log('[PriceContext] WebSocket connected')
    }

    ws.onmessage = (event) => {
      if (!mountedRef.current) return
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'prices') updatePrices(msg.data)
        if (msg.type === 'order_filled') {
          window.dispatchEvent(new CustomEvent('order_filled', { detail: msg }))
        }
      } catch (e) {/* ignore */}
    }

    ws.onclose = () => {
      if (!mountedRef.current) return
      setConnected(false)
      wsRef.current = null
      // Start polling fallback
      startPolling()
      // Attempt reconnect after 3s
      reconnectTimer.current = setTimeout(() => {
        if (mountedRef.current) connect()
      }, 3000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }

  useEffect(() => {
    mountedRef.current = true
    connect()

    // Fallback: start polling if WS doesn't connect within 5s
    const fallbackTimer = setTimeout(() => {
      if (!connected) startPolling()
    }, 5000)

    return () => {
      mountedRef.current = false
      clearTimeout(fallbackTimer)
      clearTimeout(reconnectTimer.current)
      stopPolling()
      wsRef.current?.close()
    }
  }, [])

  const subscribe = useCallback(async (symbols, market) => {
    const symbolList = Array.isArray(symbols) ? symbols : [symbols]
    symbolList.forEach(s => subscribedSymbols.current[market]?.add(s))

    try {
      await apiFetch('/api/prices/subscribe', {
        method: 'POST',
        body: { symbols: symbolList, market }
      })
    } catch (e) {/* ignore */}
  }, [])

  const unsubscribe = useCallback(async (symbols, market) => {
    const symbolList = Array.isArray(symbols) ? symbols : [symbols]
    symbolList.forEach(s => subscribedSymbols.current[market]?.delete(s))
  }, [])

  return (
    <PriceContext.Provider value={{ prices, connected, subscribe, unsubscribe }}>
      {children}
    </PriceContext.Provider>
  )
}

export function usePriceContext() {
  const ctx = useContext(PriceContext)
  if (!ctx) throw new Error('usePriceContext must be used within PriceProvider')
  return ctx
}

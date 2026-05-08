import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, CandlestickSeries, HistogramSeries } from 'lightweight-charts'

const INTERVALS = ['1', '5', '15', '30', '60', '240', 'D', 'W']
const INTERVAL_LABELS = { '1': '1m', '5': '5m', '15': '15m', '30': '30m', '60': '1h', '240': '4h', 'D': '1D', 'W': '1W' }

// Dark theme colours matching TradeArena's palette
const CHART_THEME = {
  layout: {
    background: { color: '#131722' },
    textColor: '#787B86',
  },
  grid: {
    vertLines: { color: '#1e2330' },
    horzLines: { color: '#1e2330' },
  },
  crosshair: {
    mode: 1,
    vertLine: { color: '#758696', labelBackgroundColor: '#2A2E39' },
    horzLine: { color: '#758696', labelBackgroundColor: '#2A2E39' },
  },
  timeScale: {
    borderColor: '#2A2E39',
    timeVisible: true,
    secondsVisible: false,
  },
  rightPriceScale: {
    borderColor: '#2A2E39',
  },
}

const CANDLE_THEME = {
  upColor:          '#26A69A',
  downColor:        '#EF5350',
  borderUpColor:   '#26A69A',
  borderDownColor: '#EF5350',
  wickUpColor:     '#26A69A',
  wickDownColor:   '#EF5350',
}

export function TradingViewChart({ symbol, market, interval, onIntervalChange }) {
  const containerRef = useRef(null)
  const chartRef     = useRef(null)
  const seriesRef    = useRef(null)
  const volSeriesRef = useRef(null)

  const [status, setStatus] = useState('loading') // 'loading' | 'ok' | 'error'
  const [errorMsg, setErrorMsg] = useState('')

  // ── Fetch OHLCV and render ───────────────────────────────────────────────────
  const fetchAndRender = useCallback(async () => {
    if (!seriesRef.current) return
    setStatus('loading')
    try {
      // Use /api/chart relative URL:
      // - Production (Vercel): hits Vercel serverless function (AWS IP, not blocked by Yahoo)
      // - Local dev: Vite proxy forwards to Railway
      const url = `/api/chart?symbol=${encodeURIComponent(symbol)}&market=${market}&interval=${interval}`
      const res = await fetch(url)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to fetch chart data')

      const { candles } = json
      if (!candles || candles.length === 0) throw new Error('No candle data returned')

      seriesRef.current.setData(candles.map(c => ({
        time:  c.time,
        open:  c.open,
        high:  c.high,
        low:   c.low,
        close: c.close,
      })))

      if (volSeriesRef.current) {
        volSeriesRef.current.setData(candles.map(c => ({
          time:  c.time,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)',
        })))
      }

      chartRef.current?.timeScale().fitContent()
      setStatus('ok')
    } catch (err) {
      console.error('[Chart]', err.message)
      setErrorMsg(err.message)
      setStatus('error')
    }
  }, [symbol, market, interval])

  // ── Create/destroy chart when container mounts ───────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      ...CHART_THEME,
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale:  { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    })
    chartRef.current = chart

    // Candlestick series (v5 API: addSeries with type constant)
    const series = chart.addSeries(CandlestickSeries, CANDLE_THEME)
    seriesRef.current = series

    // Volume histogram in the lower 20% of the pane
    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat:  { type: 'volume' },
      priceScaleId: 'vol',
    })
    volSeriesRef.current = volSeries
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })

    // Responsive resize
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      chart.applyOptions({ width, height })
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current    = null
      seriesRef.current   = null
      volSeriesRef.current = null
    }
  }, []) // only on mount

  // ── Re-fetch whenever symbol/market/interval changes ────────────────────────
  useEffect(() => {
    fetchAndRender()
  }, [fetchAndRender])

  return (
    <div className="flex flex-col h-full w-full">
      {/* Top bar: symbol + interval buttons */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-color bg-bg-secondary flex-shrink-0">
        <span className="text-text-secondary text-xs font-mono">
          {market === 'IN' ? '🇮🇳' : '🇺🇸'} {symbol}
        </span>
        {status === 'loading' && (
          <span className="text-text-secondary text-xs animate-pulse">Loading…</span>
        )}
        {status === 'error' && (
          <span className="text-trade-red text-xs truncate max-w-xs" title={errorMsg}>
            ⚠ {errorMsg}
          </span>
        )}
        <div className="flex gap-0.5 ml-auto">
          {INTERVALS.map(iv => (
            <button
              key={iv}
              onClick={() => onIntervalChange?.(iv)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                interval === iv
                  ? 'bg-trade-blue text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
            >
              {INTERVAL_LABELS[iv]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart canvas */}
      <div ref={containerRef} className="flex-1 min-h-0 relative" />
    </div>
  )
}

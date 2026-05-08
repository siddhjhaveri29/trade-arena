import { useState, useEffect } from 'react'
import { Navbar } from '../components/shared/Navbar'
import { Watchlist } from '../components/Watchlist/Watchlist'
import { TradingViewChart } from '../components/Chart/TradingViewChart'
import { OrderForm } from '../components/OrderPanel/OrderForm'
import { OrderBook } from '../components/OrderPanel/OrderBook'
import { PositionsTable } from '../components/Positions/PositionsTable'
import { MarketClosedBanner } from '../components/shared/MarketStatus'
import { usePriceContext } from '../context/PriceContext'

const DEFAULT_SYMBOLS = {
  IN: 'RELIANCE',
  US: 'AAPL'
}

export default function Terminal() {
  const [selectedSymbol, setSelectedSymbol] = useState('RELIANCE')
  const [selectedMeta, setSelectedMeta] = useState({})
  const [activeMarket, setActiveMarket] = useState('IN')
  const [interval, setInterval] = useState('D')
  const [bottomPanelHeight, setBottomPanelHeight] = useState(220)
  const { prices } = usePriceContext()

  function handleSymbolSelect(symbol, market, meta = {}) {
    setSelectedSymbol(symbol)
    setSelectedMeta(meta)
    if (market) setActiveMarket(market)
  }

  function handleMarketChange(market) {
    setActiveMarket(market)
    setSelectedSymbol(DEFAULT_SYMBOLS[market])
  }

  const currentPriceData = prices[selectedSymbol]

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg-primary">
      {/* Navbar */}
      <Navbar onSymbolSelect={handleSymbolSelect} activeMarket={activeMarket} />

      {/* Market closed banner */}
      <MarketClosedBanner market={activeMarket} />

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Watchlist */}
        <div className="w-52 flex-shrink-0 border-r border-border-color overflow-hidden">
          <Watchlist
            onSymbolSelect={handleSymbolSelect}
            selectedSymbol={selectedSymbol}
            activeMarket={activeMarket}
            onMarketChange={handleMarketChange}
          />
        </div>

        {/* Center: Chart + Bottom Panel */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Chart */}
          <div className="flex-1 overflow-hidden">
            <TradingViewChart
              symbol={selectedSymbol}
              market={activeMarket}
              interval={interval}
              onIntervalChange={setInterval}
              instrumentMeta={selectedMeta}
            />
          </div>

          {/* Bottom panel: Positions + Trades */}
          <div
            className="flex-shrink-0 border-t border-border-color overflow-hidden"
            style={{ height: bottomPanelHeight }}
          >
            <PositionsTable market={activeMarket} />
          </div>
        </div>

        {/* Right: Order Panel */}
        <div className="w-72 flex-shrink-0 border-l border-border-color flex flex-col overflow-hidden">
          {/* Symbol info */}
          {currentPriceData && (
            <div className="px-3 py-2 border-b border-border-color flex-shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-text-primary font-medium text-sm">{selectedSymbol}</span>
                <span className="text-text-primary font-mono font-medium text-sm">
                  {activeMarket === 'IN' ? '₹' : '$'}
                  {currentPriceData.price?.toLocaleString(activeMarket === 'IN' ? 'en-IN' : 'en-US', { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-text-secondary text-xs">{activeMarket === 'IN' ? '🇮🇳 NSE' : '🇺🇸 US'}</span>
                <span className={`text-xs font-mono ${(currentPriceData.changePercent ?? 0) >= 0 ? 'text-trade-green' : 'text-trade-red'}`}>
                  {(currentPriceData.changePercent ?? 0) >= 0 ? '+' : ''}{(currentPriceData.changePercent ?? 0).toFixed(2)}%
                </span>
              </div>
              <div className="flex gap-4 mt-1 text-xs text-text-secondary">
                <span>H: {activeMarket === 'IN' ? '₹' : '$'}{currentPriceData.high?.toFixed(2) ?? '—'}</span>
                <span>L: {activeMarket === 'IN' ? '₹' : '$'}{currentPriceData.low?.toFixed(2) ?? '—'}</span>
                <span>Vol: {currentPriceData.volume ? (currentPriceData.volume / 1e6).toFixed(2) + 'M' : '—'}</span>
              </div>
            </div>
          )}

          {/* Order form */}
          <div className="overflow-y-auto flex-shrink-0">
            <OrderForm
              symbol={selectedSymbol}
              market={activeMarket}
            />
          </div>

          {/* Orders / positions sidebar */}
          <OrderBook market={activeMarket} />
        </div>
      </div>
    </div>
  )
}

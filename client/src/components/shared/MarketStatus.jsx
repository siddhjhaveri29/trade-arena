import { useState, useEffect } from 'react'

function getMarketStatus() {
  const now = new Date()
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))

  const dayIST = ist.getDay()
  const hIST = ist.getHours() + ist.getMinutes() / 60

  const dayET = et.getDay()
  const hET = et.getHours() + et.getMinutes() / 60

  const nseOpen = dayIST >= 1 && dayIST <= 5 && hIST >= 9.25 && hIST <= 15.5
  const mcxOpen = dayIST >= 1 && dayIST <= 5 && hIST >= 9 && hIST < 23.5
  const nyseOpen = dayET >= 1 && dayET <= 5 && hET >= 9.5 && hET < 16

  return { nseOpen, mcxOpen, nyseOpen }
}

export function MarketStatusBadges() {
  const [status, setStatus] = useState(getMarketStatus())

  useEffect(() => {
    const interval = setInterval(() => setStatus(getMarketStatus()), 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center gap-2 text-xs">
      <Badge label="NSE" open={status.nseOpen} />
      <Badge label="NYSE" open={status.nyseOpen} />
    </div>
  )
}

function Badge({ label, open }) {
  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${open ? 'bg-trade-green/10 text-trade-green' : 'bg-trade-red/10 text-trade-red'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${open ? 'bg-trade-green' : 'bg-trade-red'}`} />
      {label} {open ? 'OPEN' : 'CLOSED'}
    </span>
  )
}

export function MarketClosedBanner({ market }) {
  const [status, setStatus] = useState(getMarketStatus())

  useEffect(() => {
    const interval = setInterval(() => setStatus(getMarketStatus()), 60000)
    return () => clearInterval(interval)
  }, [])

  const isOpen = market === 'US' ? status.nyseOpen : status.nseOpen
  if (isOpen) return null

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-trade-yellow/10 border-b border-trade-yellow/20 text-trade-yellow text-xs">
      <span>⏰</span>
      <span>Market Closed — prices may be delayed</span>
    </div>
  )
}

export function useMarketStatus() {
  const [status, setStatus] = useState(getMarketStatus())
  useEffect(() => {
    const interval = setInterval(() => setStatus(getMarketStatus()), 60000)
    return () => clearInterval(interval)
  }, [])
  return status
}

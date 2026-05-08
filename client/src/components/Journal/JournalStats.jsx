import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { apiFetch } from '../../context/AuthContext'

const EMOTION_EMOJI = {
  confident: '😊', excited: '🤩', neutral: '😐',
  anxious: '😟', fearful: '😰', greedy: '🤑'
}

function getPnlColor(pnl) {
  if (pnl == null || pnl === 0) return '#2A2E39'
  const intensity = Math.min(Math.abs(pnl) / 500, 1)
  if (pnl > 0) return `rgba(38, 166, 154, ${0.3 + intensity * 0.7})`
  return `rgba(239, 83, 80, ${0.3 + intensity * 0.7})`
}

function generateHeatmapWeeks(byDate) {
  const weeks = []
  const end = new Date()
  const start = new Date(end)
  start.setDate(start.getDate() - 364)

  // Align to Sunday
  start.setDate(start.getDate() - start.getDay())

  let current = new Date(start)
  while (current <= end) {
    const week = []
    for (let d = 0; d < 7; d++) {
      const dateStr = current.toISOString().split('T')[0]
      const dayData = byDate[dateStr]
      week.push({
        date: dateStr,
        pnl: dayData?.pnl ?? null,
        count: dayData?.count ?? 0
      })
      current.setDate(current.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

export function JournalStats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/api/journal/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center py-16 text-text-secondary text-sm">Loading stats...</div>
  if (!stats || stats.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-text-secondary text-sm gap-2">
        <span className="text-3xl">📊</span>
        <p>No journal data yet. Start logging trades to see your stats.</p>
      </div>
    )
  }

  const emotionData = Object.entries(stats.byEmotion || {}).map(([emotion, data]) => ({
    emotion,
    emoji: EMOTION_EMOJI[emotion] || '😐',
    winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
    avgPnl: data.count > 0 ? data.totalPnl / data.count : 0,
    count: data.count
  }))

  const setupData = Object.entries(stats.bySetup || {}).map(([setup, data]) => ({
    setup: setup.replace('_', ' '),
    winRate: data.count > 0 ? (data.wins / data.count) * 100 : 0,
    totalPnl: data.totalPnl,
    count: data.count
  }))

  const heatmapWeeks = generateHeatmapWeeks(stats.byDate || {})

  return (
    <div className="p-4 space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Total Trades" value={stats.total} />
        <StatCard
          title="Win Rate"
          value={`${(stats.winRate ?? 0).toFixed(1)}%`}
          color={(stats.winRate ?? 0) >= 50 ? 'text-trade-green' : 'text-trade-red'}
        />
        <StatCard
          title="Total P&L"
          value={`${(stats.totalPnl ?? 0) >= 0 ? '+' : ''}₹${Math.abs(stats.totalPnl ?? 0).toFixed(0)}`}
          color={(stats.totalPnl ?? 0) >= 0 ? 'text-trade-green' : 'text-trade-red'}
        />
        <StatCard
          title="Avg P&L"
          value={`${(stats.avgPnl ?? 0) >= 0 ? '+' : ''}₹${Math.abs(stats.avgPnl ?? 0).toFixed(0)}`}
          color={(stats.avgPnl ?? 0) >= 0 ? 'text-trade-green' : 'text-trade-red'}
        />
      </div>

      {/* Emotion vs Win Rate */}
      {emotionData.length > 0 && (
        <div className="bg-bg-card border border-border-color rounded-lg p-4">
          <h3 className="text-text-primary text-sm font-medium mb-3">Win Rate by Emotion</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={emotionData} barSize={24}>
              <XAxis
                dataKey="emoji"
                tick={{ fill: '#787B86', fontSize: 16 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis domain={[0, 100]} tick={{ fill: '#787B86', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-bg-secondary border border-border-color rounded p-2 text-xs">
                      <p className="text-text-primary">{d.emotion} {d.emoji}</p>
                      <p className="text-trade-green">Win Rate: {d.winRate.toFixed(1)}%</p>
                      <p className="text-text-secondary">Trades: {d.count}</p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="winRate">
                {emotionData.map((d, i) => (
                  <Cell key={i} fill={d.winRate >= 50 ? '#26A69A' : '#EF5350'} radius={[4, 4, 0, 0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Setup P&L */}
      {setupData.length > 0 && (
        <div className="bg-bg-card border border-border-color rounded-lg p-4">
          <h3 className="text-text-primary text-sm font-medium mb-3">P&L by Setup</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={setupData} barSize={28}>
              <XAxis dataKey="setup" tick={{ fill: '#787B86', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#787B86', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-bg-secondary border border-border-color rounded p-2 text-xs">
                      <p className="text-text-primary capitalize">{d.setup}</p>
                      <p className={d.totalPnl >= 0 ? 'text-trade-green' : 'text-trade-red'}>
                        P&L: ₹{d.totalPnl.toFixed(0)}
                      </p>
                      <p className="text-trade-green">Win Rate: {d.winRate.toFixed(1)}%</p>
                      <p className="text-text-secondary">Trades: {d.count}</p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="totalPnl">
                {setupData.map((d, i) => (
                  <Cell key={i} fill={d.totalPnl >= 0 ? '#26A69A' : '#EF5350'} radius={[4, 4, 0, 0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Calendar heatmap */}
      <div className="bg-bg-card border border-border-color rounded-lg p-4">
        <h3 className="text-text-primary text-sm font-medium mb-3">Activity Heatmap (Last 52 Weeks)</h3>
        <div className="flex gap-0.5 overflow-x-auto pb-1">
          {heatmapWeeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day, di) => (
                <div
                  key={di}
                  className="w-3 h-3 rounded-sm cursor-default"
                  style={{ backgroundColor: getPnlColor(day.pnl) }}
                  title={day.date + (day.count ? ` — ${day.count} trade(s), P&L: ₹${(day.pnl ?? 0).toFixed(0)}` : '')}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-text-secondary">
          <span>Less</span>
          <div className="flex gap-0.5">
            {[0, 100, 300, 500, 1000].map(v => (
              <div key={v} className="w-3 h-3 rounded-sm" style={{ backgroundColor: getPnlColor(v) }} />
            ))}
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, color = 'text-text-primary' }) {
  return (
    <div className="bg-bg-card border border-border-color rounded-lg p-3">
      <p className="text-text-secondary text-xs mb-1">{title}</p>
      <p className={`text-xl font-mono font-bold ${color}`}>{value}</p>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { apiFetch } from '../../context/AuthContext'

const RANK_COLORS = ['text-trade-yellow', 'text-text-secondary', 'text-trade-accent']
const RANK_MEDALS = ['🥇', '🥈', '🥉']

export function Leaderboard({ groupId, market }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  async function fetchLeaderboard() {
    try {
      const res = await apiFetch(`/api/groups/${groupId}/leaderboard`)
      if (!res.ok) throw new Error('Failed to fetch leaderboard')
      const data = await res.json()
      setMembers(Array.isArray(data) ? data : [])
      setLastUpdated(new Date())
    } catch (e) {/* ignore */} finally { setLoading(false) }
  }

  useEffect(() => {
    fetchLeaderboard()
    const interval = setInterval(fetchLeaderboard, 30000)
    return () => clearInterval(interval)
  }, [groupId])

  const currency = market === 'IN' ? '₹' : '$'

  if (loading) return <div className="flex items-center justify-center py-12 text-text-secondary text-sm">Loading leaderboard...</div>

  if (members.length === 0) {
    return <div className="flex flex-col items-center justify-center py-16 text-text-secondary text-sm gap-2">
      <span className="text-3xl">🏆</span>
      <p>No members yet</p>
    </div>
  }

  return (
    <div>
      {/* Refresh info */}
      <div className="flex items-center justify-between px-4 py-2 text-text-secondary text-xs border-b border-border-color">
        <span>Refreshes every 30 seconds</span>
        {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString()}</span>}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-secondary border-b border-border-color">
              <th className="text-left px-4 py-2.5 font-normal">Rank</th>
              <th className="text-left px-4 py-2.5 font-normal">Trader</th>
              <th className="text-right px-4 py-2.5 font-normal">Starting</th>
              <th className="text-right px-4 py-2.5 font-normal">Current</th>
              <th className="text-right px-4 py-2.5 font-normal">Return</th>
              <th className="text-right px-4 py-2.5 font-normal">Win Rate</th>
              <th className="text-right px-4 py-2.5 font-normal">Trades</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member, i) => {
              const isTop3 = i < 3
              const returnIsPos = (member.returnPct ?? 0) >= 0

              return (
                <tr
                  key={member.userId}
                  className={`border-b border-border-color hover:bg-bg-hover ${i === 0 ? 'bg-trade-yellow/5' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {isTop3
                        ? <span className="text-base">{RANK_MEDALS[i]}</span>
                        : <span className="text-text-secondary w-5 text-center">{member.rank}</span>
                      }
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-trade-blue flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {(member.profile?.display_name || member.profile?.username || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-text-primary font-medium">{member.profile?.display_name || member.profile?.username}</p>
                        {member.profile?.username && member.profile?.display_name && (
                          <p className="text-text-secondary">@{member.profile.username}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono">
                    {currency}{(member.initialBalance ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3 text-right text-text-primary font-mono">
                    {currency}{(member.totalValue ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono font-semibold text-sm ${returnIsPos ? 'text-trade-green' : 'text-trade-red'}`}>
                      {returnIsPos ? '+' : ''}{(member.returnPct ?? 0).toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono ${(member.winRate ?? 0) >= 50 ? 'text-trade-green' : 'text-text-secondary'}`}>
                      {(member.winRate ?? 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary font-mono">
                    {member.totalTrades ?? 0}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

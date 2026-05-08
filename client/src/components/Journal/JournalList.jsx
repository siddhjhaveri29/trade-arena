import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { JournalForm } from './JournalForm'

const EMOTION_EMOJI = {
  confident: '😊', excited: '🤩', neutral: '😐',
  anxious: '😟', fearful: '😰', greedy: '🤑'
}

const OUTCOME_COLORS = {
  win: 'text-trade-green bg-trade-green/10 border-trade-green/30',
  loss: 'text-trade-red bg-trade-red/10 border-trade-red/30',
  breakeven: 'text-trade-yellow bg-trade-yellow/10 border-trade-yellow/30'
}

export function JournalList() {
  const { addToast } = useToast()
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [filters, setFilters] = useState({ market: '', outcome: '', setup: '' })

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: 20, ...Object.fromEntries(Object.entries(filters).filter(([,v]) => v)) })
      const res = await apiFetch(`/api/journal?${params}`)
      const data = await res.json()
      setEntries(data.entries || [])
      setTotal(data.total || 0)
    } catch (e) {/* ignore */} finally { setLoading(false) }
  }, [page, filters])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  async function handleDelete(id) {
    if (!confirm('Delete this journal entry?')) return
    try {
      const res = await apiFetch(`/api/journal/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      addToast('info', 'Entry deleted')
      fetchEntries()
    } catch (err) {
      addToast('error', err.message)
    }
  }

  const editingEntry = entries.find(e => e.id === editingId)

  if (editingEntry) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-2 p-4 border-b border-border-color">
          <button onClick={() => setEditingId(null)} className="text-text-secondary hover:text-text-primary text-sm">← Back</button>
          <h2 className="text-text-primary font-medium text-sm">Edit Entry</h2>
        </div>
        <JournalForm
          initialValues={editingEntry}
          onSuccess={() => { setEditingId(null); fetchEntries() }}
          onCancel={() => setEditingId(null)}
        />
      </div>
    )
  }

  if (showForm) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-2 p-4 border-b border-border-color">
          <button onClick={() => setShowForm(false)} className="text-text-secondary hover:text-text-primary text-sm">← Back</button>
          <h2 className="text-text-primary font-medium text-sm">New Journal Entry</h2>
        </div>
        <JournalForm onSuccess={() => { setShowForm(false); fetchEntries() }} onCancel={() => setShowForm(false)} />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-color">
        <h2 className="text-text-primary font-medium">Trade Journal</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 bg-trade-blue text-white text-xs rounded hover:bg-trade-blue/90"
        >
          + New Entry
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 p-3 border-b border-border-color">
        <select
          value={filters.market}
          onChange={e => setFilters(f => ({ ...f, market: e.target.value }))}
          className="bg-bg-card border border-border-color rounded px-2 py-1 text-xs text-text-primary"
        >
          <option value="">All Markets</option>
          <option value="IN">India</option>
          <option value="US">US</option>
        </select>
        <select
          value={filters.outcome}
          onChange={e => setFilters(f => ({ ...f, outcome: e.target.value }))}
          className="bg-bg-card border border-border-color rounded px-2 py-1 text-xs text-text-primary"
        >
          <option value="">All Outcomes</option>
          <option value="win">Win</option>
          <option value="loss">Loss</option>
          <option value="breakeven">Breakeven</option>
        </select>
        <select
          value={filters.setup}
          onChange={e => setFilters(f => ({ ...f, setup: e.target.value }))}
          className="bg-bg-card border border-border-color rounded px-2 py-1 text-xs text-text-primary"
        >
          <option value="">All Setups</option>
          <option value="breakout">Breakout</option>
          <option value="reversal">Reversal</option>
          <option value="trend_follow">Trend Follow</option>
          <option value="news_play">News Play</option>
          <option value="earnings">Earnings</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Entries */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-text-secondary text-sm">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-secondary text-sm gap-3">
          <span className="text-3xl">📒</span>
          <p>No journal entries yet.</p>
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-trade-blue text-white text-xs rounded">
            Create your first entry
          </button>
        </div>
      ) : (
        <div className="divide-y divide-border-color">
          {entries.map(entry => (
            <div key={entry.id} className="p-4 hover:bg-bg-hover group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-text-primary font-medium text-sm">{entry.symbol}</span>
                    {entry.market && (
                      <span className="text-text-secondary text-xs">{entry.market === 'IN' ? '🇮🇳' : '🇺🇸'}</span>
                    )}
                    {entry.outcome && (
                      <span className={`px-1.5 py-0.5 text-xs rounded border ${OUTCOME_COLORS[entry.outcome]}`}>
                        {entry.outcome}
                      </span>
                    )}
                    {entry.setup && (
                      <span className="text-text-secondary text-xs bg-bg-card px-1.5 py-0.5 rounded border border-border-color">
                        {entry.setup.replace('_', ' ')}
                      </span>
                    )}
                    {entry.emotion && (
                      <span title={entry.emotion}>{EMOTION_EMOJI[entry.emotion]}</span>
                    )}
                  </div>
                  {entry.notes && (
                    <p className="text-text-secondary text-xs line-clamp-2 mb-1">{entry.notes}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-text-secondary">
                    <span>{new Date(entry.entry_date).toLocaleDateString()}</span>
                    {entry.pnl != null && (
                      <span className={`font-mono ${entry.pnl >= 0 ? 'text-trade-green' : 'text-trade-red'}`}>
                        {entry.pnl >= 0 ? '+' : ''}₹{Math.abs(entry.pnl).toFixed(2)}
                      </span>
                    )}
                    {entry.tags?.length > 0 && (
                      <div className="flex gap-1">
                        {entry.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="bg-bg-card px-1.5 py-0.5 rounded text-xs border border-border-color">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 flex-shrink-0">
                  <button onClick={() => setEditingId(entry.id)} className="text-xs text-text-secondary hover:text-text-primary">Edit</button>
                  <button onClick={() => handleDelete(entry.id)} className="text-xs text-text-secondary hover:text-trade-red">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex items-center justify-center gap-3 p-4 border-t border-border-color">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1 text-xs border border-border-color rounded disabled:opacity-50 text-text-secondary hover:text-text-primary">
            Prev
          </button>
          <span className="text-text-secondary text-xs">Page {page} of {Math.ceil(total / 20)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)}
            className="px-3 py-1 text-xs border border-border-color rounded disabled:opacity-50 text-text-secondary hover:text-text-primary">
            Next
          </button>
        </div>
      )}
    </div>
  )
}

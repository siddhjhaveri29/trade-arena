import { useState } from 'react'
import { apiFetch } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

const SETUPS = [
  { value: 'breakout', label: 'Breakout' },
  { value: 'reversal', label: 'Reversal' },
  { value: 'trend_follow', label: 'Trend Follow' },
  { value: 'news_play', label: 'News Play' },
  { value: 'earnings', label: 'Earnings' },
  { value: 'other', label: 'Other' }
]

const EMOTIONS = [
  { value: 'confident', emoji: '😊', label: 'Confident' },
  { value: 'excited', emoji: '🤩', label: 'Excited' },
  { value: 'neutral', emoji: '😐', label: 'Neutral' },
  { value: 'anxious', emoji: '😟', label: 'Anxious' },
  { value: 'fearful', emoji: '😰', label: 'Fearful' },
  { value: 'greedy', emoji: '🤑', label: 'Greedy' }
]

const OUTCOMES = [
  { value: 'win', label: 'Win', color: 'text-trade-green border-trade-green' },
  { value: 'loss', label: 'Loss', color: 'text-trade-red border-trade-red' },
  { value: 'breakeven', label: 'Breakeven', color: 'text-trade-yellow border-trade-yellow' }
]

export function JournalForm({ initialValues = {}, onSuccess, onCancel }) {
  const { addToast } = useToast()
  const [form, setForm] = useState({
    symbol: initialValues.symbol || '',
    market: initialValues.market || 'IN',
    entryDate: initialValues.entryDate || new Date().toISOString().split('T')[0],
    direction: initialValues.direction || 'long',
    setup: initialValues.setup || '',
    notes: initialValues.notes || '',
    lessons: initialValues.lessons || '',
    emotion: initialValues.emotion || '',
    emotionRating: initialValues.emotionRating || 3,
    outcome: initialValues.outcome || '',
    pnl: initialValues.pnl || '',
    tags: initialValues.tags?.join(', ') || '',
    tradeId: initialValues.tradeId || null
  })
  const [submitting, setSubmitting] = useState(false)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.symbol) { addToast('error', 'Symbol is required'); return }

    setSubmitting(true)
    try {
      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        pnl: form.pnl ? parseFloat(form.pnl) : null
      }

      const url = initialValues.id ? `/api/journal/${initialValues.id}` : '/api/journal'
      const method = initialValues.id ? 'PUT' : 'POST'
      const res = await apiFetch(url, { method, body: payload })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      addToast('success', initialValues.id ? 'Journal entry updated' : 'Journal entry saved')
      onSuccess?.(data)
    } catch (err) {
      addToast('error', err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      {/* Symbol + Market */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-text-secondary text-xs mb-1">Symbol *</label>
          <input
            value={form.symbol}
            onChange={e => set('symbol', e.target.value.toUpperCase())}
            placeholder="RELIANCE"
            className="w-full bg-bg-card border border-border-color rounded px-3 py-2 text-xs text-text-primary outline-none focus:border-trade-blue"
          />
        </div>
        <div>
          <label className="block text-text-secondary text-xs mb-1">Market</label>
          <select
            value={form.market}
            onChange={e => set('market', e.target.value)}
            className="w-full bg-bg-card border border-border-color rounded px-3 py-2 text-xs text-text-primary outline-none focus:border-trade-blue"
          >
            <option value="IN">🇮🇳 India</option>
            <option value="US">🇺🇸 US</option>
          </select>
        </div>
      </div>

      {/* Date + Direction */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-text-secondary text-xs mb-1">Date</label>
          <input
            type="date"
            value={form.entryDate}
            onChange={e => set('entryDate', e.target.value)}
            className="w-full bg-bg-card border border-border-color rounded px-3 py-2 text-xs text-text-primary outline-none focus:border-trade-blue"
          />
        </div>
        <div>
          <label className="block text-text-secondary text-xs mb-1">Direction</label>
          <div className="flex rounded overflow-hidden border border-border-color h-[34px]">
            <button type="button" onClick={() => set('direction', 'long')}
              className={`flex-1 text-xs transition-colors ${form.direction === 'long' ? 'bg-trade-green/20 text-trade-green' : 'text-text-secondary'}`}>
              Long
            </button>
            <button type="button" onClick={() => set('direction', 'short')}
              className={`flex-1 text-xs transition-colors ${form.direction === 'short' ? 'bg-trade-red/20 text-trade-red' : 'text-text-secondary'}`}>
              Short
            </button>
          </div>
        </div>
      </div>

      {/* Setup type */}
      <div>
        <label className="block text-text-secondary text-xs mb-1">Setup Type</label>
        <div className="flex flex-wrap gap-1.5">
          {SETUPS.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => set('setup', form.setup === s.value ? '' : s.value)}
              className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                form.setup === s.value
                  ? 'border-trade-blue bg-trade-blue/20 text-trade-blue'
                  : 'border-border-color text-text-secondary hover:border-text-secondary'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-text-secondary text-xs mb-1">Trade Thesis / Notes</label>
        <textarea
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          rows={3}
          placeholder="What was your setup? Why did you enter this trade?"
          className="w-full bg-bg-card border border-border-color rounded px-3 py-2 text-xs text-text-primary outline-none focus:border-trade-blue resize-none"
        />
      </div>

      {/* Lessons */}
      <div>
        <label className="block text-text-secondary text-xs mb-1">Lessons Learned</label>
        <textarea
          value={form.lessons}
          onChange={e => set('lessons', e.target.value)}
          rows={2}
          placeholder="What did you learn from this trade?"
          className="w-full bg-bg-card border border-border-color rounded px-3 py-2 text-xs text-text-primary outline-none focus:border-trade-blue resize-none"
        />
      </div>

      {/* Emotion */}
      <div>
        <label className="block text-text-secondary text-xs mb-2">Emotion</label>
        <div className="flex gap-2 flex-wrap">
          {EMOTIONS.map(em => (
            <button
              key={em.value}
              type="button"
              onClick={() => set('emotion', form.emotion === em.value ? '' : em.value)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded border text-xs transition-colors ${
                form.emotion === em.value
                  ? 'border-trade-blue bg-trade-blue/20 text-trade-blue'
                  : 'border-border-color text-text-secondary hover:border-text-secondary'
              }`}
            >
              <span className="text-base">{em.emoji}</span>
              <span>{em.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Outcome + P&L */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-text-secondary text-xs mb-1">Outcome</label>
          <div className="flex gap-1.5">
            {OUTCOMES.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => set('outcome', form.outcome === o.value ? '' : o.value)}
                className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                  form.outcome === o.value ? o.color + ' bg-current/10' : 'border-border-color text-text-secondary'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-text-secondary text-xs mb-1">P&L</label>
          <input
            type="number"
            value={form.pnl}
            onChange={e => set('pnl', e.target.value)}
            placeholder="0.00"
            step="0.01"
            className="w-full bg-bg-card border border-border-color rounded px-3 py-2 text-xs text-text-primary outline-none focus:border-trade-blue"
          />
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-text-secondary text-xs mb-1">Tags (comma separated)</label>
        <input
          value={form.tags}
          onChange={e => set('tags', e.target.value)}
          placeholder="followed plan, FOMO, good exit"
          className="w-full bg-bg-card border border-border-color rounded px-3 py-2 text-xs text-text-primary outline-none focus:border-trade-blue"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="flex-1 py-2 text-xs border border-border-color text-text-secondary rounded hover:bg-bg-hover transition-colors">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-2 text-xs bg-trade-blue text-white rounded hover:bg-trade-blue/90 transition-colors disabled:opacity-50"
        >
          {submitting ? 'Saving...' : (initialValues.id ? 'Update Entry' : 'Save Entry')}
        </button>
      </div>
    </form>
  )
}

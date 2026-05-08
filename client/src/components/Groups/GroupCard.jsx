import { Link } from 'react-router-dom'

const MARKET_FLAGS = { IN: '🇮🇳', US: '🇺🇸', BOTH: '🌐' }

export function GroupCard({ group, onJoin }) {
  return (
    <Link
      to={`/groups/${group.id}`}
      className="block bg-bg-card border border-border-color rounded-lg p-4 hover:border-trade-blue/50 hover:bg-bg-hover transition-colors"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{MARKET_FLAGS[group.market] || '🌐'}</span>
          <h3 className="text-text-primary font-medium text-sm">{group.name}</h3>
        </div>
        <span className="text-xs text-text-secondary bg-bg-primary px-2 py-0.5 rounded border border-border-color">
          {group.competition_type?.replace('_', ' ')}
        </span>
      </div>

      {group.description && (
        <p className="text-text-secondary text-xs mb-3 line-clamp-2">{group.description}</p>
      )}

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-text-secondary">
          <span>👥 {group.member_count ?? '—'} members</span>
          <span>🎫 {group.invite_code}</span>
        </div>
        <span className="text-text-secondary">
          {new Date(group.created_at).toLocaleDateString()}
        </span>
      </div>
    </Link>
  )
}

export function InviteCodeDisplay({ code }) {
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
    } catch (e) {/* ignore */}
  }

  return (
    <div className="flex items-center gap-2 bg-bg-primary border border-border-color rounded px-3 py-2">
      <span className="text-text-secondary text-xs">Invite Code:</span>
      <span className="text-trade-accent font-mono font-bold text-sm tracking-widest">{code}</span>
      <button
        onClick={copyCode}
        className="ml-auto text-xs text-text-secondary hover:text-text-primary border border-border-color rounded px-2 py-0.5"
      >
        Copy
      </button>
    </div>
  )
}

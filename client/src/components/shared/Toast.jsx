import { useToast } from '../../context/ToastContext'

const ICONS = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warning: '⚠️',
  trade: '📊',
  order: '🎯',
  group: '🏆'
}

const COLORS = {
  success: 'border-trade-green text-trade-green',
  error: 'border-trade-red text-trade-red',
  info: 'border-trade-blue text-trade-blue',
  warning: 'border-trade-yellow text-trade-yellow',
  trade: 'border-trade-green text-trade-green',
  order: 'border-trade-accent text-trade-accent',
  group: 'border-trade-yellow text-trade-yellow'
}

export function Toast() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg bg-bg-card border ${COLORS[toast.type] || COLORS.info} shadow-xl animate-slide-in max-w-sm`}
          onClick={() => removeToast(toast.id)}
          style={{ cursor: 'pointer' }}
        >
          <span className="text-lg flex-shrink-0">{ICONS[toast.type] || 'ℹ️'}</span>
          <p className="text-text-primary text-sm leading-relaxed">{toast.message}</p>
        </div>
      ))}
    </div>
  )
}

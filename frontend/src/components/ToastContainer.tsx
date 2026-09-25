import { useToast } from '../contexts/ToastContext';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const icons = {
  success: <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />,
  error: <AlertCircle size={18} style={{ color: 'var(--color-danger)' }} />,
  warning: <AlertTriangle size={18} style={{ color: 'var(--color-warning)' }} />,
  info: <Info size={18} style={{ color: 'var(--color-primary)' }} />,
};

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    // A live region, so a screen reader announces toasts instead of leaving
    // them as a purely visual signal.
    <div className="toast-container" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {icons[t.type]}
          <span style={{ flex: 1, fontSize: 'var(--font-size-sm)' }}>{t.message}</span>
          <button
            className="btn-ghost btn-icon"
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss notification"
            style={{ width: 28, height: 28 }}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}


import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../lib/api';
import { GraduationCap, Mail, Hash, Loader2, CheckCircle2 } from 'lucide-react';

type Step = 'request' | 'success';

export function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [memberId, setMemberId] = useState('');
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // ── Step 1: Send reset link ──
  const handleSendLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) { toast('error', 'Please enter a valid email'); return; }
    if (!memberId.trim()) { toast('error', 'Please enter your Member ID'); return; }

    setSending(true);
    try {
      const res = await api.post<any>('/users/forgot-password', {
        email: email.trim(),
        member_id: memberId.trim(),
      });
      if (res.success) {
        toast('success', 'Password reset link sent to your email');
        setStep('success');
      } else {
        toast('error', res.error?.message || 'Failed to send reset link');
      }
    } catch {
      toast('error', 'Network error. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // ── Success Screen ──
  if (step === 'success') {
    return (
      <div className="auth-layout">
        <div className="auth-card">
          <div className="auth-logo">
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <CheckCircle2 size={32} style={{ color: '#fff' }} />
            </div>
            <h1 className="auth-title">Check Your Email</h1>
            <p className="auth-subtitle">
              If an account with that email and Member ID exists, we have sent a password reset link to <strong>{email}</strong>.
            </p>
          </div>
          <button
            className="btn btn-primary btn-full btn-lg"
            onClick={() => navigate('/login')}
            style={{ marginTop: 'var(--space-4)' }}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <GraduationCap size={28} />
          </div>
          <h1 className="auth-title">Forgot Password</h1>
          <p className="auth-subtitle">
            Enter your registered email and member ID to receive a reset link
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSendLink}>
          <div className="input-group">
            <label className="input-label" htmlFor="fp-email">Registered Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                id="fp-email"
                className="input"
                type="email"
                placeholder="you@university.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={{ paddingLeft: 40 }}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="fp-member-id">Member ID</label>
            <div style={{ position: 'relative' }}>
              <Hash size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                id="fp-member-id"
                className="input"
                type="text"
                placeholder="e.g. 230571F"
                value={memberId}
                onChange={e => setMemberId(e.target.value)}
                required
                style={{ paddingLeft: 40, textTransform: 'uppercase' }}
              />
            </div>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              The ID you registered with (e.g. student index number)
            </span>
          </div>

          <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={sending}>
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
            {sending ? 'Sending Link...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="auth-footer">
          Remember your password? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

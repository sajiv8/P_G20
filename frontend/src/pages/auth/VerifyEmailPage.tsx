import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { auth } from '../../lib/firebase';
import { sendEmailVerification } from 'firebase/auth';
import { GraduationCap, Mail, Loader2, RefreshCw, LogOut, CheckCircle2 } from 'lucide-react';

export function VerifyEmailPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // If user becomes verified (e.g. via onAuthStateChanged), redirect
  useEffect(() => {
    if (user?.emailVerified) {
      navigate('/', { replace: true });
    }
  }, [user?.emailVerified, navigate]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleCheckVerification = useCallback(async () => {
    if (!auth.currentUser) return;
    setChecking(true);
    try {
      // Reload the Firebase user to get fresh emailVerified
      await auth.currentUser.reload();
      
      if (auth.currentUser.emailVerified) {
        // Force token refresh so claims/routes update
        await auth.currentUser.getIdToken(true);
        toast('success', 'Email verified! Redirecting to dashboard...');
        // Small delay for the toast to show
        setTimeout(() => navigate('/', { replace: true }), 500);
      } else {
        toast('warning', 'Your email has not been verified yet. Please check your inbox.');
      }
    } catch (err) {
      toast('error', 'Could not check verification status. Please try again.');
    } finally {
      setChecking(false);
    }
  }, [navigate, toast]);

  const handleResend = useCallback(async () => {
    if (!auth.currentUser || cooldown > 0) return;
    setResending(true);
    try {
      await sendEmailVerification(auth.currentUser);
      toast('success', 'Verification email sent! Check your inbox.');
      setCooldown(60); // 60 second cooldown
    } catch (err: any) {
      if (err.code === 'auth/too-many-requests') {
        toast('error', 'Too many requests. Please wait a few minutes before trying again.');
        setCooldown(120);
      } else {
        toast('error', 'Failed to send verification email. Please try again.');
      }
    } finally {
      setResending(false);
    }
  }, [cooldown, toast]);

  const handleSignOut = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  // Should not be on this page if not authenticated
  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  // Already verified — redirect
  if (user.emailVerified) {
    navigate('/', { replace: true });
    return null;
  }

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <GraduationCap size={28} />
          </div>
          <h1 className="auth-title">Verify Your Email</h1>
          <p className="auth-subtitle">
            One more step to get started
          </p>
        </div>

        <div className="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', textAlign: 'center' }}>
          {/* Mail icon */}
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1))',
            color: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto',
          }}>
            <Mail size={28} />
          </div>

          <p style={{ color: 'var(--color-text)', fontSize: '15px', lineHeight: 1.6 }}>
            We sent a verification link to:
          </p>
          <p style={{
            color: 'var(--color-primary)',
            fontSize: '15px',
            fontWeight: 600,
            wordBreak: 'break-all',
          }}>
            {user.email}
          </p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', lineHeight: 1.5 }}>
            Click the link in the email to verify your account.
            If you don't see it, check your spam folder.
          </p>

          {/* I've verified my email button */}
          <button
            className="btn btn-primary btn-full btn-lg"
            onClick={handleCheckVerification}
            disabled={checking}
          >
            {checking
              ? <><Loader2 size={18} className="animate-spin" /> Checking...</>
              : <><CheckCircle2 size={18} /> I've Verified My Email</>
            }
          </button>

          {/* Resend verification email */}
          <button
            className="btn btn-outline btn-full"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
          >
            {resending
              ? <><Loader2 size={18} className="animate-spin" /> Sending...</>
              : cooldown > 0
                ? <><RefreshCw size={16} /> Resend in {cooldown}s</>
                : <><RefreshCw size={16} /> Resend Verification Email</>
            }
          </button>

          {/* Sign out */}
          <button
            className="btn btn-ghost btn-full"
            onClick={handleSignOut}
            style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}
          >
            <LogOut size={16} />
            Sign out &amp; use another account
          </button>
        </div>
      </div>
    </div>
  );
}

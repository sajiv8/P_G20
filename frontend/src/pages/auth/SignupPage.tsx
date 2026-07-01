import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { GraduationCap, Mail, Lock, User, Hash, Loader2, Eye, EyeOff } from 'lucide-react';
import { api } from '../../lib/api';

export function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tenantCode, setTenantCode] = useState('');
  const [memberId, setMemberId] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast('warning', 'Password must be at least 6 characters');
      return;
    }
    if (!memberId.trim()) {
      toast('warning', 'Member ID is required');
      return;
    }
    
    setLoading(true);
    try {
      // 1. Pre-validate faculty code
      const checkRes = await api.get<{ valid: boolean; tenant_name: string }>(`/users/check-tenant/${tenantCode}`);
      if (!checkRes.success || !checkRes.data?.valid) {
        toast('error', checkRes.error?.message || 'Faculty code is invalid. Please check your faculty code.');
        setLoading(false);
        return;
      }
      
      // 2. Proceed with signup
      await signup(email, password, tenantCode, fullName, memberId, phone);
      toast('success', `Account created! Welcome to ${checkRes.data.tenant_name}`);
      navigate('/login', { replace: true });
    } catch (err: any) {
      const msg = err.code === 'auth/email-already-in-use' ? 'Email already in use'
        : err.message || 'Signup failed. Please try again.';
      toast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <GraduationCap size={28} />
          </div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Join your faculty on CampusRSO</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label" htmlFor="signup-name">Full Name</label>
            <div className="auth-input-wrap">
              <User size={18} className="auth-input-icon" />
              <input id="signup-name" className="input auth-input-left" type="text" placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="signup-email">Email</label>
            <div className="auth-input-wrap">
              <Mail size={18} className="auth-input-icon" />
              <input id="signup-email" className="input auth-input-left" type="email" placeholder="you@university.edu" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="signup-password">Password</label>
            <div className="auth-input-wrap">
              <Lock size={18} className="auth-input-icon" />
              <input 
                id="signup-password" 
                className="input auth-input-left-right" 
                type={showPassword ? 'text' : 'password'} 
                placeholder="Min 6 characters" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="auth-input-button"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="signup-code">Faculty Code</label>
            <div className="auth-input-wrap">
              <Hash size={18} className="auth-input-icon" />
              <input id="signup-code" className="input auth-input-left" type="text" placeholder="Enter code from admin" value={tenantCode} onChange={e => setTenantCode(e.target.value)} required />
            </div>
            <span className="auth-field-note">
              Ask your department admin for the faculty code
            </span>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="signup-member-id">Member ID *</label>
            <div className="auth-input-wrap">
              <Hash size={18} className="auth-input-icon" />
              <input id="signup-member-id" className="input auth-input-left" type="text" placeholder="e.g. 230571F" value={memberId} onChange={e => setMemberId(e.target.value.toUpperCase())} required />
            </div>
            <span className="auth-field-note">
              Your unique university member ID
            </span>
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="signup-phone">Mobile Number <span className="auth-optional">(optional)</span></label>
            <div className="auth-input-wrap">
              <Hash size={18} className="auth-input-icon" />
              <input id="signup-phone" className="input auth-input-left" type="tel" placeholder="+94 77 123 4567" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>

          <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "../../contexts/ToastContext";
import { GraduationCap, Mail, Loader2, ArrowLeft } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../lib/firebase";

export function ForgetpasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resetEmail = email.includes("@")
        ? email
        : `${email}@campusrso.local`;
      await sendPasswordResetEmail(auth, resetEmail);
      setSubmitted(true);
      toast("success", "Password reset email sent! Check your inbox.");
      setTimeout(() => navigate("/login"), 3000);
    } catch (err: any) {
      const msg =
        err.code === "auth/user-not-found"
          ? "No account found with this email"
          : err.code === "auth/invalid-email"
            ? "Please enter a valid email address"
            : "Failed to send reset email. Please try again.";
      toast("error", msg);
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
          <h1 className="auth-title">Reset Password</h1>
          <p className="auth-subtitle">
            {submitted
              ? "Check your email for reset instructions"
              : "Enter your email to receive a password reset link"}
          </p>
        </div>

        {!submitted ? (
          <>
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="input-group">
                <label className="input-label" htmlFor="reset-email">
                  Email Address
                </label>
                <div style={{ position: "relative" }}>
                  <Mail
                    size={18}
                    style={{
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--color-text-muted)",
                    }}
                  />
                  <input
                    id="reset-email"
                    className="input"
                    type="email"
                    placeholder="you@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    style={{ paddingLeft: 40 }}
                  />
                </div>
              </div>

              <button
                className="btn btn-primary btn-full btn-lg"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : null}
                {loading ? "Sending reset email..." : "Send Reset Email"}
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
              <Link
                to="/login"
                style={{
                  fontSize: "var(--font-size-sm)",
                  color: "var(--color-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  textDecoration: "none",
                }}
              >
                <ArrowLeft size={16} />
                Back to Login
              </Link>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <div style={{ marginBottom: "1.5rem" }}>
              <Mail
                size={48}
                style={{ color: "var(--color-primary)", margin: "0 auto" }}
              />
            </div>
            <p
              style={{
                color: "var(--color-text-secondary)",
                marginBottom: "1rem",
              }}
            >
              We've sent a password reset link to <strong>{email}</strong>
            </p>
            <p
              style={{
                color: "var(--color-text-muted)",
                fontSize: "var(--font-size-sm)",
                marginBottom: "1.5rem",
              }}
            >
              Check your email and follow the instructions to reset your
              password. You'll be redirected to login shortly.
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                setEmail("");
              }}
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--color-primary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Try another email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

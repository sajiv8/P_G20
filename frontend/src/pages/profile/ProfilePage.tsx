import { useAuth } from "../../contexts/AuthContext";
import {
  CalendarDays,
  Edit3,
  Mail,
  Phone,
  Shield,
  SquareArrowOutUpRight,
  Trash2,
  UserRound,
} from "lucide-react";

export function ProfilePage() {
  const { user, claims, logout } = useAuth();
  const displayName = user?.displayName || "System Administrator";
  const email = user?.email || "admin@campusrso.local";

  return (
    <div className="page-stack profile-page">
      <section className="profile-topbar">
        <div>
          <h1>My Profile</h1>
        </div>
        <div className="profile-top-actions">
          <button className="primary-outline" type="button">
            <Edit3 size={15} />
            Edit Profile
          </button>
          <button
            className="danger-text"
            type="button"
            onClick={() => void logout()}
          >
            <SquareArrowOutUpRight size={15} />
            Sign Out
          </button>
        </div>
      </section>

      <section className="panel profile-hero-card">
        <div className="profile-avatar-wrap">
          <div className="profile-avatar-image" aria-label="Profile avatar">
            <span>SA</span>
            <div className="avatar-camera">
              <UserRound size={12} />
            </div>
          </div>
        </div>

        <h2>{displayName}</h2>
        <p className="profile-email">{email}</p>

        <div className="profile-badges">
          <span className="role-badge role-admin">MAIN_ADMIN</span>
          <span className="status-chip inline green">ACTIVE</span>
        </div>
      </section>

      <section className="panel profile-details-card">
        <h3>Profile Details</h3>
        <div className="profile-grid">
          <div className="profile-item">
            <div className="profile-item-icon">
              <Mail size={14} />
            </div>
            <div>
              <span>EMAIL</span>
              <strong>{email}</strong>
            </div>
          </div>
          <div className="profile-item">
            <div className="profile-item-icon">
              <UserRound size={14} />
            </div>
            <div>
              <span>FULL NAME</span>
              <strong>{displayName}</strong>
            </div>
          </div>
          <div className="profile-item">
            <div className="profile-item-icon">#</div>
            <div>
              <span>MEMBER ID</span>
              <strong>—</strong>
            </div>
          </div>
          <div className="profile-item">
            <div className="profile-item-icon">
              <Phone size={14} />
            </div>
            <div>
              <span>MOBILE</span>
              <strong>—</strong>
            </div>
          </div>
          <div className="profile-item">
            <div className="profile-item-icon">
              <Shield size={14} />
            </div>
            <div>
              <span>ROLE</span>
              <strong>{claims.app_role || "main_admin"}</strong>
            </div>
          </div>
          <div className="profile-item">
            <div className="profile-item-icon">
              <CalendarDays size={14} />
            </div>
            <div>
              <span>JOINED</span>
              <strong>Jun 25, 2026</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="panel danger-panel">
        <h3>Danger Zone</h3>
        <p>
          Permanently delete your account and all associated data. This action
          cannot be undone.
        </p>
        <button className="delete-account" type="button">
          <Trash2 size={14} />
          Delete Account
        </button>
      </section>
    </div>
  );
}

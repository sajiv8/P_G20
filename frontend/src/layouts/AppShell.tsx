import { NavLink, Outlet } from "react-router-dom";
import {
  Bell,
  BookOpenText,
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  Monitor,
  MoonStar,
  Settings,
  UserRound,
  UsersRound,
  Building2,
  GraduationCap,
} from "lucide-react";

const mainNav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/resources", label: "Resources", icon: Monitor },
  { to: "/st-resources", label: "ST Resource", icon: BookOpenText },
  { to: "/st-borrows", label: "ST Borrows", icon: UsersRound },
  { to: "/bookings", label: "Bookings", icon: CalendarDays },
  { to: "/notifications", label: "Notifications", icon: Bell },
];

const adminNav = [
  { to: "/users", label: "Users", icon: UserRound },
  { to: "/tenants", label: "Tenants", icon: Building2 },
];

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">
            <GraduationCap size={20} />
          </div>
          <span className="brand-name">CampusRSO</span>
        </div>

        <nav className="side-nav" aria-label="Primary">
          <div className="nav-section-label">Main</div>
          {mainNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `nav-item${isActive ? " active" : ""}`
              }
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}

          <div className="nav-section-label">Admin</div>
          {adminNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `nav-item${isActive ? " active" : ""}`
              }
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}

          <div className="nav-section-label">Account</div>
          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            <Settings size={16} />
            <span>Profile</span>
          </NavLink>
        </nav>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button"
              type="button"
              aria-label="Toggle theme"
            >
              <MoonStar size={16} />
            </button>
          </div>

          <div className="topbar-actions">
            <button
              className="icon-button"
              type="button"
              aria-label="Notifications"
            >
              <Bell size={16} />
            </button>
            <button
              className="profile-chip"
              type="button"
              aria-label="Current user menu"
            >
              <span>SA</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

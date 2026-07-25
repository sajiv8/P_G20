import {
  CirclePlus,
  CalendarDays,
  Monitor,
  UserRound,
  UsersRound,
  ArrowRight,
} from "lucide-react";

const stats = [
  { label: "Total Resources", value: "0", icon: Monitor, accent: "blue" },
  { label: "Active Bookings", value: "0", icon: CalendarDays, accent: "green" },
  { label: "Pending Approvals", value: "0", icon: UserRound, accent: "amber" },
  {
    label: "Your Role",
    value: "Main Admin",
    icon: UsersRound,
    accent: "violet",
  },
];

const quickActions = [
  {
    label: "Browse Resources",
    text: "Find labs, halls & equipment",
    icon: Monitor,
  },
  { label: "New Booking", text: "Reserve a time slot", icon: CalendarDays },
  { label: "Notifications", text: "Check latest updates", icon: UserRound },
];

export function DashboardPage() {
  return (
    <div className="page-stack">
      <section className="page-hero">
        <div>
          <h1>Welcome back, System 👋</h1>
          <p>Here&apos;s what&apos;s happening with your campus resources</p>
        </div>
        <button className="primary-action" type="button">
          <CirclePlus size={16} />
          New Booking
        </button>
      </section>

      <section className="stats-grid">
        {stats.map(({ label, value, icon: Icon, accent }) => (
          <article key={label} className="stat-card">
            <div className="stat-top">
              <span>{label}</span>
              <div className={`stat-icon accent-${accent}`}>
                <Icon size={18} />
              </div>
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-foot">↗ Active</div>
          </article>
        ))}
      </section>

      <section className="panel card-hero">
        <div className="panel-header">
          <h2>Recent Bookings</h2>
          <button className="text-link" type="button">
            View All <ArrowRight size={14} />
          </button>
        </div>
        <div className="empty-state large">
          <CalendarDays size={42} />
          <h3>No bookings yet</h3>
          <p>Create your first booking to get started</p>
          <button className="primary-action" type="button">
            <CirclePlus size={16} />
            Create Booking
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Quick Actions</h2>
        </div>
        <div className="quick-actions-grid">
          {quickActions.map(({ label, text, icon: Icon }) => (
            <button key={label} className="quick-action" type="button">
              <Icon size={18} />
              <strong>{label}</strong>
              <span>{text}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

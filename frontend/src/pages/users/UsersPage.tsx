import { Bell, Link2, Search, ShieldBan, Trash2, UserPlus } from "lucide-react";

const roleFilters = [
  "All",
  "Main Admin",
  "Tenant Admin",
  "Lecturer",
  "Junior Lecturer",
  "Staff",
  "Student",
];

const users = [
  {
    name: "Isuru Sampath",
    email: "isurudananjaya907@gmail.com",
    memberId: "230514K",
    role: "STUDENT",
    joined: "Jul 11, 2026",
    avatar: "I",
    actions: [
      { label: "Tokens", icon: Link2, tone: "amber" },
      { label: "Ban", icon: ShieldBan, tone: "red" },
      { label: "Delete", icon: Trash2, tone: "delete" },
    ],
  },
  {
    name: "System Administrator",
    email: "admin@campusrso.local",
    memberId: "—",
    role: "MAIN ADMIN",
    joined: "Jun 25, 2026",
    avatar: "S",
    actions: [{ label: "Delete", icon: Trash2, tone: "delete" }],
  },
];

export function UsersPage() {
  return (
    <div className="page-stack admin-page users-page">
      <section className="page-hero compact">
        <div>
          <h1>User Management</h1>
          <p>2 users registered</p>
        </div>
        <button className="primary-action" type="button">
          <UserPlus size={16} />
          Register User
        </button>
      </section>

      <section className="toolbar-row users-toolbar">
        <label className="search-box" aria-label="Search by name or email">
          <Search size={16} />
          <input type="text" placeholder="Search by name or email..." />
        </label>

        <div
          className="segmented-control users-filter-row"
          role="tablist"
          aria-label="User role filters"
        >
          {roleFilters.map((role, index) => (
            <button
              key={role}
              type="button"
              className={`segment${index === 0 ? " active" : ""}`}
            >
              {role}
            </button>
          ))}
        </div>
      </section>

      <section className="panel users-panel">
        <div className="users-table">
          <div className="users-table-head">
            <span>User</span>
            <span>Member ID</span>
            <span>Role</span>
            <span>Joined</span>
            <span>Actions</span>
          </div>

          <div className="users-table-body">
            {users.map((user) => (
              <article key={user.email} className="user-row">
                <div className="user-cell user-main">
                  <div className="user-avatar">{user.avatar}</div>
                  <div>
                    <strong>{user.name}</strong>
                    <span>
                      <Bell size={12} />
                      {user.email}
                    </span>
                  </div>
                </div>

                <div className="user-cell user-id">{user.memberId}</div>

                <div className="user-cell">
                  <span
                    className={`role-badge role-${user.role === "STUDENT" ? "student" : "admin"}`}
                  >
                    {user.role}
                  </span>
                </div>

                <div className="user-cell user-joined">{user.joined}</div>

                <div className="user-cell user-actions">
                  {user.actions.map(({ label, icon: Icon, tone }) => (
                    <button
                      key={label}
                      type="button"
                      className={`action-pill tone-${tone}`}
                    >
                      <Icon size={12} />
                      {label}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

import { Building2, Search, Pencil, Power } from "lucide-react";

const tenants = [
  {
    name: "Faculty of Computing",
    code: "FOC",
    slug: "foc",
    description: "Department of CSE",
    email: "isurudananjaya908@gmail.com",
    created: "Jun 25, 2026",
  },
  {
    name: "Faculty of Medicine",
    code: "MED",
    slug: "med",
    description: "Medicine Faculty",
    email: null,
    created: "Jun 30, 2026",
  },
  {
    name: "University Administration",
    code: "ADMIN",
    slug: "admin",
    description: "Central university administration",
    email: "admin@university.edu",
    created: "Jun 25, 2026",
  },
];

export function TenantsPage() {
  return (
    <div className="page-stack admin-page tenants-page">
      <section className="page-hero compact">
        <div>
          <h1>Tenant Management</h1>
          <p>3 faculties/departments</p>
        </div>
        <button className="primary-action" type="button">
          <Building2 size={16} />
          Add Tenant
        </button>
      </section>

      <section className="toolbar-row single">
        <label className="search-box" aria-label="Search tenants">
          <Search size={16} />
          <input type="text" placeholder="Search tenants..." />
        </label>
      </section>

      <section className="tenants-grid">
        {tenants.map((tenant) => (
          <article key={tenant.code} className="tenant-card panel">
            <div className="tenant-card-top">
              <div className="tenant-icon">
                <Building2 size={18} />
              </div>
              <span className="status-chip">ACTIVE</span>
            </div>

            <h2>{tenant.name}</h2>
            <p className="tenant-meta">
              Code: {tenant.code} • Slug: {tenant.slug}
            </p>
            <p className="tenant-desc">{tenant.description}</p>

            {tenant.email ? (
              <p className="tenant-contact">{tenant.email}</p>
            ) : null}

            <p className="tenant-created">Created {tenant.created}</p>

            <div className="tenant-actions">
              <button type="button" className="tenant-action secondary">
                <Pencil size={14} />
                Edit
              </button>
              <button type="button" className="tenant-action danger">
                <Power size={14} />
                Deactivate
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

import { Search, BookOpenText } from "lucide-react";

export function STResourcesPage() {
  return (
    <div className="page-stack">
      <section className="page-hero compact">
        <div>
          <h1>
            <span className="title-accent">
              <BookOpenText size={22} />
            </span>
            ST Resources
          </h1>
          <p>0 student shared items</p>
        </div>
      </section>

      <section className="toolbar-row single">
        <label className="search-box" aria-label="Search items">
          <Search size={16} />
          <input type="text" placeholder="Search items..." />
        </label>
      </section>

      <section className="panel panel-large">
        <div className="empty-state large">
          <div className="empty-icon accent-violet">
            <BookOpenText size={36} />
          </div>
          <h3>No ST Resources found</h3>
          <p>No students have shared items yet.</p>
        </div>
      </section>
    </div>
  );
}

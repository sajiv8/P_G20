import { CirclePlus, Monitor, Search } from "lucide-react";

const filters = [
  "All",
  "Lab",
  "Lecture Hall",
  "Equipment",
  "Meeting Room",
  "ST Resource",
  "Other",
];

export function ResourcesPage() {
  return (
    <div className="page-stack">
      <section className="page-hero compact">
        <div>
          <h1>Resources</h1>
          <p>0 resources available</p>
        </div>
        <button className="primary-action" type="button">
          <CirclePlus size={16} />
          Add Resource
        </button>
      </section>

      <section className="toolbar-row">
        <label className="search-box" aria-label="Search resources">
          <Search size={16} />
          <input type="text" placeholder="Search resources..." />
        </label>

        <div
          className="segmented-control"
          role="tablist"
          aria-label="Resource filters"
        >
          {filters.map((filter, index) => (
            <button
              key={filter}
              type="button"
              className={`segment${index === 0 ? " active" : ""}`}
            >
              {filter}
            </button>
          ))}
        </div>
      </section>

      <section className="panel panel-large">
        <div className="empty-state large">
          <div className="empty-icon">
            <Monitor size={36} />
          </div>
          <h3>No resources found</h3>
          <p>Try adjusting your search or filter</p>
        </div>
      </section>
    </div>
  );
}

import { HandHelping } from "lucide-react";

const tabs = ["My Borrows", "Lent Out (My Items)"];

export function STBorrowsPage() {
  return (
    <div className="page-stack">
      <section className="page-hero compact with-tabs">
        <div>
          <h1>
            <span className="title-accent accent-violet">
              <HandHelping size={22} />
            </span>
            ST Borrows
          </h1>
          <p>Manage your borrowing and lending</p>
        </div>
      </section>

      <div
        className="segmented-control tabs-inline"
        role="tablist"
        aria-label="Borrow tabs"
      >
        {tabs.map((tab, index) => (
          <button
            key={tab}
            type="button"
            className={`segment${index === 0 ? " active" : ""}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <section className="panel panel-large">
        <div className="empty-state large">
          <div className="empty-icon accent-violet">
            <HandHelping size={36} />
          </div>
          <h3>No borrows yet</h3>
          <p>Browse ST Resources to borrow items</p>
        </div>
      </section>
    </div>
  );
}

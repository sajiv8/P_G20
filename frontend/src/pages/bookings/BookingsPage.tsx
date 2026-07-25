import { CalendarDays, CirclePlus, Search } from "lucide-react";

const bookingTabs = [
  "All",
  "Pending",
  "Approved",
  "Active",
  "Completed",
  "Rejected",
  "Cancelled",
];

export function BookingsPage() {
  return (
    <div className="page-stack">
      <section className="page-hero compact">
        <div>
          <h1>Bookings</h1>
          <p>0 total bookings</p>
        </div>
        <button className="primary-action" type="button">
          <CirclePlus size={16} />
          New Booking
        </button>
      </section>

      <section className="toolbar-row bookings-toolbar">
        <label className="search-box" aria-label="Search bookings">
          <Search size={16} />
          <input type="text" placeholder="Search bookings..." />
        </label>

        <div
          className="segmented-control"
          role="tablist"
          aria-label="Booking filters"
        >
          {bookingTabs.map((tab, index) => (
            <button
              key={tab}
              type="button"
              className={`segment${index === 0 ? " active" : ""}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      <section className="panel panel-large">
        <div className="empty-state large">
          <CalendarDays size={40} />
          <h3>No bookings found</h3>
          <p>Create your first booking to get started</p>
          <button className="primary-action" type="button">
            <CirclePlus size={16} />
            Create Booking
          </button>
        </div>
      </section>
    </div>
  );
}

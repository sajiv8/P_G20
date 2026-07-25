import { Bell } from "lucide-react";

const notifications = [
  {
    title: "[System] New User Registered",
    text: "Isuru Sampath has joined Faculty of Computing.",
    time: "13 days ago",
  },
  {
    title: "[System] User Deleted",
    text: "Isuru Sampath has been removed.",
    time: "13 days ago",
  },
  {
    title: "[System] Resource Deleted",
    text: 'Resource "Server 1" has been deleted.',
    time: "14 days ago",
  },
  {
    title: "[System] New Resource Added",
    text: 'Resource "Server 1" has been added.',
    time: "14 days ago",
  },
  {
    title: "Resource Created",
    text: 'Your resource "Server 1" has been created.',
    time: "14 days ago",
  },
  {
    title: "[System] User Role Changed",
    text: "Isuru Sampath's role changed to student.",
    time: "15 days ago",
  },
];

export function NotificationsPage() {
  return (
    <div className="page-stack notifications-page">
      <section className="page-hero compact">
        <div>
          <h1>Notifications</h1>
          <p>0 unread</p>
        </div>
      </section>

      <section className="notification-list">
        {notifications.map((item) => (
          <article key={item.title} className="notification-card">
            <div className="notification-icon">
              <Bell size={18} />
            </div>
            <div className="notification-body">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <span>{item.time}</span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

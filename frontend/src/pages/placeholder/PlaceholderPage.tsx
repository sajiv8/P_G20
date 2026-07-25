type PlaceholderPageProps = {
  title: string;
  subtitle: string;
};

export function PlaceholderPage({ title, subtitle }: PlaceholderPageProps) {
  return (
    <section className="page-stack">
      <div className="page-hero compact">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="panel panel-large">
        <div className="empty-state large">
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
    </section>
  );
}

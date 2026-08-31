export function Dashboard() {
  return (
    <main className="dashboard" data-testid="dashboard">
      <h2>Dashboard</h2>
      <section data-testid="dashboard-category-totals">
        <h3>Category totals</h3>
        <p>Charts load in a later milestone.</p>
      </section>
      <section data-testid="dashboard-vs-last-month">
        <h3>Vs last month</h3>
        <p>Comparison placeholder.</p>
      </section>
      <section data-testid="dashboard-trend">
        <h3>Trend</h3>
        <p>No transactions</p>
      </section>
    </main>
  )
}

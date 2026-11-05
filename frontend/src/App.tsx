export default function App() {
  return (
    <main>
      <header>
        <a className="wordmark" href="#home">
          Hoos Eating
        </a>
      </header>
      <section className="hero" id="home" aria-labelledby="title">
        <p className="eyebrow">A meal companion for UVA students</p>
        <h1 id="title">Hoos Eating</h1>
        <p className="tagline">
          Your goals.
          <br />
          Your campus.
          <br />
          <em>Your next meal.</em>
        </p>
        <p className="intro">
          Finding a meal that fits your day should be simple. We’re building a
          way to explore campus meals around your goals, budget, and dietary
          needs.
        </p>
        <p className="notice">
          Meal recommendations are not available yet. This is a development
          preview.
        </p>
      </section>
      <section className="workflow" aria-labelledby="workflow-title">
        <h2 id="workflow-title">What we’re building</h2>
        <ol>
          <li>
            <span>01</span>
            <h3>Tell us what fits</h3>
            <p>Describe your meal needs in your own words.</p>
          </li>
          <li>
            <span>02</span>
            <h3>Get a grounded suggestion</h3>
            <p>
              Recommendations will be checked against supplied menu data and
              supported constraints.
            </p>
          </li>
          <li>
            <span>03</span>
            <h3>Choose your next meal</h3>
            <p>Review a validated suggestion and record your selection.</p>
          </li>
        </ol>
      </section>
      <footer>Hoos Eating</footer>
    </main>
  );
}

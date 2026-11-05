import { useSyncExternalStore } from "react";
import Profile from "./Profile";

function subscribeToNavigation(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function isProfilePage() {
  return window.location.hash === "#profile";
}

export default function App() {
  const showingProfile = useSyncExternalStore(
    subscribeToNavigation,
    isProfilePage,
  );

  return (
    <div className={showingProfile ? "profile-page" : "home-page"}>
      <header className="site-header">
        <div className="header-inner">
          <a className="wordmark" href="#home">
            Hoos Eating
          </a>
          <nav aria-label="Main navigation">
            <a
              className="profile-link"
              href="#profile"
              aria-current={showingProfile ? "page" : undefined}
            >
              Profile
            </a>
          </nav>
        </div>
      </header>
      <main id={showingProfile ? "profile" : "home"}>
        {showingProfile ? (
          <Profile />
        ) : (
          <>
            <section className="hero" aria-labelledby="title">
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
                Finding a meal that fits your day should be simple. We’re
                building a way to explore campus meals around your goals,
                budget, and dietary needs.
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
                    Recommendations will be checked against supplied menu data
                    and supported constraints.
                  </p>
                </li>
                <li>
                  <span>03</span>
                  <h3>Choose your next meal</h3>
                  <p>
                    Review a validated suggestion and record your selection.
                  </p>
                </li>
              </ol>
            </section>
            <footer>Hoos Eating</footer>
          </>
        )}
      </main>
    </div>
  );
}

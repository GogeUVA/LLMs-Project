import { useSyncExternalStore } from "react";
import MealRequest from "./MealRequest";
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
        {showingProfile ? <Profile /> : <MealRequest />}
      </main>
    </div>
  );
}

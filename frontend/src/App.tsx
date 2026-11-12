import { useState, useSyncExternalStore } from "react";
import MealRequest from "./MealRequest";
import Profile from "./Profile";
import Account from "./Account";
import { defaultAccount, type AccountGateway } from "./accountGateway";
import { emptyProfile, loadProfile } from "./profileStorage";
import { useAccount } from "./useAccount";

function subscribeToNavigation(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function currentPage() {
  return window.location.hash;
}

export default function App({
  account = defaultAccount,
}: { account?: AccountGateway } = {}) {
  const page = useSyncExternalStore(subscribeToNavigation, currentPage);
  const session = useAccount(account);
  const [signOutPending, setSignOutPending] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [importError, setImportError] = useState("");
  const [importPending, setImportPending] = useState(false);
  const showingProfile = page === "#profile";
  const showingAccount = session.recovery || page === "#account";
  const guestProfile = loadProfile();

  async function signOut() {
    if (signOutPending) return;
    setSignOutPending(true);
    setSignOutError("");
    try {
      await account?.signOut();
      window.location.hash = "#home";
    } catch {
      setSignOutError("Couldn’t sign out. Please try again.");
    } finally {
      setSignOutPending(false);
    }
  }

  async function importProfile() {
    if (importPending) return;
    setImportPending(true);
    setImportError("");
    try {
      await session.saveProfile(guestProfile);
    } catch {
      setImportError("Couldn’t import your profile. Please try again.");
    } finally {
      setImportPending(false);
    }
  }

  let content;
  if (!session.ready) {
    content = <p role="status">Restoring your account…</p>;
  } else if (showingAccount) {
    content = (
      <Account
        key={session.recovery ? "recovery" : "account"}
        account={account}
        recovery={session.recovery}
        onRecoveryFinished={session.finishRecovery}
        onSignedIn={() => {
          window.location.hash = "#profile";
        }}
      />
    );
  } else if (session.user && session.loading) {
    content = <p role="status">Loading your profile…</p>;
  } else if (session.user && session.error) {
    content = (
      <section>
        <p role="status">{session.error}</p>
        <button type="button" onClick={session.reloadProfile}>
          Reload profile
        </button>
      </section>
    );
  } else if (showingProfile) {
    content = (
      <>
        {session.user && !session.record && guestProfile.name.trim() && (
          <div className="profile-import">
            <button
              type="button"
              disabled={importPending}
              onClick={importProfile}
            >
              Import browser profile
            </button>
            <p role="status">{importError}</p>
          </div>
        )}
        {importPending ? (
          <p role="status">Importing your profile…</p>
        ) : (
          <Profile
            key={session.user?.id ?? "guest"}
            initialProfile={
              session.user
                ? (session.record?.profile ?? emptyProfile)
                : undefined
            }
            onSave={session.user ? session.saveProfile : undefined}
            onReload={session.user ? session.reloadProfile : undefined}
          />
        )}
      </>
    );
  } else {
    content = (
      <MealRequest
        key={session.user?.id ?? "guest"}
        dietary={
          session.user
            ? (session.record?.profile.dietary ?? emptyProfile.dietary)
            : undefined
        }
      />
    );
  }

  return (
    <div
      className={
        showingProfile || showingAccount ? "profile-page" : "home-page"
      }
    >
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
            {session.user ? (
              <button
                className="profile-link header-account"
                type="button"
                disabled={signOutPending}
                onClick={signOut}
              >
                Sign out
              </button>
            ) : (
              <a
                className="profile-link"
                href="#account"
                aria-current={showingAccount ? "page" : undefined}
              >
                Sign in
              </a>
            )}
          </nav>
        </div>
      </header>
      <main
        id={showingProfile ? "profile" : showingAccount ? "account" : "home"}
      >
        {signOutError && <p role="status">{signOutError}</p>}
        {!session.user && session.error && <p role="status">{session.error}</p>}
        {content}
      </main>
    </div>
  );
}

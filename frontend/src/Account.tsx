import { useRef, useState, type FormEvent } from "react";
import type { AccountGateway } from "./accountGateway";

export default function Account({
  account,
  recovery = false,
  onSignedIn,
  onRecoveryFinished,
}: {
  account: AccountGateway | undefined;
  recovery?: boolean;
  onSignedIn: () => void;
  onRecoveryFinished?: () => void;
}) {
  const [mode, setMode] = useState(recovery ? "update" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const submitting = useRef(false);
  const title = {
    signin: "Sign in",
    signup: "Create account",
    reset: "Reset password",
    update: "Set a new password",
  }[mode];

  function changeMode(next: string) {
    setMode(next);
    setPassword("");
    setPasswordUpdated(false);
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account || submitting.current) return;
    submitting.current = true;
    setPending(true);
    setMessage("");
    try {
      if (mode === "signin") {
        await account.signIn(email.trim(), password);
        onSignedIn();
      } else if (mode === "signup") {
        const result = await account.signUp(email.trim(), password);
        if (result.needsEmailConfirmation)
          setMessage("Check your email to confirm your account.");
        else onSignedIn();
      } else if (mode === "reset") {
        await account.requestPasswordReset(email.trim());
        setMessage(
          "If an account exists for that email, you’ll receive a reset link.",
        );
      } else {
        await account.updatePassword(password);
        setPassword("");
        setMessage("Password updated.");
        setPasswordUpdated(true);
      }
    } catch {
      setMessage(
        mode === "signin"
          ? "Couldn’t sign in. Check your email and password."
          : "Couldn’t complete that request. Please try again.",
      );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <section className="account-page">
      <div className="page-intro">
        <h1>{title}</h1>
      </div>
      {!account ? (
        <p>
          Account sign-in is being configured. You can still use the guest
          profile.
        </p>
      ) : (
        <form className="account-form" onSubmit={submit}>
          {mode !== "update" && (
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          )}
          {mode !== "reset" && (
            <label>
              {mode === "update" ? "New password" : "Password"}
              <input
                type="password"
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                required
                minLength={mode === "signin" ? 1 : 8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          )}
          <button type="submit" disabled={pending}>
            {mode === "reset"
              ? "Send reset link"
              : mode === "update"
                ? "Update password"
                : title}
          </button>
          <p role="status">{message}</p>
          {passwordUpdated && (
            <button
              type="button"
              onClick={() => {
                onRecoveryFinished?.();
                onSignedIn();
              }}
            >
              Continue to profile
            </button>
          )}
          <div className="account-options">
            {mode !== "signin" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => changeMode("signin")}
              >
                Back to sign in
              </button>
            )}
            {mode === "signin" && (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => changeMode("signup")}
                >
                  Create account
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => changeMode("reset")}
                >
                  Forgot password?
                </button>
              </>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { storageKey } from "./profileStorage";

type User = { id: string; email: string };
type AuthEvent = "PASSWORD_RECOVERY";
const user: User = { id: "student-a", email: "student@example.test" };
const profile = {
  name: "Jordan",
  age: "21",
  height: "69",
  weight: "155",
  dietary: {
    allergies: ["peanut"],
    restrictions: ["vegan"],
    preferences: [],
    dislikes: [],
  },
};

let onSession: (user: User | null, event?: AuthEvent) => void;
const account = {
  getSession: vi.fn(),
  subscribe: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  loadProfile: vi.fn(),
  saveProfile: vi.fn(),
};

function openAccount() {
  window.history.replaceState(null, "", "#account");
  return render(<App account={account} />);
}

function enterCredentials(password = "example-test-password") {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: user.email },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
}

async function openProfile() {
  window.history.replaceState(null, "", "#profile");
  account.getSession.mockResolvedValue(user);
  render(<App account={account} />);
  await waitFor(() => expect(account.loadProfile).toHaveBeenCalled());
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "#home");
  Object.values(account).forEach((mock) => mock.mockReset());
  onSession = () => {};
  account.getSession.mockResolvedValue(null);
  account.subscribe.mockImplementation((listener) => {
    onSession = listener;
    return vi.fn();
  });
  account.signIn.mockImplementation(async () => {
    onSession(user);
  });
  account.signOut.mockImplementation(async () => {
    onSession(null);
  });
  account.signUp.mockResolvedValue({ needsEmailConfirmation: true });
  account.requestPasswordReset.mockResolvedValue(undefined);
  account.updatePassword.mockResolvedValue(undefined);
  account.loadProfile.mockResolvedValue({ profile, version: 3 });
  account.saveProfile.mockResolvedValue(4);
});

afterEach(() => {
  localStorage.clear();
});

describe("issue #24 accounts and synced profiles", () => {
  it("signs in and loads the account profile instead of a guest profile", async () => {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ ...profile, name: "Guest", units: "imperial" }),
    );
    openAccount();
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeVisible();
    enterCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(account.signIn).toHaveBeenCalledWith(
        user.email,
        "example-test-password",
      ),
    );
    expect(await screen.findByLabelText("Name")).toHaveValue("Jordan");
    expect(screen.getByRole("checkbox", { name: "Peanuts" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Vegan" })).toBeChecked();
    expect(
      screen.queryByRole("button", { name: "Import browser profile" }),
    ).not.toBeInTheDocument();
  });

  it("does not send empty credentials to the provider", async () => {
    openAccount();
    const submit = await screen.findByRole("button", { name: "Sign in" });
    fireEvent.click(submit);
    expect(account.signIn).not.toHaveBeenCalled();
  });

  it("keeps the sign-in form usable and hides provider diagnostics on failure", async () => {
    account.signIn.mockRejectedValue(new Error("private provider diagnostic"));
    openAccount();
    await screen.findByRole("heading", { name: "Sign in" });
    enterCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByText(
        "Couldn’t sign in. Check your email and password.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("Email")).toHaveValue(user.email);
    expect(
      screen.queryByText("private provider diagnostic"),
    ).not.toBeInTheDocument();
  });

  it("prevents repeated sign-in submissions while a request is pending", async () => {
    let finish!: () => void;
    account.signIn.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    openAccount();
    await screen.findByRole("heading", { name: "Sign in" });
    enterCredentials();
    const submit = screen.getByRole("button", { name: "Sign in" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(submit).toBeDisabled();
    expect(account.signIn).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish();
    });
  });

  it("supports sign-up and explains when email confirmation is needed", async () => {
    openAccount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Create account" }),
    );
    enterCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(
      await screen.findByText("Check your email to confirm your account."),
    ).toBeVisible();
    expect(account.signUp).toHaveBeenCalledWith(
      user.email,
      "example-test-password",
    );
  });

  it("requests password recovery without revealing whether an email has an account", async () => {
    openAccount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Forgot password?" }),
    );
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: user.email },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(
      await screen.findByText(
        "If an account exists for that email, you’ll receive a reset link.",
      ),
    ).toBeVisible();
    expect(account.requestPasswordReset).toHaveBeenCalledWith(user.email);
  });

  it("lets a recovered session set a new password", async () => {
    openAccount();
    await screen.findByRole("heading", { name: "Sign in" });
    act(() => onSession(user, "PASSWORD_RECOVERY"));
    const password = await screen.findByLabelText("New password");
    fireEvent.change(password, { target: { value: "new-example-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("Password updated.")).toBeVisible();
    expect(account.updatePassword).toHaveBeenCalledWith("new-example-password");
  });

  it("saves edited personal and dietary details with the loaded version", async () => {
    await openProfile();
    await waitFor(() =>
      expect(screen.getByLabelText("Name")).toHaveValue("Jordan"),
    );
    fireEvent.change(screen.getByLabelText("Weight (lbs)"), {
      target: { value: "157" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() =>
      expect(account.saveProfile).toHaveBeenCalledWith(
        { ...profile, weight: "157" },
        { expectedVersion: 3 },
      ),
    );
    expect(await screen.findByText("Profile saved.")).toBeVisible();
  });

  it("keeps edits after a failed save and offers another save", async () => {
    account.saveProfile.mockRejectedValue(new Error("private database detail"));
    await openProfile();
    await waitFor(() =>
      expect(screen.getByLabelText("Name")).toHaveValue("Jordan"),
    );
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Edited name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(
      await screen.findByText(
        "Couldn’t save your profile. Your edits are still here.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("Name")).toHaveValue("Edited name");
    expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled();
    expect(
      screen.queryByText("private database detail"),
    ).not.toBeInTheDocument();
  });

  it("offers explicit import into an empty account without silently uploading browser data", async () => {
    account.loadProfile.mockResolvedValue(null);
    localStorage.setItem(
      storageKey,
      JSON.stringify({ ...profile, units: "imperial" }),
    );
    await openProfile();
    const importProfile = await screen.findByRole("button", {
      name: "Import browser profile",
    });
    expect(account.saveProfile).not.toHaveBeenCalled();
    fireEvent.click(importProfile);
    await waitFor(() =>
      expect(account.saveProfile).toHaveBeenCalledWith(profile, {
        expectedVersion: null,
      }),
    );
    expect(await screen.findByLabelText("Name")).toHaveValue("Jordan");
  });

  it("prevents a late profile read from revealing the previous user's data after sign-out", async () => {
    let finish!: (value: { profile: typeof profile; version: number }) => void;
    account.loadProfile.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await openProfile();
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(account.signOut).toHaveBeenCalledOnce());
    await act(async () => {
      finish({ profile, version: 3 });
    });
    expect(screen.queryByDisplayValue("Jordan")).not.toBeInTheDocument();
  });

  it("refreshes the profile when the signed-in account changes", async () => {
    await openProfile();
    await waitFor(() =>
      expect(screen.getByLabelText("Name")).toHaveValue("Jordan"),
    );
    account.loadProfile.mockResolvedValue({
      profile: { ...profile, name: "Second student" },
      version: 1,
    });
    act(() => onSession({ id: "student-b", email: "second@example.test" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Name")).toHaveValue("Second student"),
    );
    expect(screen.queryByDisplayValue("Jordan")).not.toBeInTheDocument();
  });

  it("shows a loading state and prevents saving before the account profile arrives", async () => {
    let finish!: (value: { profile: typeof profile; version: number }) => void;
    account.loadProfile.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await openProfile();
    expect(await screen.findByText("Loading your profile…")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Save profile" }),
    ).not.toBeInTheDocument();
    await act(async () => {
      finish({ profile, version: 3 });
    });
    expect(screen.getByLabelText("Name")).toHaveValue("Jordan");
  });

  it("preserves edits and explains a concurrent save conflict", async () => {
    account.saveProfile.mockRejectedValue(
      Object.assign(new Error("private database detail"), {
        code: "PROFILE_CONFLICT",
      }),
    );
    await openProfile();
    await waitFor(() =>
      expect(screen.getByLabelText("Name")).toHaveValue("Jordan"),
    );
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Unsaved name" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(
      await screen.findByText(
        "Your profile changed on another device. Reload it before saving.",
      ),
    ).toBeVisible();
    expect(screen.getByLabelText("Name")).toHaveValue("Unsaved name");
    const reload = screen.getByRole("button", { name: "Reload profile" });
    account.loadProfile.mockResolvedValue({
      profile: { ...profile, name: "Newer name" },
      version: 4,
    });
    fireEvent.click(reload);
    await waitFor(() =>
      expect(screen.getByLabelText("Name")).toHaveValue("Newer name"),
    );
    expect(
      screen.queryByText("private database detail"),
    ).not.toBeInTheDocument();
  });

  it("shows a recoverable load error without uploading a guest profile", async () => {
    account.loadProfile.mockRejectedValueOnce(
      new Error("private database detail"),
    );
    await openProfile();
    expect(
      await screen.findByText("Couldn’t load your profile."),
    ).toBeVisible();
    expect(account.saveProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reload profile" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Name")).toHaveValue("Jordan"),
    );
    expect(
      screen.queryByText("private database detail"),
    ).not.toBeInTheDocument();
  });
});

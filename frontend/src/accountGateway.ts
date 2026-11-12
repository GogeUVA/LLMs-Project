import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ProfileDraft } from "./profileStorage";

export type AccountUser = { id: string; email: string };
export type ProfileRecord = { profile: ProfileDraft; version: number };
export type AccountEvent = "PASSWORD_RECOVERY";
export interface AccountGateway {
  getSession(): Promise<AccountUser | null>;
  subscribe(
    listener: (user: AccountUser | null, event?: AccountEvent) => void,
  ): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(
    email: string,
    password: string,
  ): Promise<{ needsEmailConfirmation: boolean }>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  loadProfile(): Promise<ProfileRecord | null>;
  saveProfile(
    profile: ProfileDraft,
    options: { expectedVersion: number | null },
  ): Promise<number>;
}

function safeError(code = "ACCOUNT_ERROR"): Error {
  return Object.assign(new Error("Account request failed"), { code });
}

function parseRecord(value: {
  profile: unknown;
  version: number;
}): ProfileRecord {
  const profile = value.profile as ProfileDraft;
  const details = ["name", "age", "height", "weight"] as const;
  const categories = [
    "allergies",
    "restrictions",
    "preferences",
    "dislikes",
  ] as const;
  if (
    !profile ||
    !details.every((field) => typeof profile[field] === "string") ||
    !categories.every(
      (field) =>
        Array.isArray(profile.dietary?.[field]) &&
        profile.dietary[field].every((item) => typeof item === "string"),
    ) ||
    !Number.isSafeInteger(value.version) ||
    value.version < 1
  )
    throw safeError();
  return {
    version: value.version,
    profile: {
      name: profile.name,
      age: profile.age,
      height: profile.height,
      weight: profile.weight,
      dietary: {
        allergies: profile.dietary.allergies,
        restrictions: profile.dietary.restrictions,
        preferences: profile.dietary.preferences,
        dislikes: profile.dietary.dislikes,
      },
    },
  };
}

export function createAccountGateway(client: SupabaseClient): AccountGateway {
  let activeUserId: string | null = null;
  let sessionRevision = 0;
  function updateIdentity(userId: string | null) {
    if (activeUserId !== userId) {
      activeUserId = userId;
      sessionRevision += 1;
    }
  }
  async function currentUser() {
    const startedAt = sessionRevision;
    const expectedUserId = activeUserId;
    const { data, error } = await client.auth.getUser();
    if (
      error ||
      !data.user ||
      data.user.id !== expectedUserId ||
      startedAt !== sessionRevision
    ) {
      throw safeError("SESSION_REQUIRED");
    }
    return data.user;
  }
  return {
    async getSession() {
      const startedAt = sessionRevision;
      const { data, error } = await client.auth.getSession();
      if (error) throw safeError();
      if (startedAt === sessionRevision)
        updateIdentity(data.session?.user.id ?? null);
      return data.session
        ? { id: data.session.user.id, email: data.session.user.email ?? "" }
        : null;
    },
    subscribe(listener) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        updateIdentity(session?.user.id ?? null);
        listener(
          session
            ? { id: session.user.id, email: session.user.email ?? "" }
            : null,
          event === "PASSWORD_RECOVERY" ? event : undefined,
        );
      });
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw safeError();
    },
    async signUp(email, password) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/#profile" },
      });
      if (error) throw safeError();
      return { needsEmailConfirmation: !data.session };
    },
    async signOut() {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw safeError();
    },
    async requestPasswordReset(email) {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/#account",
      });
      if (error) throw safeError();
    },
    async updatePassword(password) {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw safeError();
    },
    async loadProfile() {
      const user = await currentUser();
      const { data, error } = await client
        .from("student_profiles")
        .select("profile,version")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw safeError();
      return data ? parseRecord(data) : null;
    },
    async saveProfile(profile, { expectedVersion }) {
      const user = await currentUser();
      const table = client.from("student_profiles");
      const query =
        expectedVersion === null
          ? table.insert({ user_id: user.id, profile })
          : table
              .update({ profile })
              .eq("user_id", user.id)
              .eq("version", expectedVersion);
      const { data, error } = await query.select("version").maybeSingle();
      if (error?.code === "23505" || (!error && !data))
        throw safeError("PROFILE_CONFLICT");
      if (error || !data || !Number.isSafeInteger(data.version))
        throw safeError();
      return data.version;
    },
  };
}

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const defaultAccount =
  url && key ? createAccountGateway(createClient(url, key)) : undefined;

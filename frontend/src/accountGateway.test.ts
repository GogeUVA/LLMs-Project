import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAccountGateway } from "./accountGateway";

const user = { id: "student-a", email: "student@example.test" };
const profile = {
  name: "Jordan",
  age: "21",
  height: "69",
  weight: "155",
  dietary: { allergies: [], restrictions: [], preferences: [], dislikes: [] },
};
let notify: (event: string, session: { user: typeof user } | null) => void;
const query = {
  select: vi.fn(),
  eq: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  maybeSingle: vi.fn(),
};
const client = {
  auth: { getSession: vi.fn(), getUser: vi.fn(), onAuthStateChange: vi.fn() },
  from: vi.fn(),
};

beforeEach(() => {
  Object.values(query).forEach((mock) =>
    mock.mockReset().mockReturnValue(query),
  );
  client.from.mockReset().mockReturnValue(query);
  client.auth.getSession
    .mockReset()
    .mockResolvedValue({ data: { session: { user } }, error: null });
  client.auth.getUser
    .mockReset()
    .mockResolvedValue({ data: { user }, error: null });
  client.auth.onAuthStateChange.mockReset().mockImplementation((listener) => {
    notify = listener;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  query.maybeSingle.mockResolvedValue({
    data: { profile, version: 3 },
    error: null,
  });
});

async function account() {
  const gateway = createAccountGateway(client as unknown as SupabaseClient);
  gateway.subscribe(() => {});
  await gateway.getSession();
  return gateway;
}

describe("issue #24 account data boundary", () => {
  it("loads only the authenticated user's profile and validates the record", async () => {
    const gateway = await account();
    expect(await gateway.loadProfile()).toEqual({ profile, version: 3 });
    expect(client.from).toHaveBeenCalledWith("student_profiles");
    expect(query.eq).toHaveBeenCalledWith("user_id", user.id);
  });

  it("rejects malformed remote profiles instead of displaying them", async () => {
    const gateway = await account();
    query.maybeSingle.mockResolvedValue({
      data: { profile: { name: "Incomplete" }, version: 1 },
      error: null,
    });
    await expect(gateway.loadProfile()).rejects.toMatchObject({
      code: "ACCOUNT_ERROR",
    });
  });

  it("uses the loaded version as an update condition", async () => {
    const gateway = await account();
    query.maybeSingle.mockResolvedValue({ data: { version: 4 }, error: null });
    expect(await gateway.saveProfile(profile, { expectedVersion: 3 })).toBe(4);
    expect(query.update).toHaveBeenCalledWith({ profile });
    expect(query.eq).toHaveBeenCalledWith("user_id", user.id);
    expect(query.eq).toHaveBeenCalledWith("version", 3);
  });

  it("reports a conflict when a stale update changes no row", async () => {
    const gateway = await account();
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(
      gateway.saveProfile(profile, { expectedVersion: 3 }),
    ).rejects.toMatchObject({ code: "PROFILE_CONFLICT" });
  });

  it("reports a conflict if an empty account was created on another device", async () => {
    const gateway = await account();
    query.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "private diagnostic" },
    });
    await expect(
      gateway.saveProfile(profile, { expectedVersion: null }),
    ).rejects.toMatchObject({ code: "PROFILE_CONFLICT" });
    expect(query.insert).toHaveBeenCalledWith({ user_id: user.id, profile });
  });

  it("stops a pending save if authentication switches to another user", async () => {
    const gateway = await account();
    let resolveUser!: (value: object) => void;
    client.auth.getUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUser = resolve;
        }),
    );
    const saving = gateway.saveProfile(profile, { expectedVersion: 3 });
    notify("SIGNED_IN", { user: { ...user, id: "student-b" } });
    resolveUser({ data: { user: { ...user, id: "student-b" } }, error: null });
    await expect(saving).rejects.toMatchObject({ code: "SESSION_REQUIRED" });
    expect(client.from).not.toHaveBeenCalled();
  });
});

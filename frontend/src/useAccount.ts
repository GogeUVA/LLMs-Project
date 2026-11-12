import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AccountGateway,
  AccountUser,
  ProfileRecord,
} from "./accountGateway";
import type { ProfileDraft } from "./profileStorage";

export function useAccount(account: AccountGateway | undefined) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [ready, setReady] = useState(!account);
  const [recovery, setRecovery] = useState(false);
  const [record, setRecord] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const identity = useRef<string | null>(null);
  const revision = useRef(0);

  useEffect(() => {
    if (!account) return;
    let mounted = true;
    let sessionReceived = false;
    function acceptSession(next: AccountUser | null, recover = false) {
      if (!mounted) return;
      if (identity.current !== (next?.id ?? null)) {
        identity.current = next?.id ?? null;
        revision.current += 1;
        setRecord(null);
        setError("");
        setLoading(!!next);
      }
      setUser(next);
      setReady(true);
      if (!next) setRecovery(false);
      if (recover) setRecovery(true);
    }
    const unsubscribe = account.subscribe((next, event) => {
      sessionReceived = true;
      acceptSession(next, event === "PASSWORD_RECOVERY");
    });
    account
      .getSession()
      .then((next) => {
        if (!sessionReceived) acceptSession(next);
      })
      .catch(() => {
        if (mounted && !sessionReceived) {
          setReady(true);
          setError(
            "Couldn’t restore your account session. Please sign in again.",
          );
        }
      });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [account]);

  const userId = user?.id;
  useEffect(() => {
    if (!account || !userId) return;
    let active = true;
    const startedAt = revision.current;
    account
      .loadProfile()
      .then((next) => {
        if (active && revision.current === startedAt) {
          setRecord(next);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active && revision.current === startedAt) {
          setError("Couldn’t load your profile.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [account, userId, reload]);

  const reloadProfile = useCallback(() => {
    setRecord(null);
    setLoading(true);
    setError("");
    setReload((value) => value + 1);
  }, []);

  async function saveProfile(profile: ProfileDraft) {
    if (!account || !userId || loading) throw new Error("Session required");
    const version = await account.saveProfile(profile, {
      expectedVersion: record?.version ?? null,
    });
    if (identity.current !== userId) throw new Error("Session changed");
    setRecord({ profile, version });
  }

  return {
    user,
    ready,
    recovery,
    record,
    loading,
    error,
    reloadProfile,
    saveProfile,
    finishRecovery: () => setRecovery(false),
  };
}

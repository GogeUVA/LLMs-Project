import { useRef, useState, type FormEvent } from "react";
import DietaryFields, { type DietaryDraft } from "./DietaryFields";

import { loadProfile, storageKey, type ProfileDraft } from "./profileStorage";

type Details = Omit<ReturnType<typeof loadProfile>, "dietary">;

const fields = [
  {
    key: "name",
    label: "Name",
    type: "text",
    autoComplete: "name",
    maxLength: 100,
    required: true,
  },
  { key: "age", label: "Age", type: "number", min: 1, step: 1 },
  {
    key: "height",
    label: "Height (inches)",
    type: "number",
    min: 0.1,
    step: "any",
  },
  {
    key: "weight",
    label: "Weight (lbs)",
    type: "number",
    min: 0.1,
    step: "any",
  },
] as const;

export default function Profile({
  initialProfile,
  onSave,
  onReload,
}: {
  initialProfile?: ProfileDraft;
  onSave?: (profile: ProfileDraft) => Promise<void>;
  onReload?: () => void;
}) {
  const [profile, setProfile] = useState(() => initialProfile ?? loadProfile());
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState(false);
  const submitting = useRef(false);

  function updateProfile(change: Partial<Details> | { dietary: DietaryDraft }) {
    setProfile((current) => ({ ...current, ...change }));
    setMessage("");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const name = profile.name.trim();
    if (!name) {
      setMessage("Enter your name to save your profile.");
      return;
    }
    const saved = { ...profile, name };
    submitting.current = true;
    setPending(true);
    setMessage("");
    try {
      if (onSave) await onSave(saved);
      else
        localStorage.setItem(
          storageKey,
          JSON.stringify({ ...saved, units: "imperial" }),
        );
      setProfile(saved);
      setMessage("Profile saved.");
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "PROFILE_CONFLICT"
      ) {
        setConflict(true);
        setMessage(
          "Your profile changed on another device. Reload it before saving.",
        );
      } else
        setMessage(
          onSave
            ? "Couldn’t save your profile. Your edits are still here."
            : "Couldn’t save your profile in this browser. Your edits are still here.",
        );
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <>
      <div className="page-intro">
        <h1>Your profile</h1>
      </div>
      <form className="profile-form" onSubmit={saveProfile}>
        <fieldset className="profile-details">
          <legend>Personal details</legend>
          <div className="profile-grid">
            {fields.map(({ key, label, ...attributes }) => (
              <label key={key}>
                {label}
                <input
                  {...attributes}
                  value={profile[key]}
                  onChange={(event) =>
                    updateProfile({ [key]: event.target.value })
                  }
                />
              </label>
            ))}
          </div>
        </fieldset>
        <section aria-labelledby="dietary-heading">
          <h2 id="dietary-heading">Dietary needs</h2>
          <DietaryFields
            value={profile.dietary}
            onChange={(dietary) => updateProfile({ dietary })}
          />
        </section>
        <div className="profile-actions">
          <button type="submit" disabled={pending || conflict}>
            Save profile
          </button>
          {conflict && onReload && (
            <button type="button" onClick={onReload}>
              Reload profile
            </button>
          )}
          <p role="status">{message}</p>
        </div>
      </form>
    </>
  );
}

import { useState, type FormEvent } from "react";
import DietaryFields, { type DietaryDraft } from "./DietaryFields";

import { loadProfile, storageKey } from "./profileStorage";

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

export default function Profile() {
  const [profile, setProfile] = useState(loadProfile);
  const [message, setMessage] = useState("");

  function updateProfile(change: Partial<Details> | { dietary: DietaryDraft }) {
    setProfile((current) => ({ ...current, ...change }));
    setMessage("");
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = profile.name.trim();
    if (!name) {
      setMessage("Enter your name to save your profile.");
      return;
    }
    const saved = { ...profile, name };
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ ...saved, units: "imperial" }),
      );
      setProfile(saved);
      setMessage("Profile saved.");
    } catch {
      setMessage(
        "Couldn’t save your profile in this browser. Your edits are still here.",
      );
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
          <button type="submit">Save profile</button>
          <p role="status">{message}</p>
        </div>
      </form>
    </>
  );
}

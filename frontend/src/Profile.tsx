import { useState, type FormEvent } from "react";
import DietaryFields, { type DietaryDraft } from "./DietaryFields";

const storageKey = "hoos-eating.profile.v1";

const emptyProfile = {
  name: "",
  age: "",
  height: "",
  weight: "",
  dietary: {
    allergies: [],
    restrictions: [],
    preferences: [],
    dislikes: [],
  } as DietaryDraft,
};

type ProfileDraft = typeof emptyProfile;
type Details = Omit<ProfileDraft, "dietary">;
const detailKeys = ["name", "age", "height", "weight"] as const;
const dietaryKeys = [
  "allergies",
  "restrictions",
  "preferences",
  "dislikes",
] as const;

function convertMeasurement(value: string, divisor: number) {
  if (!value || !Number.isFinite(Number(value))) return "";
  return String(Number((Number(value) / divisor).toFixed(1)));
}

function loadProfile(): ProfileDraft {
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return emptyProfile;
    const value = JSON.parse(stored) as
      (Partial<ProfileDraft> & { units?: string }) | null;
    if (
      value &&
      detailKeys.every((key) => typeof value[key] === "string") &&
      dietaryKeys.every((key) => {
        const choices = value.dietary?.[key];
        return (
          Array.isArray(choices) &&
          choices.every((choice) => typeof choice === "string")
        );
      })
    ) {
      const profile = value as ProfileDraft;
      if (value.units === "imperial") return profile;

      return {
        ...profile,
        height: convertMeasurement(profile.height, 2.54),
        weight: convertMeasurement(profile.weight, 0.45359237),
        dietary: {
          ...profile.dietary,
          preferences: profile.dietary.preferences.filter(
            (preference) => preference !== "warm meal",
          ),
        },
      };
    }
  } catch {
    return emptyProfile;
  }
  return emptyProfile;
}

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

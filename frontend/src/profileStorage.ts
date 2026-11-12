import type { DietaryDraft } from "./DietaryFields";

export const storageKey = "hoos-eating.profile.v1";

export const emptyProfile = {
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

export type ProfileDraft = typeof emptyProfile;
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

export function loadProfile(): ProfileDraft {
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
      const profile: ProfileDraft = {
        name: value.name as string,
        age: value.age as string,
        height: value.height as string,
        weight: value.weight as string,
        dietary: {
          allergies: value.dietary!.allergies,
          restrictions: value.dietary!.restrictions,
          preferences: value.dietary!.preferences,
          dislikes: value.dietary!.dislikes,
        },
      };
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

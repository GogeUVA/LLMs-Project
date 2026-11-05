export const selectionStorageKey = "hoos-eating-meal-selections";
export const selectionSessionKey = "hoos-eating-selection-session";

export type MealSelectionRecord = {
  mealId: string;
  sessionId: string;
  selectedAt: string;
  outcome: "selected" | "changed";
  previousMealId?: string;
};

type RecordSelectionOptions = {
  now?: () => Date;
};

function isSelectionRecord(value: unknown): value is MealSelectionRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<MealSelectionRecord>;
  return (
    typeof record.mealId === "string" &&
    typeof record.sessionId === "string" &&
    typeof record.selectedAt === "string" &&
    (record.outcome === "selected" || record.outcome === "changed")
  );
}

export function loadMealSelections(): MealSelectionRecord[] {
  try {
    const value = JSON.parse(localStorage.getItem(selectionStorageKey) ?? "[]");
    return Array.isArray(value) ? value.filter(isSelectionRecord) : [];
  } catch {
    return [];
  }
}

export function getOrCreateSelectionSessionId(
  createId: () => string = () => crypto.randomUUID(),
): string {
  const existing = sessionStorage.getItem(selectionSessionKey);
  if (existing) return existing;
  const sessionId = createId();
  sessionStorage.setItem(selectionSessionKey, sessionId);
  return sessionId;
}

export function recordMealSelection(
  input: { mealId: string; sessionId: string },
  { now = () => new Date() }: RecordSelectionOptions = {},
): { record: MealSelectionRecord; created: boolean } {
  const records = loadMealSelections();
  const previous = [...records]
    .reverse()
    .find(({ sessionId }) => sessionId === input.sessionId);
  if (previous?.mealId === input.mealId) {
    return { record: previous, created: false };
  }

  const record: MealSelectionRecord = {
    ...input,
    selectedAt: now().toISOString(),
    outcome: previous ? "changed" : "selected",
    ...(previous ? { previousMealId: previous.mealId } : {}),
  };
  localStorage.setItem(
    selectionStorageKey,
    JSON.stringify([...records, record]),
  );
  return { record, created: true };
}

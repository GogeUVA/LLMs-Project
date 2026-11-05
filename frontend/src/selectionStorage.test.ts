import { beforeEach, describe, expect, it } from "vitest";
import {
  getOrCreateSelectionSessionId,
  loadMealSelections,
  recordMealSelection,
  selectionSessionKey,
} from "./selectionStorage";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe("issue #13 meal selection records", () => {
  it("records the meal, session, and controlled timestamp", () => {
    const result = recordMealSelection(
      { mealId: "fixture-chicken", sessionId: "session-1" },
      { now: () => new Date("2026-11-05T14:30:00.000Z") },
    );

    expect(result.created).toBe(true);
    expect(result.record).toEqual({
      mealId: "fixture-chicken",
      sessionId: "session-1",
      selectedAt: "2026-11-05T14:30:00.000Z",
      outcome: "selected",
    });
    expect(loadMealSelections()).toEqual([result.record]);
  });

  it("does not create another record for a repeated selection", () => {
    const input = { mealId: "fixture-chicken", sessionId: "session-1" };
    recordMealSelection(input);
    const repeated = recordMealSelection(input);

    expect(repeated.created).toBe(false);
    expect(loadMealSelections()).toHaveLength(1);
  });

  it("distinguishes a changed choice in the same session", () => {
    recordMealSelection({ mealId: "fixture-chicken", sessionId: "session-1" });
    const changed = recordMealSelection({
      mealId: "fixture-bowl",
      sessionId: "session-1",
    });

    expect(changed.record).toMatchObject({
      mealId: "fixture-bowl",
      sessionId: "session-1",
      outcome: "changed",
      previousMealId: "fixture-chicken",
    });
    expect(loadMealSelections()).toHaveLength(2);
  });

  it("keeps the same meal distinct across sessions", () => {
    recordMealSelection({ mealId: "fixture-chicken", sessionId: "session-1" });
    recordMealSelection({ mealId: "fixture-chicken", sessionId: "session-2" });

    expect(loadMealSelections().map(({ sessionId }) => sessionId)).toEqual([
      "session-1",
      "session-2",
    ]);
  });

  it("reuses one identifier for the browser session", () => {
    const first = getOrCreateSelectionSessionId(() => "generated-session");
    const second = getOrCreateSelectionSessionId(() => "unused-session");

    expect(first).toBe("generated-session");
    expect(second).toBe(first);
    expect(sessionStorage.getItem(selectionSessionKey)).toBe(first);
  });
});

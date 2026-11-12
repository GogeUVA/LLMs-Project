// AI-generated tests for #32 [BUG-03]; no human refinement recorded.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const fetchRequest = vi.fn();

beforeEach(() => {
  window.history.replaceState(null, "", "#home");
  localStorage.clear();
  fetchRequest.mockReset();
  vi.stubGlobal("fetch", fetchRequest);
});

afterEach(() => vi.unstubAllGlobals());

function reviewNutrition(nutrition: Record<string, number | boolean>) {
  fetchRequest.mockResolvedValue({
    ok: true,
    json: async () => ({
      status: "ready",
      original_text: "protein and calories",
      constraints: { nutrition },
      clarifications: [],
      unsupported_details: [],
    }),
  });
  render(<App />);
  fireEvent.change(
    screen.getByRole("textbox", { name: "Describe your meal" }),
    { target: { value: "protein and calories" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
}

describe("issue #32 strict nutrition bounds", () => {
  it("shows exclusive protein and calorie targets with strict wording", async () => {
    reviewNutrition({
      min_protein_grams: 25,
      min_protein_exclusive: true,
      max_calories: 600,
      max_calories_exclusive: true,
    });
    expect(await screen.findByText("More than 25 g")).toBeVisible();
    expect(screen.getByText("Under 600 kcal")).toBeVisible();
    expect(screen.queryByText("At least 25 g")).not.toBeInTheDocument();
    expect(screen.queryByText("Up to 600 kcal")).not.toBeInTheDocument();
  });

  it("keeps inclusive wording when targets are not exclusive", async () => {
    reviewNutrition({
      min_protein_grams: 25,
      min_protein_exclusive: false,
      max_calories: 600,
    });
    expect(await screen.findByText("At least 25 g")).toBeVisible();
    expect(screen.getByText("Up to 600 kcal")).toBeVisible();
  });
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RecommendationDetails, {
  type MenuItemRecord,
} from "./RecommendationDetails";

const bowl = {
  id: "synthetic-bowl",
  name: "Test bowl",
  location: "Test dining hall",
  nutrition: { protein_g: 24, calories_kcal: 420 },
  provenance: {
    protein_g: {
      kind: "documented",
      source_name: "Test nutrition chart",
      source_url: "https://example.com/nutrition",
      effective_date: "2026-09-01",
    },
    calories_kcal: { kind: "estimated" },
    sodium_mg: {
      kind: "documented",
      source_name: "Unrelated sodium note",
    },
  },
} satisfies MenuItemRecord;

function renderBowl() {
  render(
    <RecommendationDetails
      validation={{ valid: true, mealId: bowl.id }}
      menuItems={[
        {
          ...bowl,
          id: "other-bowl",
          provenance: {
            protein_g: { kind: "documented", source_name: "Other meal chart" },
          },
        },
        bowl,
      ]}
    />,
  );
}

function detail(label: string) {
  const summary = screen.getByText("Full nutrition information");
  fireEvent.click(summary);
  const expanded = summary.closest("details");
  if (!expanded) throw new Error("Missing nutrition details");
  const row = within(expanded).getByText(label, {
    selector: "dt",
  }).parentElement;
  if (!row) throw new Error(`Missing detail row for ${label}`);
  return within(row);
}

describe("issue #7 recommendation sources", () => {
  it("shows a documented value with one linked source and effective date", () => {
    renderBowl();
    const protein = detail("Protein");
    expect(protein.getByText("24 g")).toBeVisible();
    const sources = screen.getByRole("region", { name: "Nutrition sources" });
    expect(
      within(sources).getByRole("link", { name: "Test nutrition chart" }),
    ).toHaveAttribute("href", "https://example.com/nutrition");
    expect(within(sources).getByText("Effective 2026-09-01")).toBeVisible();
    expect(
      protein.queryByText(/independently verified/i),
    ).not.toBeInTheDocument();
  });

  it("explicitly labels the estimate beside its value", () => {
    renderBowl();
    const calories = detail("Calories");
    expect(calories.getByText("420 kcal")).toBeVisible();
    expect(calories.getByText(/AI estimate/)).toBeVisible();
    expect(calories.queryByText("Documented")).not.toBeInTheDocument();
  });

  it("keeps missing values unavailable without showing unrelated source metadata", () => {
    renderBowl();
    const sodium = detail("Sodium");
    expect(sodium.getByText("Not available")).toBeVisible();
    expect(sodium.queryByText("Documented")).not.toBeInTheDocument();
    expect(screen.queryByText("Unrelated sodium note")).not.toBeInTheDocument();
  });

  it("keeps source metadata with the selected meal and not the wrong nutrient", () => {
    renderBowl();
    expect(
      detail("Calories").queryByText("Test nutrition chart"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Other meal chart")).not.toBeInTheDocument();
    const sources = screen.getByRole("region", { name: "Nutrition sources" });
    expect(
      within(sources).getAllByRole("link", { name: "Test nutrition chart" }),
    ).toHaveLength(1);
  });
});

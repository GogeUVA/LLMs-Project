// AI-generated tests for #6 [Alpha] 16; no human refinement recorded.
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RecommendationDetails from "./RecommendationDetails";

// Synthetic presentation fixture. These values do not describe a real menu item.
const proteinBowl = {
  id: "fixture-protein-bowl-24oz",
  name: "Protein Bowl",
  location: "Fixture Dining Location",
  price: { amount: 7.25, currency: "USD" },
  price_basis: "per bowl",
  serving_size: { amount: 24, unit: "oz", weight_grams: 384 },
  nutrition: {
    calories_kcal: 700,
    total_fat_g: 53,
    saturated_fat_g: 6,
    trans_fat_g: 0,
    cholesterol_mg: 65,
    sodium_mg: 780,
    total_carbohydrate_g: 60,
    dietary_fiber_g: 5,
    total_sugars_g: 3,
    added_sugars_g: 2,
    protein_g: 26,
    vitamin_d_mcg: 0,
    calcium_mg: 70,
    iron_mg: 4.3,
    potassium_mg: 450,
  },
  ingredients: ["rice", "chicken", "sauce"],
  allergens: ["milk", "sesame"],
};

describe("issue #6 recommendation details", () => {
  it("renders the validated menu identity and available facts with their units", () => {
    render(
      <RecommendationDetails
        validation={{ valid: true, mealId: proteinBowl.id }}
        menuItems={[proteinBowl]}
      />,
    );

    const details = screen.getByRole("article", {
      name: "Recommendation details for Protein Bowl",
    });
    expect(details).toHaveAttribute("data-item-id", proteinBowl.id);
    expect(within(details).getByText("Fixture Dining Location")).toBeVisible();
    expect(within(details).getByText("$7.25")).toBeVisible();
    expect(within(details).getByText("per bowl")).toBeVisible();
    expect(within(details).getByText("24 oz (384 g)")).toBeVisible();
    expect(within(details).getByText("rice, chicken, sauce")).toBeVisible();
    expect(within(details).getByText("milk, sesame")).toBeVisible();
    expect(within(details).getByText("700 kcal")).toBeVisible();
    expect(within(details).getByText("53 g")).toBeVisible();
    expect(within(details).getByText("780 mg")).toBeVisible();
    expect(within(details).getByText("26 g")).toBeVisible();
  });

  it("labels missing price, serving, ingredients, allergens, and nutrients unavailable", () => {
    const partialMenuItem = {
      id: "fixture-meal",
      name: "Fixture Meal",
      location: "Fixture Location",
      price: null,
      serving_size: null,
      nutrition: { calories_kcal: 310 },
      ingredients: null,
      allergens: null,
    };

    render(
      <RecommendationDetails
        validation={{ valid: true, mealId: partialMenuItem.id }}
        menuItems={[partialMenuItem]}
      />,
    );

    const details = screen.getByRole("article", {
      name: "Recommendation details for Fixture Meal",
    });
    expect(
      within(details).getAllByText("Not available").length,
    ).toBeGreaterThan(5);
    expect(within(details).getByText("310 kcal")).toBeVisible();
    expect(
      within(details).getByText(
        "Unknown information cannot confirm that a meal meets a hard constraint.",
      ),
    ).toBeVisible();
  });

  it("does not show meal details unless validation passes", () => {
    render(
      <RecommendationDetails
        validation={{ valid: false, mealId: proteinBowl.id }}
        menuItems={[proteinBowl]}
      />,
    );

    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.queryByText("Protein Bowl")).not.toBeInTheDocument();
  });

  it("does not display a valid result whose ID is absent from the menu records", () => {
    render(
      <RecommendationDetails
        validation={{ valid: true, mealId: "unknown-menu-id" }}
        menuItems={[proteinBowl]}
      />,
    );

    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("uses menu-record facts instead of conflicting model-supplied details", () => {
    const validationWithUntrustedFacts = {
      valid: true,
      mealId: proteinBowl.id,
      name: "Invented Bowl",
      calories_kcal: 9999,
      price: { amount: 0, currency: "USD" },
    };

    render(
      <RecommendationDetails
        validation={validationWithUntrustedFacts}
        menuItems={[proteinBowl]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Protein Bowl" })).toBeVisible();
    expect(screen.getByText("700 kcal")).toBeVisible();
    expect(screen.getByText("$7.25")).toBeVisible();
    expect(screen.queryByText("Invented Bowl")).not.toBeInTheDocument();
    expect(screen.queryByText("9999 kcal")).not.toBeInTheDocument();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
  });

  it("does not claim empty ingredient or allergen arrays mean none", () => {
    const emptyListMenuItem = {
      id: "fixture-meal",
      name: "Fixture Meal",
      location: "Fixture Location",
      ingredients: [],
      allergens: [],
    };

    render(
      <RecommendationDetails
        validation={{ valid: true, mealId: emptyListMenuItem.id }}
        menuItems={[emptyListMenuItem]}
      />,
    );

    const details = screen.getByRole("article", {
      name: "Recommendation details for Fixture Meal",
    });
    expect(within(details).queryByText("None listed")).not.toBeInTheDocument();
    expect(
      within(details).getAllByText("Not available").length,
    ).toBeGreaterThan(0);
  });
});

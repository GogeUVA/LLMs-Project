// AI-generated tests; issue #14 [SETUP-01]. Human refinement not yet recorded.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("SETUP-01 application shell", () => {
  it("identifies the application and communicates its setup-only state", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Hoos Eating", level: 1 }),
    ).toBeVisible();
    expect(
      screen.getByText(/Meal recommendations are not available yet/),
    ).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DietaryFields, { type DietaryDraft } from "./DietaryFields";

function Harness() {
  const [value, setValue] = useState<DietaryDraft>({
    allergies: ["peanut"],
    restrictions: ["vegan"],
    preferences: ["high protein"],
    dislikes: ["mushroom"],
  });
  return <DietaryFields value={value} onChange={setValue} />;
}

describe("issue #1 dietary entry", () => {
  it("shows the selected allergy and requirement in the editor", () => {
    render(<Harness />);
    for (const name of ["Peanuts", "Vegan"]) {
      expect(screen.getByRole("checkbox", { name })).toBeChecked();
    }
  });

  it("adds another allergy without dropping existing selections", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Sesame" }));
    expect(screen.getByRole("checkbox", { name: "Sesame" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Peanuts" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Vegan" })).toBeChecked();
  });

  it("lets students explicitly remove a restriction without removing an allergy", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Vegan" }));
    expect(screen.getByRole("checkbox", { name: "Vegan" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Peanuts" })).toBeChecked();
  });

  it("adds an unlisted allergy and identifies it as needing verification", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Add another allergy"));
    fireEvent.change(screen.getByRole("textbox", { name: "Another allergy" }), {
      target: { value: "  Mustard  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add allergy" }));
    expect(screen.getByRole("checkbox", { name: "Mustard" })).toBeChecked();
    expect(
      screen.getByText("Unlisted requirements need menu evidence."),
    ).toBeVisible();
  });
});

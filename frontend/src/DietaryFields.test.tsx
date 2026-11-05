// AI-generated tests for #1; human review/refinement pending.
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DietaryFields from "./DietaryFields";

const initial = {
  allergies: "peanut",
  restrictions: "vegan",
  preferences: "high protein",
  dislikes: "mushroom",
};

function Harness() {
  const [value, setValue] = useState(initial);
  return <DietaryFields value={value} onChange={setValue} />;
}

describe("issue #1 dietary entry", () => {
  it("labels and preserves the four distinct dietary categories", () => {
    render(<Harness />);
    expect(screen.getByRole("textbox", { name: /^allergies$/i })).toHaveValue(
      "peanut",
    );
    expect(
      screen.getByRole("textbox", { name: /^hard restrictions$/i }),
    ).toHaveValue("vegan");
    expect(screen.getByRole("textbox", { name: /^preferences$/i })).toHaveValue(
      "high protein",
    );
    expect(
      screen.getByRole("textbox", { name: /^disliked foods$/i }),
    ).toHaveValue("mushroom");
  });

  it("edits a preference without removing an allergy or restriction", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("textbox", { name: /^preferences$/i }), {
      target: { value: "warm meal" },
    });
    expect(screen.getByRole("textbox", { name: /^preferences$/i })).toHaveValue(
      "warm meal",
    );
    expect(screen.getByRole("textbox", { name: /^allergies$/i })).toHaveValue(
      "peanut",
    );
    expect(
      screen.getByRole("textbox", { name: /^hard restrictions$/i }),
    ).toHaveValue("vegan");
    expect(
      screen.getByRole("textbox", { name: /^disliked foods$/i }),
    ).toHaveValue("mushroom");
  });

  it("allows an explicit restriction edit without changing other categories", () => {
    render(<Harness />);
    fireEvent.change(
      screen.getByRole("textbox", { name: /^hard restrictions$/i }),
      {
        target: { value: "vegetarian" },
      },
    );
    expect(
      screen.getByRole("textbox", { name: /^hard restrictions$/i }),
    ).toHaveValue("vegetarian");
    expect(screen.getByRole("textbox", { name: /^allergies$/i })).toHaveValue(
      "peanut",
    );
  });
});

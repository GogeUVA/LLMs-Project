import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "#home");
});

describe("Hoos Eating profile", () => {
  it("opens Profile from the home page and returns via the wordmark", async () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Find a meal on Grounds", level: 1 }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Profile" }));
    expect(
      await screen.findByRole("heading", { name: "Your profile", level: 1 }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Dietary needs" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("link", { name: "Hoos Eating" }));
    expect(
      await screen.findByRole("heading", {
        name: "Find a meal on Grounds",
        level: 1,
      }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("restores personal details and dietary choices after reopening", () => {
    window.history.replaceState(null, "", "#profile");
    const { unmount } = render(<App />);
    const details = {
      Name: "Jordan Lee",
      Age: "21",
      "Height (inches)": "69",
      "Weight (lbs)": "155.5",
    };
    for (const [label, value] of Object.entries(details)) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole("checkbox", { name: "Peanuts" }));
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(screen.getByRole("status")).toHaveTextContent("Profile saved.");
    unmount();
    render(<App />);
    expect(screen.getByLabelText("Name")).toHaveValue("Jordan Lee");
    expect(screen.getByLabelText("Age")).toHaveValue(21);
    expect(screen.getByLabelText("Height (inches)")).toHaveValue(69);
    expect(screen.getByLabelText("Weight (lbs)")).toHaveValue(155.5);
    expect(screen.getByRole("checkbox", { name: "Peanuts" })).toBeChecked();
  });
  it("converts saved metric measurements and removes the retired preset", () => {
    window.history.replaceState(null, "", "#profile");
    localStorage.setItem(
      "hoos-eating.profile.v1",
      JSON.stringify({
        name: "Jordan Lee",
        age: "21",
        height: "177.8",
        weight: "68.0388555",
        dietary: {
          allergies: [],
          restrictions: [],
          preferences: ["warm meal", "high protein"],
          dislikes: [],
        },
      }),
    );
    render(<App />);
    expect(screen.getByLabelText("Height (inches)")).toHaveValue(70);
    expect(screen.getByLabelText("Weight (lbs)")).toHaveValue(150);
    expect(
      screen.queryByRole("checkbox", { name: "Warm meal" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "What you like" }),
    ).not.toBeInTheDocument();
  });
});

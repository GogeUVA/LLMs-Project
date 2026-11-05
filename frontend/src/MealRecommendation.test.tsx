import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { storageKey } from "./profileStorage";

const fetchRequest = vi.fn();
const request = "Find a meal at Fixture Dining with at least 30 g of protein.";
const meal = {
  id: "fixture-chicken",
  name: "Fixture Chicken",
  location: "Fixture Dining",
  nutrition: { protein_g: 47 },
};
const alternativeMeal = {
  ...meal,
  id: "fixture-tofu",
  name: "Fixture Tofu",
  nutrition: { protein_g: 35 },
};

beforeEach(() => {
  window.history.replaceState(null, "", "#home");
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem("hoos-eating-selection-session", "fixture-session");
  fetchRequest.mockReset();
  vi.stubGlobal("fetch", fetchRequest);
});

afterEach(() => vi.unstubAllGlobals());

function submit(reply: object, message = request) {
  fetchRequest.mockResolvedValue({ ok: true, json: async () => reply });
  render(<App />);
  fireEvent.change(
    screen.getByRole("textbox", { name: "Describe your meal" }),
    {
      target: { value: message },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
}

describe("issue #4 menu-grounded recommendation", () => {
  it("asks for a recommendation and displays the validated menu item in chat", async () => {
    const explanation = "47 g protein per serving meets your 30 g minimum.";
    submit({ status: "recommended", meal, explanation });
    const chat = screen.getByRole("log", { name: "Meal conversation" });
    const details = await within(chat).findByRole("article", {
      name: "Recommendation details for Fixture Chicken",
    });
    expect(within(chat).getByText(explanation)).toBeVisible();
    expect(
      within(chat).queryByText("Check Grubhub for meal exchange eligibility."),
    ).not.toBeInTheDocument();
    expect(within(details).getByText("Fixture Dining")).toBeVisible();
    expect(within(details).getAllByText("47 g")[0]).toBeVisible();
    expect(JSON.parse(fetchRequest.mock.calls[0][1].body)).toMatchObject({
      text: request,
      recommend: true,
    });
  });

  it("offers recovery without displaying details for a rejected candidate", async () => {
    submit({
      status: "recommendation_failed",
      reason: "invalid_recommendation",
      meal,
    });
    expect(
      await screen.findByText("I couldn’t verify the suggested meal."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit request" })).toBeVisible();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.queryByText("Fixture Chicken")).not.toBeInTheDocument();
  });
});

describe("issue #12 recommendation correction", () => {
  it("announces correction while pending and replaces progress with recovery on exhaustion", async () => {
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        stream = controller;
      },
    });
    fetchRequest.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/x-ndjson" }),
      body,
    });
    render(<App />);
    fireEvent.change(
      screen.getByRole("textbox", { name: "Describe your meal" }),
      {
        target: { value: request },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    const encoder = new TextEncoder();
    const sendEvent = (event: object) =>
      stream.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

    sendEvent({ type: "progress" });
    expect(await screen.findByText("Thinking…")).toBeVisible();
    sendEvent({ type: "progress", stage: "correcting" });
    try {
      expect(await screen.findByText("Checking another meal…")).toBeVisible();
      expect(screen.queryByRole("article")).not.toBeInTheDocument();
    } finally {
      sendEvent({
        type: "reply",
        reply: {
          status: "recommendation_failed",
          reason: "correction_exhausted",
        },
      });
      stream.close();
      expect(
        await screen.findByText("I couldn’t verify the suggested meals."),
      ).toBeVisible();
    }
    expect(
      screen.queryByText("Checking another meal…"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit request" })).toBeVisible();
  });
});

describe("issue #13 validated meal selection", () => {
  it("records a displayed recommendation and confirms the in-app selection", async () => {
    submit({ status: "recommended", meal, explanation: "Verified match." });

    const select = await screen.findByRole("button", {
      name: "Select Fixture Chicken",
    });
    expect(select).toHaveTextContent("Select this meal");
    expect(
      screen.queryByText(
        /\b(buy|bought|purchase|purchased|order|ordered|consume|consumed)\b/i,
      ),
    ).not.toBeInTheDocument();
    fireEvent.click(select);

    expect(
      screen.getByRole("status", { name: "Meal selection" }),
    ).toHaveTextContent("Selected Fixture Chicken for this session.");
    expect(select).toBeDisabled();
    expect(
      JSON.parse(localStorage.getItem("hoos-eating-meal-selections")!),
    ).toEqual([
      expect.objectContaining({
        mealId: meal.id,
        sessionId: "fixture-session",
        selectedAt: expect.any(String),
        outcome: "selected",
      }),
    ]);
  });

  it("does not offer selection for a rejected recommendation", async () => {
    submit({
      status: "recommendation_failed",
      reason: "invalid_recommendation",
      meal,
    });

    expect(await screen.findByText(/verify the suggested meal/i)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /select fixture chicken/i }),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem("hoos-eating-meal-selections")).toBeNull();
  });
});

describe("issue #8 alternative recommendation", () => {
  it("requests another meal with the same request and excludes the current meal", async () => {
    const constrainedRequest =
      "Find a vegan meal at Fixture Dining at 12:00 under $10 with at least 30 g protein.";
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        name: "",
        age: "",
        height: "",
        weight: "",
        dietary: {
          allergies: [],
          restrictions: ["vegan"],
          preferences: [],
          dislikes: [],
        },
      }),
    );
    submit(
      { status: "recommended", meal, explanation: "Verified match." },
      constrainedRequest,
    );
    fetchRequest.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "recommended",
        meal: alternativeMeal,
        explanation: "Another verified match.",
      }),
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Try another meal" }),
    );

    expect(
      await screen.findByRole("article", {
        name: "Recommendation details for Fixture Tofu",
      }),
    ).toBeVisible();
    expect(fetchRequest).toHaveBeenCalledTimes(2);
    const initialBody = JSON.parse(fetchRequest.mock.calls[0][1].body);
    const alternativeBody = JSON.parse(fetchRequest.mock.calls[1][1].body);
    expect(initialBody).toMatchObject({
      text: constrainedRequest,
      dietary: { restrictions: ["vegan"] },
    });
    expect(alternativeBody).toMatchObject({
      ...initialBody,
      excluded_meal_ids: [meal.id],
    });
  });

  it("explains when no eligible alternative remains", async () => {
    submit({ status: "recommended", meal, explanation: "Verified match." });
    fetchRequest.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "recommendation_failed",
        reason: "no_alternative",
      }),
    });

    fireEvent.click(
      await screen.findByRole("button", { name: "Try another meal" }),
    );

    expect(
      await screen.findByText(/no other verified meal.*requirements/i),
    ).toBeVisible();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });
});

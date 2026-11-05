import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const fetchRequest = vi.fn();
const request = "Find a meal at Fixture Dining with at least 30 g of protein.";
const meal = {
  id: "fixture-chicken",
  name: "Fixture Chicken",
  location: "Fixture Dining",
  nutrition: { protein_g: 47 },
};

beforeEach(() => {
  window.history.replaceState(null, "", "#home");
  fetchRequest.mockReset();
  vi.stubGlobal("fetch", fetchRequest);
});

afterEach(() => vi.unstubAllGlobals());

function submit(reply: object) {
  fetchRequest.mockResolvedValue({ ok: true, json: async () => reply });
  render(<App />);
  fireEvent.change(
    screen.getByRole("textbox", { name: "Describe your meal" }),
    {
      target: { value: request },
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
    expect(within(details).getByText("Fixture Dining")).toBeVisible();
    expect(within(details).getByText("47 g")).toBeVisible();
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

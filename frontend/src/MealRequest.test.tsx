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

function enterRequest(text: string) {
  fireEvent.change(
    screen.getByRole("textbox", { name: "Describe your meal" }),
    {
      target: { value: text },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "Review request" }));
}

describe("issue #2 meal request", () => {
  it("submits a meal request and displays the interpreted budget", async () => {
    fetchRequest.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ready",
        original_text: "Lunch under $10",
        constraints: { max_budget_cents: 1000 },
        clarifications: [],
        unsupported_details: [],
      }),
    });
    render(<App />);
    enterRequest("Lunch under $10");
    expect(await screen.findByText("$10.00")).toBeVisible();
    expect(fetchRequest).toHaveBeenCalledTimes(1);
    const [url, options] = fetchRequest.mock.calls[0];
    expect(url).toBe("/api/requests/interpret");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toMatchObject({ text: "Lunch under $10" });
  });

  it("keeps the original request editable when clarification is needed", async () => {
    fetchRequest.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "needs_clarification",
        original_text: "Lunch near the library",
        constraints: {},
        clarifications: [
          { field: "location", question: "Which dining location?" },
        ],
        unsupported_details: [],
      }),
    });
    render(<App />);
    enterRequest("Lunch near the library");
    expect(await screen.findByText("Which dining location?")).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Describe your meal" }),
    ).toHaveValue("Lunch near the library");
  });

  it("does not send a whitespace-only request", () => {
    render(<App />);
    enterRequest("   ");
    expect(fetchRequest).not.toHaveBeenCalled();
  });
});

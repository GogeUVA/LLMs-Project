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
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
}

describe("issue #2 meal request", () => {
  it("uses an accessible icon control and disables it for an empty draft", () => {
    render(<App />);
    const send = screen.getByRole("button", { name: "Send message" });
    expect(send).toBeDisabled();
    expect(send).toHaveTextContent(/^$/);
    expect(
      screen.queryByRole("button", { name: "Try an example" }),
    ).not.toBeInTheDocument();
  });

  it("stops a pending reply and restores the unsent text", async () => {
    fetchRequest.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    render(<App />);
    enterRequest("Lunch under $10");
    fireEvent.click(screen.getByRole("button", { name: "Stop response" }));
    expect(await screen.findByText("Response stopped.")).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Describe your meal" }),
    ).toHaveValue("Lunch under $10");
  });

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

  it("keeps the original request and includes it in a follow-up", async () => {
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
    expect(screen.getByText("Lunch near the library")).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Describe your meal" }),
    ).toHaveValue("");
    enterRequest("Newcomb Hall");
    expect(fetchRequest).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchRequest.mock.calls[1][1].body)).toMatchObject({
      text: "Newcomb Hall",
      history: [
        {
          text: "Lunch near the library",
          questions: ["Which dining location?"],
        },
      ],
    });
    await screen.findByText("Newcomb Hall");
  });

  it("does not send a whitespace-only request", () => {
    render(<App />);
    enterRequest("   ");
    expect(fetchRequest).not.toHaveBeenCalled();
  });
});

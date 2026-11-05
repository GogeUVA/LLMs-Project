import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { storageKey } from "./profileStorage";

const fetchRequest = vi.fn();
const request = "The Halal Shack, at least 30 g protein, under $10";
const dietary = {
  allergies: [],
  restrictions: ["vegetarian"],
  preferences: [],
  dislikes: [],
};

function sendRequest() {
  render(<App />);
  fireEvent.change(
    screen.getByRole("textbox", { name: "Describe your meal" }),
    {
      target: { value: request },
    },
  );
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
}

function failureReply(reason: string) {
  return {
    ok: true,
    json: async () => ({
      status: "recommendation_failed",
      reason,
      detail: "Internal provider exception",
      recommendation: { name: "Unverified meal" },
    }),
  };
}

beforeEach(() => {
  window.history.replaceState(null, "", "#home");
  localStorage.setItem(
    storageKey,
    JSON.stringify({ name: "", age: "", height: "", weight: "", dietary }),
  );
  fetchRequest.mockReset();
  vi.stubGlobal("fetch", fetchRequest);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("issue #9 recommendation recovery", () => {
  it("explains no match and lets the user edit the original request", async () => {
    fetchRequest.mockResolvedValue(failureReply("no_match"));
    sendRequest();

    const chat = screen.getByRole("log", { name: "Meal conversation" });
    expect(
      await within(chat).findByText(
        "I couldn’t verify a meal that meets your requirements.",
      ),
    ).toBeVisible();
    expect(within(chat).getByText(request)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Unverified meal")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Internal provider exception"),
    ).not.toBeInTheDocument();

    const draft = screen.getByRole("textbox", { name: "Describe your meal" });
    fireEvent.click(within(chat).getByRole("button", { name: "Edit request" }));
    expect(draft).toHaveValue(request);
    expect(draft).toHaveFocus();
    expect(fetchRequest).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["model_unavailable", "Meal suggestions are temporarily unavailable."],
    ["timeout", "The meal search took too long."],
    ["correction_exhausted", "I couldn’t verify the suggested meals."],
  ])(
    "shows a clear message for %s and withholds invalid output",
    async (reason, message) => {
      fetchRequest.mockResolvedValue(failureReply(reason));
      sendRequest();

      const chat = screen.getByRole("log", { name: "Meal conversation" });
      expect(await within(chat).findByText(message)).toBeVisible();
      expect(within(chat).getByText(request)).toBeVisible();
      expect(screen.queryByText("Unverified meal")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Internal provider exception"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/Sending…|Thinking…/)).not.toBeInTheDocument();
      if (reason === "correction_exhausted") {
        expect(
          within(chat).getByRole("button", { name: "Edit request" }),
        ).toBeVisible();
        expect(
          within(chat).queryByRole("button", { name: "Retry" }),
        ).not.toBeInTheDocument();
      } else {
        expect(
          within(chat).getByRole("button", { name: "Retry" }),
        ).toBeVisible();
      }
    },
  );

  it("replaces pending progress on API failure and retries the same request and preferences", async () => {
    let finishRequest!: (response: { ok: boolean; status: number }) => void;
    fetchRequest.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRequest = resolve;
        }),
    );
    fetchRequest.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "ready",
        original_text: request,
        constraints: {},
        clarifications: [],
        unsupported_details: [],
      }),
    });
    sendRequest();
    expect(screen.getByText("Sending…")).toBeVisible();
    finishRequest({ ok: false, status: 503 });

    const chat = screen.getByRole("log", { name: "Meal conversation" });
    const retry = await within(chat).findByRole("button", { name: "Retry" });
    expect(
      within(chat).getByText("Meal suggestions are temporarily unavailable."),
    ).toBeVisible();
    expect(screen.queryByText("Sending…")).not.toBeInTheDocument();
    localStorage.removeItem(storageKey);
    fireEvent.click(retry);

    expect(
      await within(chat).findByText("Here’s what I have for your meal."),
    ).toBeVisible();
    expect(within(chat).getAllByText(request)).toHaveLength(1);
    expect(fetchRequest).toHaveBeenCalledTimes(2);
    const first = JSON.parse(fetchRequest.mock.calls[0][1].body);
    const second = JSON.parse(fetchRequest.mock.calls[1][1].body);
    expect(first).toMatchObject({ text: request, dietary });
    expect(second).toEqual(first);
    expect(
      within(chat).queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
  });

  it("treats an HTTP gateway timeout as a timeout without exposing server details", async () => {
    fetchRequest.mockResolvedValue({ ok: false, status: 504 });
    sendRequest();

    const chat = screen.getByRole("log", { name: "Meal conversation" });
    expect(
      await within(chat).findByText("The meal search took too long."),
    ).toBeVisible();
    expect(within(chat).getByRole("button", { name: "Retry" })).toBeVisible();
    expect(within(chat).getByText(request)).toBeVisible();
    expect(screen.queryByText(/504|Request failed/)).not.toBeInTheDocument();
  });
});

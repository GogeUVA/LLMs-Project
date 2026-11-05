import { useEffect, useRef, useState, type FormEvent } from "react";
import { readChatReply } from "./chatResponse";
import { loadProfile } from "./profileStorage";
import type { DietaryDraft } from "./DietaryFields";

interface Review {
  status: "ready" | "needs_clarification";
  constraints: {
    goal?: string;
    max_budget_cents?: number;
    location?: string;
    meal_time?: string;
    nutrition?: { min_protein_grams?: number; max_calories?: number };
    dietary?: DietaryDraft;
  };
  clarifications: { field: string; question: string }[];
  unsupported_details: string[];
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function RequestReview({ review }: { review: Review }) {
  const { goal, max_budget_cents, location, meal_time, nutrition, dietary } =
    review.constraints;
  const details = [
    ["Goal", goal],
    [
      "Maximum budget",
      max_budget_cents == null ? "" : currency.format(max_budget_cents / 100),
    ],
    ["Location", location],
    ["Meal time", meal_time],
    [
      "Protein",
      nutrition?.min_protein_grams == null
        ? ""
        : `At least ${nutrition.min_protein_grams} g`,
    ],
    [
      "Calories",
      nutrition?.max_calories == null
        ? ""
        : `Up to ${nutrition.max_calories} kcal`,
    ],
    ["Allergies", dietary?.allergies.join(", ")],
    ["Dietary requirements", dietary?.restrictions.join(", ")],
    ["Preferences", dietary?.preferences.join(", ")],
    ["Disliked foods", dietary?.dislikes.join(", ")],
  ].filter(([, value]) => value);

  return (
    <div className="meal-review">
      {review.clarifications.map(({ field, question }, index) => (
        <p key={`${field}-${index}`}>{question}</p>
      ))}
      {review.status === "ready" && <p>Here’s what I have for your meal.</p>}
      {review.status === "ready" && details.length > 0 && (
        <dl>
          {details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {review.unsupported_details.length > 0 && (
        <p>
          <strong>Details we can’t check yet</strong>{" "}
          {review.unsupported_details.join("; ")}
        </p>
      )}
    </div>
  );
}

interface Turn {
  text: string;
  reply?: Review;
}

const maxRequestLength = 2000;

export default function MealRequest() {
  const [text, setText] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const description = useRef<HTMLTextAreaElement>(null);
  const latestMessage = useRef<HTMLDivElement>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (turns.length)
      latestMessage.current?.scrollIntoView?.({ block: "nearest" });
  }, [turns, pending]);

  useEffect(() => () => activeRequest.current?.abort(), []);

  function editMessage(value: string) {
    setText(value);
    setMessage("");
  }

  function startNewChat() {
    setTurns([]);
    editMessage("");
    description.current?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeRequest.current) return;
    if (!text.trim()) {
      setMessage("Describe the meal you want.");
      return;
    }

    if (turns.length >= 20) {
      setMessage("Start a new chat to send another message.");
      return;
    }
    const history = turns.map((turn) => ({
      text: turn.text,
      questions:
        turn.reply?.clarifications.map(({ question }) => question) ?? [],
    }));

    const previousTurns = turns;
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(true);
    setProcessing(false);
    setTurns([...previousTurns, { text }]);
    editMessage("");
    try {
      const response = await fetch("/api/requests/interpret", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: JSON.stringify({ text, history, dietary: loadProfile().dietary }),
      });
      const reply = await readChatReply<Review>(response, () =>
        setProcessing(true),
      );
      setTurns([...previousTurns, { text, reply }]);
    } catch {
      setTurns(previousTurns);
      setText(text);
      setMessage(
        controller.signal.aborted
          ? "Response stopped."
          : "Couldn’t send your message. Try again.",
      );
    } finally {
      activeRequest.current = null;
      setPending(false);
    }
  }

  return (
    <section className="meal-request" aria-labelledby="meal-request-title">
      <div className="chat-heading">
        <h1 id="meal-request-title">Find a meal on Grounds</h1>
        {turns.length > 0 && (
          <button
            className="chat-icon chat-reset"
            type="button"
            aria-label="New chat"
            title="New chat"
            disabled={pending}
            onClick={startNewChat}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M13 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M10 14l1-4 7-7 3 3-7 7-4 1Z" />
            </svg>
          </button>
        )}
      </div>
      <div className="chat-log" role="log" aria-label="Meal conversation">
        {turns.length === 0 && (
          <p className="meal-request-intro">
            What sounds good? Add a dining spot, budget, or dietary need.
          </p>
        )}
        {turns.map((turn, index) => (
          <div className="chat-turn" key={index}>
            <p className="chat-message">
              <span className="request-announcement">You: </span>
              {turn.text}
            </p>
            {turn.reply && (
              <div className="chat-reply">
                <span className="chat-avatar" aria-hidden="true">
                  HE
                </span>
                <div>
                  <span className="request-announcement">Hoos Eating: </span>
                  <RequestReview review={turn.reply} />
                </div>
              </div>
            )}
          </div>
        ))}
        {pending && (
          <div className="chat-reply">
            <span className="chat-avatar" aria-hidden="true">
              HE
            </span>
            <p className="chat-pending">
              <span className="chat-pulse" aria-hidden="true" />
              {processing ? "Thinking…" : "Sending…"}
            </p>
          </div>
        )}
        <div ref={latestMessage} />
      </div>
      <form className="request-form" onSubmit={submit}>
        <p role="status" className="request-message">
          {message}
        </p>
        <div className="chat-composer">
          <label htmlFor="meal-description" className="request-announcement">
            Describe your meal
          </label>
          <textarea
            id="meal-description"
            ref={description}
            rows={2}
            maxLength={maxRequestLength}
            value={text}
            placeholder={
              turns.length
                ? "Continue the conversation"
                : "Ask about meals on Grounds"
            }
            readOnly={pending}
            onChange={(event) => editMessage(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          {pending ? (
            <button
              className="chat-icon chat-send"
              type="button"
              aria-label="Stop response"
              title="Stop response"
              onClick={() => activeRequest.current?.abort()}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="7" y="7" width="10" height="10" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              className="chat-icon chat-send"
              type="submit"
              aria-label="Send message"
              title="Send message"
              disabled={!text.trim()}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 19V5m-6 6 6-6 6 6" />
              </svg>
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

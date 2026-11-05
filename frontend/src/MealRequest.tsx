import { useRef, useState, type FormEvent } from "react";
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

const example = "Vegetarian lunch at Newcomb Hall at noon, under $10.";

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
      <h3>
        {review.status === "needs_clarification"
          ? "A few details to clarify"
          : "Request details"}
      </h3>
      {review.clarifications.length > 0 && (
        <>
          <ul>
            {review.clarifications.map(({ field, question }, index) => (
              <li key={`${field}-${index}`}>{question}</li>
            ))}
          </ul>
          <p>Reply here with the details.</p>
        </>
      )}
      {details.length > 0 && (
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
  const inFlight = useRef(false);
  const description = useRef<HTMLTextAreaElement>(null);

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
    if (inFlight.current) return;
    if (!text.trim()) {
      setMessage("Describe the meal you want.");
      return;
    }

    const request = [...turns.map((turn) => turn.text), text].join(
      "\n\nFollow-up: ",
    );
    if (request.length > maxRequestLength) {
      setMessage("Start a new chat to send a longer request.");
      return;
    }

    const previousTurns = turns;
    inFlight.current = true;
    setPending(true);
    setTurns([...previousTurns, { text }]);
    editMessage("");
    try {
      const response = await fetch("/api/requests/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: request, dietary: loadProfile().dietary }),
      });
      if (!response.ok) throw new Error("Request failed");
      const reply: Review = await response.json();
      setTurns([...previousTurns, { text, reply }]);
    } catch {
      setTurns(previousTurns);
      setText(text);
      setMessage("Couldn’t send your message. Try again.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <section className="meal-request" aria-labelledby="meal-request-title">
      <div className="chat-heading">
        <h1 id="meal-request-title">Find a meal on Grounds</h1>
        {turns.length > 0 && (
          <button
            className="example-button"
            type="button"
            disabled={pending}
            onClick={startNewChat}
          >
            New chat
          </button>
        )}
      </div>
      <p className="meal-request-intro">
        What are you in the mood for? Add a dining spot, budget, or dietary need
        if it matters.
      </p>
      <div className="chat-log" role="log" aria-label="Meal conversation">
        {turns.map((turn, index) => (
          <div className="chat-turn" key={index}>
            <p className="chat-message">
              <span className="request-announcement">You: </span>
              {turn.text}
            </p>
            {turn.reply && <RequestReview review={turn.reply} />}
          </div>
        ))}
        {pending && <p className="chat-pending">Checking your request…</p>}
      </div>
      <form className="request-form" onSubmit={submit}>
        <div className="request-field-heading">
          <label htmlFor="meal-description">Describe your meal</label>
          {!text && turns.length === 0 && (
            <button
              className="example-button"
              type="button"
              onClick={() => {
                editMessage(example);
                description.current?.focus();
              }}
            >
              Try an example
            </button>
          )}
        </div>
        <textarea
          id="meal-description"
          ref={description}
          rows={2}
          maxLength={maxRequestLength}
          value={text}
          placeholder={
            turns.length
              ? "Reply with more details"
              : "For example, a vegetarian lunch under $10"
          }
          readOnly={pending}
          onChange={(event) => editMessage(event.target.value)}
        />
        <div className="request-actions">
          <p role="status" className="request-message">
            {message}
          </p>
          <button className="request-submit" type="submit" disabled={pending}>
            Send
          </button>
        </div>
      </form>
    </section>
  );
}

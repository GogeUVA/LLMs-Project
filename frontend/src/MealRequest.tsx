import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChatResponseError, readChatReply } from "./chatResponse";
import { loadProfile } from "./profileStorage";
import type { DietaryDraft } from "./DietaryFields";
import RecommendationDetails, {
  type MenuItemRecord,
} from "./components/RecommendationDetails";
import {
  getOrCreateSelectionSessionId,
  loadMealSelections,
  recordMealSelection,
} from "./selectionStorage";

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

function MealSelectionAction({
  meal,
  selected,
  onSelect,
  onAlternative,
}: {
  meal: MenuItemRecord;
  selected: boolean;
  onSelect: (meal: MenuItemRecord) => void;
  onAlternative?: (meal: MenuItemRecord) => void;
}) {
  return (
    <div className="meal-selection">
      <button
        type="button"
        aria-label={`Select ${meal.name}`}
        disabled={selected}
        onClick={() => onSelect(meal)}
      >
        {selected ? "Selected" : "Select this meal"}
      </button>
      {onAlternative && (
        <button type="button" onClick={() => onAlternative(meal)}>
          Try another meal
        </button>
      )}
      {selected && (
        <p role="status" aria-label="Meal selection">
          Selected {meal.name} for this session.
        </p>
      )}
    </div>
  );
}

interface Turn {
  text: string;
  body: string;
  reply?: Review | RecommendationFailure | RecommendedMeal;
}

interface RecommendedMeal {
  status: "recommended";
  meal: MenuItemRecord;
  explanation: string;
  unsupported_details?: string[];
}

const recoveryMessages = {
  no_match: "I couldn’t verify a meal that meets your requirements.",
  no_alternative:
    "There is no other verified meal that meets your requirements.",
  model_unavailable: "Meal suggestions are temporarily unavailable.",
  timeout: "The meal search took too long.",
  correction_exhausted: "I couldn’t verify the suggested meals.",
  invalid_recommendation: "I couldn’t verify the suggested meal.",
} as const;

interface RecommendationFailure {
  status: "recommendation_failed";
  reason: keyof typeof recoveryMessages;
}

function failure(
  reason: RecommendationFailure["reason"],
): RecommendationFailure {
  return { status: "recommendation_failed", reason };
}

function isReview(reply: Turn["reply"]): reply is Review {
  return reply?.status === "ready" || reply?.status === "needs_clarification";
}

function recoveryReply(reply: Turn["reply"]): NonNullable<Turn["reply"]> {
  if (
    reply?.status === "recommended" &&
    typeof reply.meal?.id === "string" &&
    typeof reply.meal.name === "string" &&
    typeof reply.explanation === "string"
  ) {
    return reply;
  }
  if (
    isReview(reply) &&
    reply.constraints &&
    Array.isArray(reply.clarifications) &&
    Array.isArray(reply.unsupported_details)
  ) {
    return reply;
  }
  if (
    reply?.status === "recommendation_failed" &&
    Object.hasOwn(recoveryMessages, reply.reason)
  ) {
    return failure(reply.reason);
  }
  return failure("model_unavailable");
}

const maxRequestLength = 2000;

export default function MealRequest({
  dietary,
}: { dietary?: DietaryDraft } = {}) {
  const [selectionSessionId] = useState(getOrCreateSelectionSessionId);
  const [selectedMealId, setSelectedMealId] = useState(
    () =>
      [...loadMealSelections()]
        .reverse()
        .find(({ sessionId }) => sessionId === selectionSessionId)?.mealId,
  );
  const [text, setText] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const description = useRef<HTMLTextAreaElement>(null);
  const latestMessage = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState<
    "sending" | "thinking" | "correcting"
  >("sending");

  useEffect(() => {
    if (turns.length)
      latestMessage.current?.scrollIntoView?.({ block: "nearest" });
  }, [turns, pending]);

  useEffect(() => () => activeRequest.current?.abort(), []);

  function editMessage(value: string) {
    setText(value);
    setMessage("");
  }

  function selectMeal(meal: MenuItemRecord) {
    recordMealSelection({
      mealId: meal.id,
      sessionId: selectionSessionId,
    });
    setSelectedMealId(meal.id);
  }

  function requestAlternative(turn: Turn, index: number, mealId: string) {
    const request = JSON.parse(turn.body);
    const excludedMealIds = Array.isArray(request.excluded_meal_ids)
      ? request.excluded_meal_ids
      : [];
    const body = JSON.stringify({
      ...request,
      excluded_meal_ids: [...new Set([...excludedMealIds, mealId])],
    });
    setMessage("");
    void send({ text: turn.text, body }, turns.slice(0, index));
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
    const history = turns.flatMap(({ text, reply }) => {
      if (isReview(reply)) {
        return [
          {
            text,
            questions: reply.clarifications.map(({ question }) => question),
          },
        ];
      }
      if (
        reply?.status === "recommended" ||
        (reply?.status === "recommendation_failed" &&
          [
            "no_match",
            "invalid_recommendation",
            "correction_exhausted",
          ].includes(reply.reason))
      ) {
        return [{ text, questions: [] }];
      }
      return [];
    });
    const body = JSON.stringify({
      text,
      history,
      dietary: dietary ?? loadProfile().dietary,
      recommend: true,
    });
    editMessage("");
    await send({ text, body }, turns);
  }

  async function send(turn: Turn, previousTurns: Turn[]) {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(true);
    setProgress("sending");
    setTurns([...previousTurns, { text: turn.text, body: turn.body }]);
    try {
      const response = await fetch("/api/requests/interpret", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
        body: turn.body,
      });
      const reply = await readChatReply<Turn["reply"]>(response, setProgress);
      controller.signal.throwIfAborted();
      setTurns([...previousTurns, { ...turn, reply: recoveryReply(reply) }]);
    } catch (error) {
      if (controller.signal.aborted) {
        setTurns(turn.reply ? [...previousTurns, turn] : previousTurns);
        if (!turn.reply) setText(turn.text);
        setMessage("Response stopped.");
      } else {
        const timedOut =
          (error instanceof ChatResponseError &&
            [408, 504].includes(error.status)) ||
          (error instanceof DOMException && error.name === "TimeoutError");
        const reply = failure(timedOut ? "timeout" : "model_unavailable");
        setTurns([...previousTurns, { ...turn, reply }]);
      }
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
            What sounds good? Add a dining spot, nutrition goal, or dietary
            need.
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
                  {turn.reply.status === "recommendation_failed" ? (
                    <div className="chat-recovery">
                      <p>{recoveryMessages[turn.reply.reason]}</p>
                      {index === turns.length - 1 && (
                        <div className="chat-recovery-actions">
                          {(turn.reply.reason === "timeout" ||
                            turn.reply.reason === "model_unavailable") && (
                            <button
                              type="button"
                              onClick={() => {
                                setMessage("");
                                void send(turn, turns.slice(0, -1));
                              }}
                            >
                              Retry
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              editMessage(turn.text);
                              description.current?.focus();
                            }}
                          >
                            Edit request
                          </button>
                        </div>
                      )}
                    </div>
                  ) : turn.reply.status === "recommended" ? (
                    <div className="meal-review">
                      <p>{turn.reply.explanation}</p>
                      <RecommendationDetails
                        validation={{ valid: true, mealId: turn.reply.meal.id }}
                        menuItems={[turn.reply.meal]}
                      />
                      <MealSelectionAction
                        meal={turn.reply.meal}
                        selected={selectedMealId === turn.reply.meal.id}
                        onSelect={selectMeal}
                        onAlternative={
                          index === turns.length - 1
                            ? (meal) => requestAlternative(turn, index, meal.id)
                            : undefined
                        }
                      />
                    </div>
                  ) : (
                    <RequestReview review={turn.reply} />
                  )}
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
            <p className="chat-pending" role="status">
              <span className="chat-pulse" aria-hidden="true" />
              {
                {
                  sending: "Sending…",
                  thinking: "Thinking…",
                  correcting: "Checking another meal…",
                }[progress]
              }
            </p>
          </div>
        )}
        <div ref={latestMessage} />
      </div>
      <form className="request-form" onSubmit={submit}>
        <p role="status" className="request-message">
          {message}
        </p>
        <label htmlFor="meal-description" className="chat-composer-label">
          Describe your meal
        </label>
        <div className="chat-composer">
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

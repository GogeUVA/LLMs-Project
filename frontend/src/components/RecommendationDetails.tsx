import "./RecommendationDetails.css";

const NOT_AVAILABLE = "Not available";

const NUTRIENTS = [
  { key: "calories_kcal", label: "Calories", unit: "kcal" },
  { key: "total_fat_g", label: "Total fat", unit: "g" },
  { key: "saturated_fat_g", label: "Saturated fat", unit: "g" },
  { key: "trans_fat_g", label: "Trans fat", unit: "g" },
  { key: "cholesterol_mg", label: "Cholesterol", unit: "mg" },
  { key: "sodium_mg", label: "Sodium", unit: "mg" },
  { key: "total_carbohydrate_g", label: "Total carbohydrate", unit: "g" },
  { key: "dietary_fiber_g", label: "Dietary fiber", unit: "g" },
  { key: "total_sugars_g", label: "Total sugars", unit: "g" },
  { key: "added_sugars_g", label: "Added sugars", unit: "g" },
  { key: "protein_g", label: "Protein", unit: "g" },
  { key: "vitamin_d_mcg", label: "Vitamin D", unit: "mcg" },
  { key: "calcium_mg", label: "Calcium", unit: "mg" },
  { key: "iron_mg", label: "Iron", unit: "mg" },
  { key: "potassium_mg", label: "Potassium", unit: "mg" },
] as const;

type NutrientKey = (typeof NUTRIENTS)[number]["key"];

type FieldProvenance =
  | {
      kind: "documented";
      source_name?: string;
      source_url?: string;
      source_page?: number;
      effective_date?: string;
      collected_at?: string;
      source_updated?: string;
    }
  | { kind: "estimated" | "unknown" };

type DetailKey =
  | NutrientKey
  | "price"
  | "price_basis"
  | "serving_size"
  | "ingredients"
  | "allergens";

export type MenuItemRecord = {
  id: string;
  name: string;
  location: string;
  price?: { amount: number; currency: string } | null;
  price_basis?: string | null;
  serving_size?: {
    amount: number;
    unit: string;
    weight_grams?: number;
  } | null;
  nutrition?: Partial<Record<NutrientKey, number>> | null;
  ingredients?: string[] | null;
  allergens?: string[] | null;
  provenance?: Partial<Record<DetailKey, FieldProvenance>>;
};

type RecommendationDetailsProps = {
  validation: { valid: boolean; mealId: string | null };
  menuItems: readonly MenuItemRecord[];
};

function displayText(value: string | null | undefined): string {
  return isAvailableText(value) ? value.trim() : NOT_AVAILABLE;
}

function isAvailableText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function displayNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
    value,
  );
}

function formatPrice(price: MenuItemRecord["price"]): string {
  if (
    !price ||
    !Number.isFinite(price.amount) ||
    price.amount < 0 ||
    !/^[A-Z]{3}$/.test(price.currency)
  ) {
    return NOT_AVAILABLE;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: price.currency,
    }).format(price.amount);
  } catch {
    return NOT_AVAILABLE;
  }
}

function formatServingSize(
  servingSize: MenuItemRecord["serving_size"],
): string {
  if (
    !servingSize ||
    !Number.isFinite(servingSize.amount) ||
    servingSize.amount <= 0 ||
    !isAvailableText(servingSize.unit)
  ) {
    return NOT_AVAILABLE;
  }

  const amount = `${displayNumber(servingSize.amount)} ${servingSize.unit.trim()}`;
  if (
    typeof servingSize.weight_grams === "number" &&
    Number.isFinite(servingSize.weight_grams) &&
    servingSize.weight_grams > 0
  ) {
    return `${amount} (${displayNumber(servingSize.weight_grams)} g)`;
  }

  return amount;
}

function formatNutritionValue(
  nutrition: MenuItemRecord["nutrition"],
  key: NutrientKey,
  unit: string,
): string {
  const value = nutrition?.[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return NOT_AVAILABLE;
  }

  return `${displayNumber(value)} ${unit}`;
}

function formatList(values: string[] | null | undefined): string {
  if (!Array.isArray(values) || values.length === 0) {
    return NOT_AVAILABLE;
  }

  const availableValues = values.filter(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  return availableValues.length > 0
    ? availableValues.map((value) => value.trim()).join(", ")
    : NOT_AVAILABLE;
}

function sourceLink(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

function Detail({
  label,
  value,
  provenance,
}: {
  label: string;
  value: string;
  provenance?: FieldProvenance;
}) {
  const displayedValue = provenance?.kind === "unknown" ? NOT_AVAILABLE : value;
  return (
    <div className="recommendation-detail">
      <dt>{label}</dt>
      <dd>
        <span>{displayedValue}</span>
        {displayedValue !== NOT_AVAILABLE && provenance?.kind === "estimated" && <span className="recommendation-estimate"> · AI estimate</span>}
      </dd>
    </div>
  );
}

export default function RecommendationDetails({
  validation,
  menuItems,
}: RecommendationDetailsProps) {
  if (!validation.valid || !validation.mealId) {
    return null;
  }

  const menuItem = menuItems.find((item) => item.id === validation.mealId);
  if (!menuItem) {
    return null;
  }

  const name = displayText(menuItem.name);

  return (
    <article
      className="recommendation-details"
      aria-label={`Recommendation details for ${name}`}
      data-item-id={menuItem.id}
    >
      <header className="recommendation-details__header">
        <div>
          <p className="recommendation-details__eyebrow">Recommended meal</p>
          <h2>{name}</h2>
        </div>
        <p className="recommendation-details__location">
          <span>Location</span>
          {displayText(menuItem.location)}
        </p>
      </header>

      <dl className="recommendation-details__highlights" aria-label="Nutrition highlights">
        {([
          ["calories_kcal", "Calories", "kcal"],
          ["protein_g", "Protein", "g"],
          ["total_carbohydrate_g", "Carbs", "g"],
        ] as const).map(([key, label, unit]) => {
          const value = formatNutritionValue(menuItem.nutrition, key, unit);
          return value === NOT_AVAILABLE ? null : (
            <div className="recommendation-details__highlight" key={key}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          );
        })}
      </dl>
      <section aria-label="Meal details">
        <dl className="recommendation-details__facts">
          {formatServingSize(menuItem.serving_size) !== NOT_AVAILABLE && (
            <Detail label="Serving size" value={formatServingSize(menuItem.serving_size)} provenance={menuItem.provenance?.serving_size} />
          )}
          {formatList(menuItem.ingredients) !== NOT_AVAILABLE && (
            <Detail label="Ingredients" value={formatList(menuItem.ingredients)} provenance={menuItem.provenance?.ingredients} />
          )}
          {formatList(menuItem.allergens) !== NOT_AVAILABLE && (
            <Detail label="Allergens" value={formatList(menuItem.allergens)} provenance={menuItem.provenance?.allergens} />
          )}
        </dl>
      </section>

      <details className="recommendation-details__nutrition"
        aria-labelledby="recommendation-nutrition-title"
      >
        <summary id="recommendation-nutrition-title">Full nutrition information</summary>
        <dl className="recommendation-details__grid">
          {NUTRIENTS.map(({ key, label, unit }) => {
            const value = formatNutritionValue(menuItem.nutrition, key, unit);
            return value === NOT_AVAILABLE ? null : (
              <Detail key={key} label={label} value={value} provenance={menuItem.provenance?.[key]} />
            );
          })}
        </dl>
      </details>

      <section className="recommendation-details__sources" aria-label="Nutrition sources">
        {(() => {
          const entries = Object.values(menuItem.provenance ?? {}).filter(
            (source): source is Extract<FieldProvenance, { kind: "documented" }> => source?.kind === "documented",
          );
          const unique = Array.from(new Map(entries.map((source) => [
            JSON.stringify([source.source_url, source.source_name, source.source_page, source.source_updated, source.effective_date, source.collected_at]), source,
          ])).values());
          if (!unique.length) return null;
          return (
            <>
              <h3>Sources</h3>
              <ul>{unique.map((source, index) => {
                const href = sourceLink(source.source_url);
                const meta = [
                  source.source_page == null ? null : "Page " + source.source_page,
                  source.source_updated ? "Updated " + source.source_updated : null,
                  source.effective_date ? "Effective " + source.effective_date : null,
                  source.collected_at ? "Collected " + source.collected_at : null,
                ].filter(Boolean);
                return <li key={index}>
                  {href ? <a href={href} target="_blank" rel="noopener noreferrer">{source.source_name || "Nutrition source"}</a> : (source.source_name || "Nutrition source")}
                  {meta.length > 0 && <span className="recommendation-details__source-meta">{meta.join(" · ")}</span>}
                </li>;
              })}</ul>
            </>
          );
        })()}
      </section>
    </article>
  );
}

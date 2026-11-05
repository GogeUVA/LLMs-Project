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

function hasUnknownDetails(menuItem: MenuItemRecord): boolean {
  const hasIdentity =
    isAvailableText(menuItem.id) && isAvailableText(menuItem.name);
  const hasLocation = isAvailableText(menuItem.location);
  const hasPrice = formatPrice(menuItem.price) !== NOT_AVAILABLE;
  const hasPriceBasis = displayText(menuItem.price_basis) !== NOT_AVAILABLE;
  const hasServingSize =
    formatServingSize(menuItem.serving_size) !== NOT_AVAILABLE;
  const hasIngredients = formatList(menuItem.ingredients) !== NOT_AVAILABLE;
  const hasAllergens = formatList(menuItem.allergens) !== NOT_AVAILABLE;
  const hasAllNutrition = NUTRIENTS.every(
    ({ key, unit }) =>
      formatNutritionValue(menuItem.nutrition, key, unit) !== NOT_AVAILABLE,
  );

  return !(
    hasPrice &&
    hasPriceBasis &&
    hasServingSize &&
    hasIdentity &&
    hasLocation &&
    hasIngredients &&
    hasAllergens &&
    hasAllNutrition
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="recommendation-detail">
      <dt>{label}</dt>
      <dd>{value}</dd>
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

      <section aria-label="Meal details">
        <dl className="recommendation-details__grid">
          <Detail label="Price" value={formatPrice(menuItem.price)} />
          <Detail
            label="Price basis"
            value={displayText(menuItem.price_basis)}
          />
          <Detail
            label="Serving size"
            value={formatServingSize(menuItem.serving_size)}
          />
          <Detail
            label="Ingredients"
            value={formatList(menuItem.ingredients)}
          />
          <Detail label="Allergens" value={formatList(menuItem.allergens)} />
        </dl>
      </section>

      <section
        className="recommendation-details__nutrition"
        aria-labelledby="recommendation-nutrition-title"
      >
        <h3 id="recommendation-nutrition-title">Nutrition information</h3>
        <dl className="recommendation-details__grid">
          {NUTRIENTS.map(({ key, label, unit }) => (
            <Detail
              key={key}
              label={label}
              value={formatNutritionValue(menuItem.nutrition, key, unit)}
            />
          ))}
        </dl>
      </section>

      {hasUnknownDetails(menuItem) && (
        <p className="recommendation-details__unknown-note" role="note">
          Unknown information cannot confirm that a meal meets a hard
          constraint.
        </p>
      )}
    </article>
  );
}

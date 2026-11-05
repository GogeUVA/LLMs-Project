import { useState } from "react";

export interface DietaryDraft {
  allergies: string[];
  restrictions: string[];
  preferences: string[];
  dislikes: string[];
}

interface Props {
  value: DietaryDraft;
  onChange: (value: DietaryDraft) => void;
}

const sections = [
  {
    key: "allergies",
    title: "Food allergies",
    options: [
      ["peanut", "Peanuts"],
      ["tree nuts", "Tree nuts"],
      ["milk", "Milk"],
      ["egg", "Eggs"],
      ["wheat", "Wheat"],
      ["soy", "Soy"],
      ["fish", "Fish"],
      ["shellfish", "Shellfish"],
      ["sesame", "Sesame"],
    ],
    addLabel: "Add another allergy",
    inputLabel: "Another allergy",
    buttonLabel: "Add allergy",
  },
  {
    key: "restrictions",
    title: "Dietary requirements",
    options: [
      ["vegetarian", "Vegetarian"],
      ["vegan", "Vegan"],
      ["gluten-free", "Gluten-free"],
      ["halal", "Halal"],
      ["kosher", "Kosher"],
    ],
    addLabel: "Add another requirement",
    inputLabel: "Another requirement",
    buttonLabel: "Add requirement",
  },
] as const;

type Section = (typeof sections)[number];

function displayLabel(section: Section, id: string) {
  return (
    section.options.find(([key]) => key === id)?.[1] ??
    id.charAt(0).toUpperCase() + id.slice(1)
  );
}

function ChoiceGroup({
  section,
  selected,
  onChange,
}: {
  section: Section;
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [custom, setCustom] = useState("");
  const customOptions = selected.filter(
    (id) => !section.options.some(([key]) => key === id),
  );

  function addCustom() {
    const text = custom.trim().toLowerCase().replace(/\s+/g, " ");
    if (!text) return;
    const id =
      section.options.find(
        ([key, label]) => key === text || label.toLowerCase() === text,
      )?.[0] ?? text;
    if (!selected.includes(id)) onChange([...selected, id]);
    setCustom("");
  }

  return (
    <fieldset className="choice-group">
      <legend>{section.title}</legend>
      <div className="choices">
        {[...section.options.map(([id]) => id), ...customOptions].map((id) => (
          <label className="choice" key={id}>
            <input
              type="checkbox"
              checked={selected.includes(id)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, id]
                    : selected.filter((item) => item !== id),
                )
              }
            />
            {displayLabel(section, id)}
          </label>
        ))}
      </div>
      {customOptions.length > 0 && (
        <p className="evidence-note" role="status">
          Unlisted requirements need menu evidence.
        </p>
      )}
      <details className="add-option">
        <summary>{section.addLabel}</summary>
        <div className="add-row">
          <label>
            <span>{section.inputLabel}</span>
            <input
              type="text"
              value={custom}
              maxLength={80}
              onChange={(event) => setCustom(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustom();
                }
              }}
            />
          </label>
          <button type="button" disabled={!custom.trim()} onClick={addCustom}>
            {section.buttonLabel}
          </button>
        </div>
      </details>
    </fieldset>
  );
}

export default function DietaryFields({ value, onChange }: Props) {
  return (
    <div className="dietary-editor">
      {sections.map((section) => (
        <ChoiceGroup
          key={section.key}
          section={section}
          selected={value[section.key]}
          onChange={(values) => onChange({ ...value, [section.key]: values })}
        />
      ))}
    </div>
  );
}

"""Match student-typed dining location names to locations listed in the menu."""

import re
from collections.abc import Iterable
from difflib import SequenceMatcher

# A one- or two-character typo in a typical dining location name scores above
# this ratio, while partial names such as "Halal" for "Halal Shack" do not.
TYPO_SIMILARITY = 0.85


def location_label(value: object) -> str:
    """Return a comparison label ignoring case, punctuation, spacing and a leading "the"."""
    if not isinstance(value, str):
        return ""
    words = re.sub(r"[\W_]+", " ", value.casefold()).split()
    if words[:1] == ["the"]:
        words = words[1:]
    return " ".join(words)


def resolve_location(requested: str, menu_locations: Iterable[object]) -> str | None:
    """Return the menu location the student most likely meant, or None.

    A typo resolves only when exactly one menu location is a close match, so the
    student is never silently sent to a different dining location.
    """
    wanted = location_label(requested)
    if not wanted:
        return None
    canonical = {
        location_label(name): name for name in menu_locations if location_label(name)
    }
    if wanted in canonical:
        return canonical[wanted]
    close = [
        name
        for label, name in canonical.items()
        if SequenceMatcher(None, wanted, label).ratio() >= TYPO_SIMILARITY
    ]
    return close[0] if len(close) == 1 else None

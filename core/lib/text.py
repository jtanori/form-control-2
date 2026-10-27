"""Text normalization shared by the NLU matcher (CORE-001) and the context
normalizer (CORE-004).

Both layers MUST agree on what a "label" looks like, otherwise a label the
parser reads from the transcript never matches the label a bridge extracted.
"""

from __future__ import annotations

import re
import unicodedata

_WS = re.compile(r"\s+")
_LEADING = " \t\n\r*•·–—-—:;,.!?|/\\()[]{}<>\"'`~^+=_"
_TRAILING = " \t\n\r*•·–—-—:;,.!?|/\\()[]{}<>\"'`~^+=_"
_NON_LABEL_CHARS = re.compile(r"[\u200b-\u200d\ufeff\xa0]")
_CAMEL = re.compile(r"(?<=[a-z0-9])(?=[A-Z])")
_SPLIT = re.compile(r"[\s_\-/]+")


def normalize_text(value: str | None) -> str:
    """NFKC + whitespace collapse + trim. Keeps case and punctuation."""
    if value is None:
        return ""
    text = unicodedata.normalize("NFKC", str(value))
    text = _NON_LABEL_CHARS.sub(" ", text)
    return _WS.sub(" ", text).strip()


def strip_decorative(value: str) -> str:
    """Drop the `*`, `:`, brackets and similar noise around a label."""
    text = value
    while text and text[0] in _LEADING:
        text = text[1:]
    while text and text[-1] in _TRAILING:
        text = text[:-1]
    return text


def normalize_label(value: str | None) -> str:
    """Contract label form: lowercase, trimmed, collapsed, decorative chars gone."""
    return strip_decorative(normalize_text(value)).lower()


def tokens(value: str | None) -> set[str]:
    """Token set for fuzzy matching; splits camelCase and separators."""
    text = normalize_text(value)
    text = _CAMEL.sub(" ", text)
    text = strip_decorative(text).lower()
    return {tok for tok in _SPLIT.split(text) if tok}


def contains_value(transcript: str, value: str) -> bool:
    """True when `value` literally occurs in the transcript (never inventing data)."""
    haystack = normalize_text(transcript).lower()
    needle = normalize_text(value).lower()
    return bool(needle) and needle in haystack

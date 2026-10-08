"""Persistent storage for Prompt Library entries.

Layout (inside the plugin folder, never shipped in the zip / gitignored):
  library.json

Schema:
  {
    "version": 1,
    "prompts": [
      {
        "id": "uuidhex",
        "title": "Cinematic rain",
        "text": "A woman walks through a rainy neon street...",
        "tags": ["cinematic", "rain", "neon"],
        "category": "scenes",          # optional collection/category
        "created": 1696...,
        "updated": 1696...,
        "use_count": 0,
        "last_used": null
      },
      ...
    ]
  }
"""
from __future__ import annotations

import json
import os
import re
import tempfile
import threading
import time
import unicodedata
import uuid
from typing import Any, Dict, List, Optional, Tuple

PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
LIBRARY_PATH = os.path.join(PLUGIN_DIR, "library.json")
LIBRARY_VERSION = 1

_ID_RE = re.compile(r"^[0-9a-f]{8,64}$")
_BAD_CHARS = re.compile(r'[\\/:*?"<>|\x00-\x1f]+')
_TAG_SPLIT = re.compile(r"[,;\n]+")
_WORD_SPLIT = re.compile(r"\s+")
_VAR_RE = re.compile(r"\{([A-Za-z_][A-Za-z0-9_]*)\}")
_lock = threading.RLock()

# Example prompts shipped the first time the library is created. Clearly labeled so the user can delete them.
EXAMPLE_PROMPTS = [
    {
        "title": "[Example] Cinematic neon rain",
        "text": "A woman walks slowly through a rainy neon street at night, camera gently orbiting, reflections shimmering on the wet pavement, natural motion, realistic lighting.",
        "tags": ["example", "cinematic", "rain", "neon"],
        "category": "examples",
    },
    {
        "title": "[Example] Soft portrait",
        "text": "Close-up portrait of {subject}, soft window light, shallow depth of field, natural skin texture, gentle smile, photorealistic.",
        "tags": ["example", "portrait", "soft"],
        "category": "examples",
    },
    {
        "title": "[Example] Product spin",
        "text": "Studio product shot of {product} on a clean seamless background, slow 360 degree turntable rotation, soft rim light, commercial look.",
        "tags": ["example", "product", "studio"],
        "category": "examples",
    },
]


class StorageError(Exception):
    """User-facing storage error (safe to show)."""


def _fold(text: str) -> str:
    """Lowercase + strip accents (canción -> cancion) for Spanish-friendly search."""
    if not text:
        return ""
    norm = unicodedata.normalize("NFD", str(text))
    return "".join(ch for ch in norm if unicodedata.category(ch) != "Mn").lower()


def _safe_title(name: str, fallback: str = "Untitled") -> str:
    text = _BAD_CHARS.sub(" ", str(name or "")).strip(" ._")
    text = re.sub(r"\s+", " ", text)
    return (text or fallback)[:160]


def _normalize_tags(tags) -> List[str]:
    if tags is None:
        return []
    if isinstance(tags, str):
        parts = _TAG_SPLIT.split(tags)
    elif isinstance(tags, (list, tuple)):
        parts = []
        for item in tags:
            parts.extend(_TAG_SPLIT.split(str(item)))
    else:
        parts = [str(tags)]
    out, seen = [], set()
    for part in parts:
        tag = re.sub(r"\s+", " ", part.strip().strip("#"))
        if not tag:
            continue
        key = _fold(tag)
        if key in seen:
            continue
        seen.add(key)
        out.append(tag[:64])
    return out[:40]


def _normalize_category(category: Optional[str]) -> str:
    text = _BAD_CHARS.sub(" ", str(category or "")).strip(" ._")
    text = re.sub(r"\s+", " ", text)
    return text[:80]


def _check_id(prompt_id: str) -> str:
    pid = str(prompt_id or "").strip().lower()
    if not _ID_RE.match(pid):
        raise StorageError("invalid prompt id")
    return pid


def _now() -> float:
    return time.time()


def _atomic_write_json(path: str, data: Any) -> None:
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".library_", suffix=".tmp", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as writer:
            json.dump(data, writer, indent=2, ensure_ascii=False)
            writer.write("\n")
            writer.flush()
            os.fsync(writer.fileno())
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def _empty_library() -> Dict[str, Any]:
    return {"version": LIBRARY_VERSION, "prompts": []}


def _coerce_prompt(raw: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(raw, dict):
        return None
    try:
        pid = _check_id(raw.get("id") or uuid.uuid4().hex)
    except StorageError:
        pid = uuid.uuid4().hex
    title = _safe_title(raw.get("title") or "", fallback="")
    text = str(raw.get("text") or "")
    if not title and not text.strip():
        return None
    if not title:
        title = _safe_title(text.split("\n", 1)[0][:60] or "Untitled")
    created = raw.get("created")
    updated = raw.get("updated")
    try:
        created = float(created) if created is not None else _now()
    except (TypeError, ValueError):
        created = _now()
    try:
        updated = float(updated) if updated is not None else created
    except (TypeError, ValueError):
        updated = created
    use_count = raw.get("use_count", 0)
    try:
        use_count = max(0, int(use_count))
    except (TypeError, ValueError):
        use_count = 0
    last_used = raw.get("last_used")
    try:
        last_used = float(last_used) if last_used is not None else None
    except (TypeError, ValueError):
        last_used = None
    return {
        "id": pid,
        "title": title,
        "text": text,
        "tags": _normalize_tags(raw.get("tags")),
        "category": _normalize_category(raw.get("category")),
        "created": created,
        "updated": updated,
        "use_count": use_count,
        "last_used": last_used,
    }


def _seed_examples() -> List[Dict[str, Any]]:
    now = _now()
    out = []
    for i, ex in enumerate(EXAMPLE_PROMPTS):
        out.append({
            "id": uuid.uuid4().hex,
            "title": ex["title"],
            "text": ex["text"],
            "tags": list(ex["tags"]),
            "category": ex.get("category", "examples"),
            "created": now + i * 0.001,
            "updated": now + i * 0.001,
            "use_count": 0,
            "last_used": None,
        })
    return out


def load_library(path: Optional[str] = None) -> Dict[str, Any]:
    path = path or LIBRARY_PATH
    with _lock:
        try:
            with open(path, "r", encoding="utf-8") as reader:
                data = json.load(reader)
        except FileNotFoundError:
            lib = _empty_library()
            lib["prompts"] = _seed_examples()
            _atomic_write_json(path, lib)
            return lib
        except Exception as e:
            print(f"[Prompt Library] Ignoring invalid library.json: {e}")
            return _empty_library()
        if not isinstance(data, dict):
            return _empty_library()
        prompts = []
        seen = set()
        for raw in data.get("prompts") or []:
            item = _coerce_prompt(raw)
            if not item or item["id"] in seen:
                continue
            seen.add(item["id"])
            prompts.append(item)
        return {"version": LIBRARY_VERSION, "prompts": prompts}


def save_library(lib: Dict[str, Any], path: Optional[str] = None) -> None:
    path = path or LIBRARY_PATH
    payload = {
        "version": LIBRARY_VERSION,
        "prompts": [p for p in (lib.get("prompts") or []) if isinstance(p, dict)],
    }
    with _lock:
        _atomic_write_json(path, payload)


def list_prompts(path: Optional[str] = None) -> List[Dict[str, Any]]:
    return list(load_library(path)["prompts"])


def get_prompt(prompt_id: str, path: Optional[str] = None) -> Dict[str, Any]:
    pid = _check_id(prompt_id)
    for item in list_prompts(path):
        if item["id"] == pid:
            return item
    raise StorageError("prompt not found")


def create_prompt(
    title: str,
    text: str,
    tags=None,
    category: str = "",
    path: Optional[str] = None,
) -> Dict[str, Any]:
    title = _safe_title(title, fallback="")
    text = str(text or "")
    if not title and not text.strip():
        raise StorageError("title or text required")
    if not title:
        title = _safe_title(text.split("\n", 1)[0][:60] or "Untitled")
    now = _now()
    item = {
        "id": uuid.uuid4().hex,
        "title": title,
        "text": text,
        "tags": _normalize_tags(tags),
        "category": _normalize_category(category),
        "created": now,
        "updated": now,
        "use_count": 0,
        "last_used": None,
    }
    with _lock:
        lib = load_library(path)
        lib["prompts"].append(item)
        save_library(lib, path)
    return item


def update_prompt(
    prompt_id: str,
    *,
    title: Optional[str] = None,
    text: Optional[str] = None,
    tags=None,
    category: Optional[str] = None,
    path: Optional[str] = None,
) -> Dict[str, Any]:
    pid = _check_id(prompt_id)
    with _lock:
        lib = load_library(path)
        for i, item in enumerate(lib["prompts"]):
            if item["id"] != pid:
                continue
            if title is not None:
                item["title"] = _safe_title(title, fallback=item["title"])
            if text is not None:
                item["text"] = str(text)
            if tags is not None:
                item["tags"] = _normalize_tags(tags)
            if category is not None:
                item["category"] = _normalize_category(category)
            item["updated"] = _now()
            lib["prompts"][i] = item
            save_library(lib, path)
            return item
    raise StorageError("prompt not found")


def duplicate_prompt(prompt_id: str, path: Optional[str] = None) -> Dict[str, Any]:
    src = get_prompt(prompt_id, path)
    return create_prompt(
        title=src["title"] + " (copy)",
        text=src["text"],
        tags=list(src.get("tags") or []),
        category=src.get("category") or "",
        path=path,
    )


def delete_prompt(prompt_id: str, path: Optional[str] = None) -> Dict[str, Any]:
    pid = _check_id(prompt_id)
    with _lock:
        lib = load_library(path)
        for i, item in enumerate(lib["prompts"]):
            if item["id"] == pid:
                removed = lib["prompts"].pop(i)
                save_library(lib, path)
                return removed
    raise StorageError("prompt not found")


def mark_used(prompt_id: str, path: Optional[str] = None) -> Dict[str, Any]:
    pid = _check_id(prompt_id)
    with _lock:
        lib = load_library(path)
        for i, item in enumerate(lib["prompts"]):
            if item["id"] != pid:
                continue
            item["use_count"] = int(item.get("use_count") or 0) + 1
            item["last_used"] = _now()
            item["updated"] = item["updated"]  # keep content timestamp
            lib["prompts"][i] = item
            save_library(lib, path)
            return item
    raise StorageError("prompt not found")


def export_json(path: Optional[str] = None) -> str:
    return json.dumps(load_library(path), indent=2, ensure_ascii=False) + "\n"


def export_plain_text(path: Optional[str] = None) -> str:
    blocks = []
    for item in list_prompts(path):
        tags = ", ".join(item.get("tags") or [])
        header = f"# {item['title']}"
        if tags:
            header += f"\n# tags: {tags}"
        if item.get("category"):
            header += f"\n# category: {item['category']}"
        blocks.append(header + "\n" + (item.get("text") or "").rstrip() + "\n")
    return "\n---\n\n".join(blocks)


def import_json(raw: str, path: Optional[str] = None, replace: bool = False) -> Tuple[int, int]:
    """Import prompts from a JSON string. Returns (added, skipped)."""
    try:
        data = json.loads(raw)
    except Exception as e:
        raise StorageError(f"invalid JSON: {e}") from e
    if isinstance(data, dict) and "prompts" in data:
        items = data.get("prompts") or []
    elif isinstance(data, list):
        items = data
    elif isinstance(data, dict) and ("title" in data or "text" in data):
        items = [data]
    else:
        raise StorageError("JSON must be a list of prompts or a library object")
    added = skipped = 0
    with _lock:
        lib = _empty_library() if replace else load_library(path)
        existing_ids = {p["id"] for p in lib["prompts"]}
        existing_keys = {(_fold(p["title"]), _fold(p["text"])) for p in lib["prompts"]}
        for raw_item in items:
            item = _coerce_prompt(raw_item)
            if not item:
                skipped += 1
                continue
            if item["id"] in existing_ids or (_fold(item["title"]), _fold(item["text"])) in existing_keys:
                # new id to avoid collision when same content is re-imported intentionally as new
                if item["id"] in existing_ids:
                    item["id"] = uuid.uuid4().hex
                if (_fold(item["title"]), _fold(item["text"])) in existing_keys and not replace:
                    skipped += 1
                    continue
            existing_ids.add(item["id"])
            existing_keys.add((_fold(item["title"]), _fold(item["text"])))
            lib["prompts"].append(item)
            added += 1
        save_library(lib, path)
    return added, skipped


def import_plain_text(raw: str, path: Optional[str] = None) -> Tuple[int, int]:
    """Import prompts separated by a line with only ---."""
    text = str(raw or "").strip()
    if not text:
        return 0, 0
    chunks = re.split(r"\n\s*---\s*\n", text)
    added = skipped = 0
    for chunk in chunks:
        lines = chunk.strip().splitlines()
        if not lines:
            skipped += 1
            continue
        title = ""
        tags = []
        category = ""
        body_lines = []
        for line in lines:
            if line.startswith("# tags:"):
                tags = _normalize_tags(line[7:])
            elif line.startswith("# category:"):
                category = _normalize_category(line[11:])
            elif line.startswith("# ") and not title:
                title = line[2:].strip()
            else:
                body_lines.append(line)
        body = "\n".join(body_lines).strip()
        if not title and not body:
            skipped += 1
            continue
        try:
            create_prompt(title or body.split("\n", 1)[0][:60], body, tags=tags, category=category, path=path)
            added += 1
        except StorageError:
            skipped += 1
    return added, skipped


def find_variables(text: str) -> List[str]:
    seen, out = set(), []
    for match in _VAR_RE.finditer(str(text or "")):
        name = match.group(1)
        if name not in seen:
            seen.add(name)
            out.append(name)
    return out


def apply_variables(text: str, values: Dict[str, str]) -> str:
    def repl(match):
        name = match.group(1)
        if name in values and values[name] is not None:
            return str(values[name])
        return match.group(0)
    return _VAR_RE.sub(repl, str(text or ""))


def _haystacks(item: Dict[str, Any]) -> Tuple[str, str, str]:
    title = _fold(item.get("title") or "")
    tags = _fold(" ".join(item.get("tags") or []))
    body = _fold(item.get("text") or "")
    category = _fold(item.get("category") or "")
    return title, (tags + " " + category).strip(), body


def search_prompts(
    query: str,
    prompts: Optional[List[Dict[str, Any]]] = None,
    path: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """AND multi-word search. Ranks title > tags > body, then recent/frequent use."""
    items = prompts if prompts is not None else list_prompts(path)
    words = [w for w in _WORD_SPLIT.split(_fold(query)) if w]
    scored: List[Tuple[Tuple, Dict[str, Any]]] = []
    for item in items:
        title, tags, body = _haystacks(item)
        all_text = f"{title} {tags} {body}"
        if words and not all(w in all_text for w in words):
            continue
        title_hits = sum(1 for w in words if w in title) if words else 0
        tag_hits = sum(1 for w in words if w in tags) if words else 0
        body_hits = sum(1 for w in words if w in body) if words else 0
        # empty query: browse by recent/frequent
        rank = (
            -title_hits * 100 - tag_hits * 40 - body_hits * 10,
            -(item.get("last_used") or 0),
            -(item.get("use_count") or 0),
            -(item.get("updated") or 0),
            _fold(item.get("title") or ""),
        )
        scored.append((rank, item))
    scored.sort(key=lambda x: x[0])
    return [item for _, item in scored[: max(1, min(500, int(limit or 50)))]]


def snippet_for(item: Dict[str, Any], query: str, max_len: int = 120) -> str:
    """Short snippet with a crude highlight marker around the first matching word."""
    text = str(item.get("text") or "").replace("\n", " ").strip()
    if not text:
        return ""
    words = [w for w in _WORD_SPLIT.split(_fold(query)) if w]
    folded = _fold(text)
    idx = -1
    hit = ""
    for w in words:
        pos = folded.find(w)
        if pos >= 0 and (idx < 0 or pos < idx):
            idx, hit = pos, w
    if idx < 0:
        return text[:max_len] + ("…" if len(text) > max_len else "")
    start = max(0, idx - 30)
    end = min(len(text), idx + len(hit) + max_len - 40)
    chunk = text[start:end]
    # highlight using original-case approximate slice
    approx = text[idx: idx + len(hit)]
    chunk = chunk.replace(approx, f"⟦{approx}⟧", 1)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    return prefix + chunk + suffix


def client_payload(path: Optional[str] = None) -> List[Dict[str, Any]]:
    """Compact list for the browser cache (search runs client-side)."""
    out = []
    for item in list_prompts(path):
        out.append({
            "id": item["id"],
            "title": item["title"],
            "text": item["text"],
            "tags": list(item.get("tags") or []),
            "category": item.get("category") or "",
            "use_count": int(item.get("use_count") or 0),
            "last_used": item.get("last_used"),
            "updated": item.get("updated"),
            "vars": find_variables(item.get("text") or ""),
        })
    return out

"""Prompt Library - reusable text prompt templates for WanGP.

Autocomplete search next to WanGP's prompt textbox (and the queue Edit tab), plus a
manager tab to create / edit / duplicate / delete / import / export prompts.

How it works
  * ``prompt_library.js`` (injected with ``add_custom_js``) mounts a search box next to
    the visible prompt field, searches a cached copy of the library client-side, and
    asks the server through a hidden bridge to write the chosen text into WanGP's own
    ``prompt`` / ``wizard_prompt`` Gradio components so generation reads the new value.
  * Prompts live in ``library.json`` inside the plugin folder (atomic writes, gitignored).
  * Settings live in ``settings.json`` (same pattern as Dragger).
  * Bilingual EN/ES: TEXT table below + I18N in the JS. Setting ``language``: auto / en / es.
  * Reference Library link (1.1.0): each prompt has ``collections: [cid, ...]`` (this plugin is the single source of
    truth). Python API for other plugins: ``sys.modules["wan2gp_prompt_library_api"]`` (API_VERSION 1). Reference
    Library is consumed lazily through ``sys.modules["wan2gp_reference_library_api"]``; when it is missing (or a
    API_VERSION < 1) every collection control is hidden and the plugin works as before.
"""
from __future__ import annotations

import copy
import html
import json
import math
import os
import sys
import threading
import time
import traceback

import gradio as gr

from shared.utils.plugins import WAN2GPPlugin

from . import storage

PLUGIN_VERSION = "1.2.0"
_PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
SETTINGS_PATH = os.path.join(_PLUGIN_DIR, "settings.json")

TAB_IDS = ("generate", "edit")
PROMPT_FIELDS = ("prompt", "wizard_prompt")
LANGS = ("en", "es")

TEXT = {
    "en": {
        "intro": "Save reusable **prompt templates**, find them with autocomplete next to WanGP's prompt box "
                 "(type one or more words; accent-insensitive), and insert them with replace or append. "
                 "With Reference Library 1.1+ installed, a prompt can be linked to its image **collections** (and vice versa). "
                 "Manage the library on the left, settings on the right. Data is stored in `library.json` in the plugin folder and survives updates.",
        "language": "Language / Idioma",
        "language_info": "Auto = the browser language (Spanish if it is Spanish, English otherwise). Applies immediately.",
        "lang_auto": "Auto (browser language)",
        "sec_search": "### Autocomplete",
        "sec_insert": "### Insert",
        "sec_messages": "### Messages",
        "sec_manager": "### Prompt manager",
        "enabled": "Show search box next to the prompt",
        "enabled_info": "A compact search field under WanGP's main prompt (and in the queue Edit tab).",
        "show_edit": "Also show it in the queue Edit tab",
        "insert_mode": "How to insert a selected prompt",
        "mode_replace": "Replace the current prompt",
        "mode_append": "Append after the current prompt",
        "mode_cursor": "Insert at cursor (best effort in the browser)",
        "undo": "Offer “Undo” after inserting",
        "toasts": "Confirmation messages",
        "toasts_info": "Errors are always shown.",
        "toast_s": "Duration (seconds)",
        "save_btn_near": "“Save” / “Save as…” buttons in the bar",
        "save": "Save settings",
        "saved": "✅ Settings saved and applied ({time}).",
        "save_failed": "❌ Could not save `settings.json`: {error}",
        "mgr_search": "Filter",
        "mgr_title": "Title",
        "mgr_text": "Prompt text",
        "mgr_tags": "Tags (comma-separated)",
        "mgr_category": "Category",
        "mgr_list": "Prompts",
        "mgr_new": "New",
        "mgr_save": "Save prompt",
        "mgr_dup": "Duplicate",
        "mgr_del": "Delete",
        "mgr_refresh": "Refresh",
        "mgr_import": "Import JSON / text",
        "mgr_export_json": "Export JSON",
        "mgr_export_txt": "Export text",
        "mgr_confirm_del": "Type DELETE to confirm",
        "mgr_io": "Import / export (paste JSON or text blocks separated by ---, then Import)",
        "created": "✅ Prompt “{title}” saved.",
        "updated": "✅ Prompt “{title}” updated.",
        "duplicated": "✅ Duplicated as “{title}”.",
        "deleted": "✅ Prompt deleted.",
        "need_title_or_text": "Enter a title or some prompt text.",
        "need_select": "Select a prompt in the list first.",
        "need_confirm": "Type DELETE in the confirmation box to delete.",
        "not_found": "Prompt not found (it may have been deleted).",
        "imported": "✅ Imported {n} prompt(s) ({skipped} skipped).",
        "exported": "✅ Export ready.",
        "empty_import": "Nothing to import.",
        "bad_request": "invalid request",
        "unknown_action": "unknown action",
        "no_prompt": "prompt component not ready",
        "inserted": "Prompt “{title}” inserted",
        "appended": "Prompt “{title}” appended",
        "saved_current": "✅ Current prompt saved as “{title}”.",
        "saved_over": "Prompt “{title}” updated",
        "saved_as": "Saved as new prompt “{title}”",
        "meta_saved": "“{title}” updated",
        "save_undone": "Change undone",
        "bar_title": "Prompt Library",
        "bar_search_ph": "Search prompts…",
        "bar_save": "Save",
        "bar_save_as": "Save as…",
        "bar_manage": "Manage",
        "undone": "Previous prompt restored",
        "mgr_collections": "Collections",
        "mgr_collections_info": "Reference Library collections linked to this prompt. The link works both ways: the collection also lists this prompt.",
        "sec_reflib": "### Reference Library",
        "on_pick_collection": "When I pick a prompt that has collections",
        "pick_none": "Do nothing",
        "pick_offer": "Offer to load its collection",
        "pick_auto": "Load the first collection automatically",
        "on_reflib_applied": "When a collection is loaded in Reference Library",
        "applied_none": "Do nothing here (Reference Library already offers its prompts)",
        "applied_offer": "Also offer its linked prompts here",
    },
    "es": {
        "intro": "Guarda **plantillas de prompt** reutilizables, encuéntralas con autocompletado junto al cuadro de prompt de WanGP "
                 "(escribe una o varias palabras; sin distinguir acentos) e insértalas reemplazando o añadiendo. "
                 "Con Reference Library 1.1+ instalado, puedes asociar un prompt a sus **colecciones** de imágenes (y al revés). "
                 "Gestiona la librería a la izquierda y los ajustes a la derecha. Los datos están en `library.json` de la carpeta del plugin y sobreviven a las actualizaciones.",
        "language": "Language / Idioma",
        "language_info": "Auto = el idioma del navegador (español si está en español; si no, inglés). Se aplica al momento.",
        "lang_auto": "Auto (idioma del navegador)",
        "sec_search": "### Autocompletado",
        "sec_insert": "### Inserción",
        "sec_messages": "### Avisos",
        "sec_manager": "### Gestor de prompts",
        "enabled": "Mostrar el cuadro de búsqueda junto al prompt",
        "enabled_info": "Un campo compacto bajo el prompt principal de WanGP (y en la pestaña Editar de la cola).",
        "show_edit": "Mostrarlo también en la pestaña Editar de la cola",
        "insert_mode": "Cómo insertar el prompt elegido",
        "mode_replace": "Reemplazar el prompt actual",
        "mode_append": "Añadir al final del prompt actual",
        "mode_cursor": "Insertar en el cursor (mejor esfuerzo en el navegador)",
        "undo": "Ofrecer «Deshacer» tras insertar",
        "toasts": "Mensajes de confirmación",
        "toasts_info": "Los errores se muestran siempre.",
        "toast_s": "Duración (segundos)",
        "save_btn_near": "Botones «Guardar» / «Guardar como…» en la barra",
        "save": "Guardar ajustes",
        "saved": "✅ Ajustes guardados y aplicados ({time}).",
        "save_failed": "❌ No se pudo guardar `settings.json`: {error}",
        "mgr_search": "Filtrar",
        "mgr_title": "Título",
        "mgr_text": "Texto del prompt",
        "mgr_tags": "Etiquetas (separadas por comas)",
        "mgr_category": "Categoría",
        "mgr_list": "Prompts",
        "mgr_new": "Nuevo",
        "mgr_save": "Guardar prompt",
        "mgr_dup": "Duplicar",
        "mgr_del": "Eliminar",
        "mgr_refresh": "Actualizar",
        "mgr_import": "Importar JSON / texto",
        "mgr_export_json": "Exportar JSON",
        "mgr_export_txt": "Exportar texto",
        "mgr_confirm_del": "Escribe DELETE para confirmar",
        "mgr_io": "Importar / exportar (pega JSON o bloques de texto separados por ---, luego Importar)",
        "created": "✅ Prompt «{title}» guardado.",
        "updated": "✅ Prompt «{title}» actualizado.",
        "duplicated": "✅ Duplicado como «{title}».",
        "deleted": "✅ Prompt eliminado.",
        "need_title_or_text": "Escribe un título o el texto del prompt.",
        "need_select": "Selecciona antes un prompt de la lista.",
        "need_confirm": "Escribe DELETE en el cuadro de confirmación para eliminar.",
        "not_found": "Prompt no encontrado (puede que se haya borrado).",
        "imported": "✅ Importados {n} prompt(s) ({skipped} omitidos).",
        "exported": "✅ Exportación lista.",
        "empty_import": "No hay nada que importar.",
        "bad_request": "petición no válida",
        "unknown_action": "acción desconocida",
        "no_prompt": "el componente de prompt no está listo",
        "inserted": "Prompt «{title}» insertado",
        "appended": "Prompt «{title}» añadido",
        "saved_current": "✅ Prompt actual guardado como «{title}».",
        "saved_over": "Prompt «{title}» actualizado",
        "saved_as": "Guardado como prompt nuevo «{title}»",
        "meta_saved": "«{title}» actualizado",
        "save_undone": "Cambio deshecho",
        "bar_title": "Prompt Library",
        "bar_search_ph": "Buscar prompts…",
        "bar_save": "Guardar",
        "bar_save_as": "Guardar como…",
        "bar_manage": "Gestionar",
        "undone": "Prompt anterior restaurado",
        "mgr_collections": "Colecciones",
        "mgr_collections_info": "Colecciones de Reference Library asociadas a este prompt. El vínculo va en los dos sentidos: la colección también muestra este prompt.",
        "sec_reflib": "### Reference Library",
        "on_pick_collection": "Al elegir un prompt con colecciones",
        "pick_none": "No hacer nada",
        "pick_offer": "Ofrecer cargar su colección",
        "pick_auto": "Cargar la primera colección automáticamente",
        "on_reflib_applied": "Al cargar una colección en Reference Library",
        "applied_none": "No hacer nada aquí (Reference Library ya ofrece sus prompts)",
        "applied_offer": "Ofrecer también aquí sus prompts asociados",
    },
}


def resolve_lang(setting, browser_lang=None):
    if setting in LANGS:
        return setting
    return "es" if str(browser_lang or "").strip().lower().startswith("es") else "en"


def tr(lang, key, **params):
    text = TEXT.get(lang if lang in LANGS else "en", TEXT["en"]).get(key)
    if text is None:
        text = TEXT["en"].get(key, key)
    return text.format(**params) if params else text


def language_choices(lang):
    return [(tr(lang, "lang_auto"), "auto"), ("English", "en"), ("Español", "es")]


def insert_mode_choices(lang):
    return [(tr(lang, "mode_" + v), v) for v in ("replace", "append", "cursor")]


def pick_collection_choices(lang):
    return [(tr(lang, "pick_" + v), v) for v in ("none", "offer", "auto")]


def reflib_applied_choices(lang):
    return [(tr(lang, "applied_" + v), v) for v in ("none", "offer")]


# ---------------------------------------------------------------- Reference Library (consumed lazily)
REFLIB_API_MODULE = "wan2gp_reference_library_api"
REFLIB_API_VERSION = 1
_reflib_warned = set()


def reflib_api():
    """The Reference Library API module if present and compatible, else None. Looked up at call time because the
    plugin load order is not guaranteed."""
    mod = sys.modules.get(REFLIB_API_MODULE)
    if mod is None:
        return None
    raw_version = getattr(mod, "API_VERSION", None)
    try:
        # Major-compatible: any API_VERSION >= 1 keeps the v1 functions (agreed with the Reference Library owner).
        ok = not isinstance(raw_version, bool) and int(raw_version) >= REFLIB_API_VERSION
    except (TypeError, ValueError):
        ok = False
    if not ok or not callable(getattr(mod, "list_collections", None)):
        key = ("version", repr(raw_version))
        if key not in _reflib_warned:
            _reflib_warned.add(key)
            print(f"[Prompt Library] Reference Library API version {raw_version!r} not supported (need >= {REFLIB_API_VERSION}); collection links hidden")
        return None
    return mod


def reflib_collections():
    """[{id, name, count}] from Reference Library, or None when it is not available (UI hidden)."""
    api = reflib_api()
    if api is None:
        return None
    try:
        raw = api.list_collections() or []
    except Exception as e:
        if "error" not in _reflib_warned:
            _reflib_warned.add("error")
            print(f"[Prompt Library] Reference Library list_collections() failed: {e}")
        return None
    out, seen = [], set()
    for col in raw:
        if not isinstance(col, dict):
            continue
        cid = str(col.get("id") or "").strip()
        if not cid or cid in seen:
            continue
        seen.add(cid)
        try:
            count = int(col.get("count") or 0)
        except (TypeError, ValueError):
            count = 0
        out.append({"id": cid, "name": str(col.get("name") or cid[:8]), "count": count})
    return out


def reflib_names(cols=None):
    cols = reflib_collections() if cols is None else cols
    return {c["id"]: c["name"] for c in (cols or [])}


def collection_choices(cols):
    return [(c["name"], c["id"]) for c in (cols or [])]


def merge_links(selected, previous, known_ids):
    """Links to save from the manager: what is selected among KNOWN collections, plus previous links to ids Reference
    Library does not list right now (deleted/in trash/unavailable), which are kept so an undo restores them."""
    known = set(known_ids)
    out = [c for c in (selected or []) if c in known]
    out += [c for c in (previous or []) if c not in known and c not in out]
    return out


# ---------------------------------------------------------------- public Python API for other plugins
API_MODULE_NAME = "wan2gp_prompt_library_api"
API_VERSION = 1


def _preview(text, n=120):
    text = " ".join(str(text or "").split())
    return text if len(text) <= n else text[: n - 1] + "…"


def _api_list_prompts():
    """[{id, title, preview, tags, collections}] in library order."""
    return [
        {"id": p["id"], "title": p["title"], "preview": _preview(p.get("text")),
         "tags": list(p.get("tags") or []), "collections": list(p.get("collections") or [])}
        for p in storage.list_prompts()
    ]


def _api_get_prompt(prompt_id):
    try:
        p = storage.get_prompt(prompt_id)
    except storage.StorageError:
        return None
    return {"id": p["id"], "title": p["title"], "text": p.get("text") or "", "tags": list(p.get("tags") or []),
            "collections": list(p.get("collections") or [])}


def _api_prompts_for_collection(cid):
    try:
        return storage.prompts_for_collection(cid)
    except storage.StorageError as e:
        raise ValueError(str(e)) from e


def _api_set_collection_prompts(cid, prompt_ids):
    try:
        return storage.set_collection_prompts(cid, prompt_ids)
    except storage.StorageError as e:
        raise ValueError(str(e)) from e


def _api_collections_for_prompt(prompt_id):
    try:
        return storage.collections_for_prompt(prompt_id)
    except storage.StorageError:
        return []


def _api_set_prompt_collections(prompt_id, collection_ids):
    try:
        return list(storage.set_prompt_collections(prompt_id, collection_ids).get("collections") or [])
    except storage.StorageError as e:
        raise ValueError(str(e)) from e


def register_api():
    """Expose sys.modules["wan2gp_prompt_library_api"]. Every write is thread-safe (storage lock), saved atomically
    and bumps storage.revision(); the open page polls it and emits the JS event `promptlib:changed`."""
    import types
    mod = sys.modules.get(API_MODULE_NAME)
    if mod is None or getattr(mod, "__plib_owner__", None) != __name__:
        mod = types.ModuleType(API_MODULE_NAME, "Prompt Library public API (see README)")
        mod.__plib_owner__ = __name__
    mod.API_VERSION = API_VERSION
    mod.VERSION = PLUGIN_VERSION
    mod.list_prompts = _api_list_prompts
    mod.get_prompt = _api_get_prompt
    mod.prompts_for_collection = _api_prompts_for_collection
    mod.set_collection_prompts = _api_set_collection_prompts
    mod.collections_for_prompt = _api_collections_for_prompt
    mod.set_prompt_collections = _api_set_prompt_collections
    mod.revision = storage.revision
    sys.modules[API_MODULE_NAME] = mod
    return mod


DEFAULT_SETTINGS = {
    "enabled": True,
    "show_edit": True,
    "insert_mode": "replace",   # replace | append | cursor
    "language": "auto",
    "toasts": True,
    "toast_ms": 3500,
    "undo": True,
    "save_current_button": True,
    "on_pick_collection": "offer",   # none | offer | auto   (prompt picked -> its Reference Library collection)
    "on_reflib_applied": "none",     # none | offer          (collection loaded -> its prompts; RL already offers)
}
_CHOICES = {
    "insert_mode": ("replace", "append", "cursor"),
    "language": ("auto",) + LANGS,
    "on_pick_collection": ("none", "offer", "auto"),
    "on_reflib_applied": ("none", "offer"),
}
_RANGES = {"toast_ms": (1000, 30000)}


def _coerce(key, default, value):
    if isinstance(default, bool):
        return value if isinstance(value, bool) else default
    if key in _CHOICES:
        value = str(value).strip().lower()
        return value if value in _CHOICES[key] else default
    if isinstance(default, int):
        ok = isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
        if not ok:
            return default
        lo, hi = _RANGES.get(key, (1, 10**9))
        return int(max(lo, min(hi, round(value))))
    return default


def load_settings(path=None):
    settings = copy.deepcopy(DEFAULT_SETTINGS)
    try:
        with open(path or SETTINGS_PATH, "r", encoding="utf-8") as reader:
            user = json.load(reader)
    except FileNotFoundError:
        return settings
    except Exception as e:
        print(f"[Prompt Library] Ignoring invalid settings.json: {e}")
        return settings
    if not isinstance(user, dict):
        return settings
    for key, default in DEFAULT_SETTINGS.items():
        if key in user:
            settings[key] = _coerce(key, default, user[key])
    return settings


def save_settings(settings, path=None):
    path = path or SETTINGS_PATH
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as writer:
        json.dump(settings, writer, indent=2, ensure_ascii=False)
        writer.write("\n")
    os.replace(tmp, path)


def build_js(settings=None):
    settings = settings or load_settings()
    with open(os.path.join(_PLUGIN_DIR, "prompt_library.js"), "r", encoding="utf-8") as reader:
        script = reader.read()
    return (
        script.replace("__PLIB_SETTINGS__", json.dumps(settings))
        .replace("__PLIB_VERSION__", PLUGIN_VERSION)
    )


def _client_meta(cols=None):
    """Extra state sent with the library: revision counter, last change, Reference Library collections (None = hidden)."""
    cols = reflib_collections() if cols is None else cols
    return {"revision": storage.revision(), "change": storage.last_change(), "collections": cols}


def _library_json_for_client():
    data = {"version": storage.LIBRARY_VERSION, "prompts": storage.client_payload()}
    data.update(_client_meta())
    return json.dumps(data, ensure_ascii=False)


def _list_choices(query: str = ""):
    items = storage.search_prompts(query or "", limit=500, collection_names=reflib_names())
    choices = []
    for item in items:
        tags = ", ".join(item.get("tags") or [])
        label = item["title"]
        if tags:
            label += f"  ·  {tags}"
        if item.get("category"):
            label += f"  [{item['category']}]"
        choices.append((label, item["id"]))
    return choices


class PromptLibraryPlugin(WAN2GPPlugin):
    def __init__(self):
        super().__init__()
        self.name = "Prompt Library"
        self.version = PLUGIN_VERSION
        self.description = "Reusable text prompt templates with autocomplete search next to WanGP's prompt box."
        self.targets = {}  # "generate:prompt" -> {tab, field, component}
        self._lock = threading.Lock()
        self._undo = {}  # id -> {field_key, previous, expires}
        self._save_undo = {}  # id -> {kind: "update"|"create", id, before, expires}  (bar Save / Save as / tags)

    # ------------------------------------------------------------ plugin API
    def setup_ui(self):
        self.request_component("prompt")
        self.request_component("wizard_prompt")
        self.request_component("tab_id")
        self.request_component("prompt_column_wizard")  # anchor: the search bar goes right after the prompt box
        register_api()
        self.add_custom_js(build_js())
        self.add_tab(tab_id="prompt_library", label="Prompt Library", component_constructor=self.create_ui)

    def post_ui_setup(self, components):
        tab = components.get("tab_id")
        tab = tab if tab in TAB_IDS else ("generate" if not any(k.startswith("generate:") for k in self.targets) else "edit")
        for field in PROMPT_FIELDS:
            comp = components.get(field)
            if comp is None:
                print(f"[Prompt Library] {tab}:{field} not found, skipped")
                continue
            self.targets[f"{tab}:{field}"] = {"tab": tab, "field": field, "component": comp}
        # The search bar is made of real Gradio components (themed like the rest of WanGP), inserted right after the
        # prompt column (visible in both the basic "wizard" and the advanced prompt modes). prompt_library.js
        # wires the autocomplete to it; if the insertion is not possible it falls back to a DOM-only bar.
        if components.get("prompt_column_wizard") is not None:
            self.insert_after("prompt_column_wizard", lambda t=tab: self.create_bar(t))
        return {}

    def create_bar(self, tab):
        # Same layout family as Reference Library's bar (header with icon + status, a control row, extra rows), but a
        # separate block with its own .plib-* classes. The status / details rows are filled by prompt_library.js
        # (current prompt per browser session), the server never re-renders them.
        lang = resolve_lang(load_settings()["language"])
        with gr.Column(elem_id=f"plib_bar_{tab}", elem_classes=["plib-panel", "plib-bar"]) as bar:
            with gr.Row(elem_classes=["plib-bar-head"]):
                gr.HTML(f'<div class="plib-bar-title"><span class="plib-bar-ico" aria-hidden="true"></span>{html.escape(tr(lang, "bar_title"))}</div>',
                        elem_id=f"plib_bar_title_{tab}", elem_classes=["plib-bar-titlebox"], padding=False)
                gr.HTML("", elem_id=f"plib_bar_status_{tab}", elem_classes=["plib-bar-status"], padding=False)
            with gr.Row(elem_classes=["plib-row", "plib-bar-row"]):
                gr.Textbox(value="", placeholder=tr(lang, "bar_search_ph"), show_label=False, container=False, lines=1, max_lines=1,
                           interactive=True, scale=1, min_width=180, elem_id=f"plib_search_{tab}", elem_classes=["plib-ctl", "plib-search-box"])
                with gr.Row(elem_classes=["plib-btns"]):
                    gr.Button(tr(lang, "bar_save"), size="lg", scale=0, min_width=0,
                              elem_id=f"plib_save_{tab}", elem_classes=["plib-btn", "plib-ico-save", "plib-save-btn"])
                    gr.Button(tr(lang, "bar_save_as"), size="lg", scale=0, min_width=0,
                              elem_id=f"plib_saveas_{tab}", elem_classes=["plib-btn", "plib-ico-saveas", "plib-saveas-btn"])
                    gr.Button(tr(lang, "bar_manage"), size="lg", scale=0, min_width=0,
                              elem_id=f"plib_manage_{tab}", elem_classes=["plib-btn", "plib-ico-manage", "plib-manage-btn"])
            # Tags / Reference Library collections of the current prompt (inline editors, hidden when none is loaded).
            gr.HTML("", elem_id=f"plib_bar_meta_{tab}", elem_classes=["plib-bar-meta"], padding=False)
        return bar

    def targets_for_js(self):
        out = []
        for key, target in self.targets.items():
            comp = target["component"]
            out.append({
                "key": key,
                "tab": target["tab"],
                "field": target["field"],
                "elem_id": getattr(comp, "elem_id", None) or "",
                "component_id": getattr(comp, "_id", None),
                "button": self.bridge_elem_id(key),
            })
        return out

    @staticmethod
    def bridge_elem_id(key: str) -> str:
        return "plib_bridge_" + str(key).replace(":", "_")

    # ---------------------------------------------------------------- i18n tab
    TAB_KEYS = (
        "intro", "language", "sec_search", "enabled", "show_edit", "save_btn_near",
        "sec_insert", "insert_mode", "undo", "sec_messages", "toasts", "toast_s", "save",
        "sec_manager", "mgr_search", "mgr_list", "mgr_title", "mgr_text", "mgr_tags",
        "mgr_category", "mgr_new", "mgr_save", "mgr_dup", "mgr_del", "mgr_refresh",
        "mgr_import", "mgr_export_json", "mgr_export_txt", "mgr_confirm_del", "mgr_io",
        "mgr_collections", "sec_reflib", "on_pick_collection", "on_reflib_applied",
    )

    @staticmethod
    def tab_texts(lang):
        t = lambda key: tr(lang, key)
        return {
            "intro": {"value": f"## Prompt Library {PLUGIN_VERSION}\n" + t("intro")},
            "language": {"label": t("language"), "info": t("language_info"), "choices": language_choices(lang)},
            "sec_search": {"value": t("sec_search")},
            "enabled": {"label": t("enabled"), "info": t("enabled_info")},
            "show_edit": {"label": t("show_edit")},
            "save_btn_near": {"label": t("save_btn_near")},
            "sec_insert": {"value": t("sec_insert")},
            "insert_mode": {"label": t("insert_mode"), "choices": insert_mode_choices(lang)},
            "undo": {"label": t("undo")},
            "sec_messages": {"value": t("sec_messages")},
            "toasts": {"label": t("toasts"), "info": t("toasts_info")},
            "toast_s": {"label": t("toast_s")},
            "save": {"value": t("save")},
            "sec_manager": {"value": t("sec_manager")},
            "mgr_search": {"label": t("mgr_search")},
            "mgr_list": {"label": t("mgr_list")},
            "mgr_title": {"label": t("mgr_title")},
            "mgr_text": {"label": t("mgr_text")},
            "mgr_tags": {"label": t("mgr_tags")},
            "mgr_category": {"label": t("mgr_category")},
            "mgr_new": {"value": t("mgr_new")},
            "mgr_save": {"value": t("mgr_save")},
            "mgr_dup": {"value": t("mgr_dup")},
            "mgr_del": {"value": t("mgr_del")},
            "mgr_refresh": {"value": t("mgr_refresh")},
            "mgr_import": {"value": t("mgr_import")},
            "mgr_export_json": {"value": t("mgr_export_json")},
            "mgr_export_txt": {"value": t("mgr_export_txt")},
            "mgr_confirm_del": {"label": t("mgr_confirm_del")},
            "mgr_io": {"label": t("mgr_io")},
            "mgr_collections": {"label": t("mgr_collections"), "info": t("mgr_collections_info")},
            "sec_reflib": {"value": t("sec_reflib")},
            "on_pick_collection": {"label": t("on_pick_collection"), "choices": pick_collection_choices(lang)},
            "on_reflib_applied": {"label": t("on_reflib_applied"), "choices": reflib_applied_choices(lang)},
        }

    def tab_updates(self, lang):
        texts = self.tab_texts(lang)
        return [gr.update(**texts[key]) for key in self.TAB_KEYS]

    # ---------------------------------------------------------------- UI
    def create_ui(self):
        current = lambda key: (lambda: load_settings()[key])
        lang = resolve_lang(load_settings()["language"])
        tx = self.tab_texts(lang)
        cols = reflib_collections()  # None -> Reference Library missing: collection UI hidden (re-checked at page load)
        ui = {}
        gr.HTML("<style>.plib-hidden{display:none !important;}</style>")
        ui["intro"] = gr.Markdown(tx["intro"]["value"], elem_id="plib_intro")
        with gr.Row(equal_height=False, elem_id="plib_mgr_layout"):
            # ---- manager (left, wide)
            with gr.Column(scale=3, min_width=420, elem_id="plib_mgr_col"):
                with gr.Group(elem_id="plib_mgr_lib"):
                    ui["sec_manager"] = gr.Markdown(tx["sec_manager"]["value"], elem_classes=["plib-sec"])
                    with gr.Row(equal_height=False, elem_classes=["plib-mgr-filter"]):
                        ui["mgr_search"] = gr.Textbox(value="", scale=4, elem_id="plib_mgr_search", **tx["mgr_search"])
                        ui["mgr_refresh"] = gr.Button(tx["mgr_refresh"]["value"], size="sm", variant="secondary", scale=0, min_width=100,
                                                      elem_id="plib_mgr_refresh")
                    ui["mgr_list"] = gr.Dropdown(
                        choices=_list_choices(), value=None, elem_id="plib_mgr_list",
                        allow_custom_value=False, **tx["mgr_list"],
                    )
                with gr.Group(elem_id="plib_mgr_editor"):
                    with gr.Row():
                        ui["mgr_title"] = gr.Textbox(scale=3, elem_id="plib_mgr_title", **tx["mgr_title"])
                        ui["mgr_category"] = gr.Textbox(scale=2, elem_id="plib_mgr_category", **tx["mgr_category"])
                    ui["mgr_tags"] = gr.Textbox(elem_id="plib_mgr_tags", **tx["mgr_tags"])
                    ui["mgr_collections"] = gr.Dropdown(
                        choices=collection_choices(cols), value=[], multiselect=True, allow_custom_value=False,
                        interactive=True, visible=cols is not None, elem_id="plib_mgr_collections", **tx["mgr_collections"],
                    )
                    ui["mgr_text"] = gr.Textbox(lines=6, elem_id="plib_mgr_text", **tx["mgr_text"])
                with gr.Row(elem_classes=["plib-mgr-actions"]):
                    ui["mgr_new"] = gr.Button(tx["mgr_new"]["value"], size="sm", variant="secondary", elem_id="plib_mgr_new")
                    ui["mgr_save"] = gr.Button(tx["mgr_save"]["value"], size="sm", variant="primary", elem_id="plib_mgr_save")
                    ui["mgr_dup"] = gr.Button(tx["mgr_dup"]["value"], size="sm", variant="secondary", elem_id="plib_mgr_dup")
                    ui["mgr_del"] = gr.Button(tx["mgr_del"]["value"], size="sm", variant="stop", elem_id="plib_mgr_del")
                ui["mgr_confirm_del"] = gr.Textbox(value="", elem_id="plib_mgr_confirm_del", **tx["mgr_confirm_del"])
                mgr_status = gr.Markdown("", elem_id="plib_mgr_status")
                with gr.Group(elem_id="plib_mgr_io"):
                    with gr.Row(elem_id="plib_mgr_io_row"):
                        ui["mgr_import"] = gr.Button(tx["mgr_import"]["value"], size="sm", variant="secondary", elem_id="plib_mgr_import")
                        ui["mgr_export_json"] = gr.Button(tx["mgr_export_json"]["value"], size="sm", variant="secondary", elem_id="plib_mgr_export_json")
                        ui["mgr_export_txt"] = gr.Button(tx["mgr_export_txt"]["value"], size="sm", variant="secondary", elem_id="plib_mgr_export_txt")
                    ui["mgr_io"] = import_box = gr.Textbox(lines=4, elem_id="plib_import_box", **tx["mgr_io"])
            # ---- settings (right, narrow)
            with gr.Column(scale=2, min_width=300, elem_id="plib_settings_col"):
                with gr.Group():
                    ui["language"] = gr.Dropdown(value=current("language"), elem_id="plib_language", **tx["language"])
                with gr.Group():
                    ui["sec_search"] = gr.Markdown(tx["sec_search"]["value"], elem_classes=["plib-sec"])
                    ui["enabled"] = gr.Checkbox(value=current("enabled"), elem_id="plib_enabled", **tx["enabled"])
                    ui["show_edit"] = gr.Checkbox(value=current("show_edit"), elem_id="plib_show_edit", **tx["show_edit"])
                    ui["save_btn_near"] = gr.Checkbox(value=current("save_current_button"), elem_id="plib_save_current_button", **tx["save_btn_near"])
                with gr.Group():
                    ui["sec_insert"] = gr.Markdown(tx["sec_insert"]["value"], elem_classes=["plib-sec"])
                    ui["insert_mode"] = gr.Dropdown(value=current("insert_mode"), elem_id="plib_insert_mode", **tx["insert_mode"])
                    ui["undo"] = gr.Checkbox(value=current("undo"), elem_id="plib_undo", **tx["undo"])
                with gr.Group():
                    ui["sec_messages"] = gr.Markdown(tx["sec_messages"]["value"], elem_classes=["plib-sec"])
                    ui["toasts"] = gr.Checkbox(value=current("toasts"), elem_id="plib_toasts", **tx["toasts"])
                    ui["toast_s"] = gr.Number(
                        value=lambda: load_settings()["toast_ms"] / 1000,
                        minimum=1, maximum=30, step=0.5, elem_id="plib_toast_s", **tx["toast_s"],
                    )
                with gr.Group(visible=cols is not None, elem_id="plib_reflib_settings") as reflib_group:
                    ui["sec_reflib"] = gr.Markdown(tx["sec_reflib"]["value"], elem_classes=["plib-sec"])
                    ui["on_pick_collection"] = gr.Dropdown(value=current("on_pick_collection"), elem_id="plib_on_pick_collection",
                                                           **tx["on_pick_collection"])
                    ui["on_reflib_applied"] = gr.Dropdown(value=current("on_reflib_applied"), elem_id="plib_on_reflib_applied",
                                                          **tx["on_reflib_applied"])
                ui["save"] = gr.Button(tx["save"]["value"], variant="primary", elem_id="plib_save_settings")
                status = gr.Markdown("", elem_id="plib_status")

        tab_outputs = [ui[key] for key in self.TAB_KEYS]

        with gr.Group(elem_classes="plib-hidden"):
            settings_json = gr.Textbox(value=lambda: json.dumps(load_settings()), elem_id="plib_settings_json", show_label=False)
            library_json = gr.Textbox(value=_library_json_for_client, elem_id="plib_library_json", show_label=False)
            gr.Textbox(value=json.dumps(self.targets_for_js()), elem_id="plib_targets", show_label=False)
            bridge_req = gr.Textbox(value="", elem_id="plib_bridge_req", show_label=False)
            bridge_resp = gr.Textbox(value="", elem_id="plib_bridge_resp", show_label=False)
            browser_lang = gr.Textbox(value="", elem_id="plib_browser_lang", show_label=False)
            selected_id = gr.Textbox(value="", elem_id="plib_mgr_selected", show_label=False)
            localize_btn = gr.Button("localize", elem_id="plib_localize")
            sync_btn = gr.Button("sync", elem_id="plib_sync")
            reflib_btn = gr.Button("reflib", elem_id="plib_reflib_refresh")
            rev_box = gr.Textbox(value="", elem_id="plib_rev", show_label=False)
            poll_btn = gr.Button("poll", elem_id="plib_poll")
            mgr_ext_btn = gr.Button("mgr-ext", elem_id="plib_mgr_ext")
            mgr_ext_flag = gr.Textbox(value="", elem_id="plib_mgr_ext_flag", show_label=False)
            # One bridge button per registered prompt field. Inputs include both prompt fields of that tab
            # so we can update the right one (or both) without touching core WanGP files.
            by_tab = {}
            for key, target in self.targets.items():
                by_tab.setdefault(target["tab"], {})[target["field"]] = target
            for tab, fields in by_tab.items():
                prompt_comp = fields.get("prompt", {}).get("component")
                wizard_comp = fields.get("wizard_prompt", {}).get("component")
                # Prefer a button keyed on the advanced prompt; wizard shares the same handler.
                primary_key = f"{tab}:prompt" if "prompt" in fields else next(iter(f"{tab}:{f}" for f in fields))
                btn = gr.Button("bridge", elem_id=self.bridge_elem_id(primary_key))
                inputs = [bridge_req]
                outputs = [bridge_resp]
                if prompt_comp is not None:
                    inputs.append(prompt_comp)
                    outputs.append(prompt_comp)
                else:
                    inputs.append(gr.State(""))
                    outputs.append(gr.State())
                if wizard_comp is not None:
                    inputs.append(wizard_comp)
                    outputs.append(wizard_comp)
                else:
                    inputs.append(gr.State(""))
                    outputs.append(gr.State())
                btn.click(
                    fn=self._bridge_fn(tab),
                    inputs=inputs,
                    outputs=outputs,
                    show_progress="hidden",
                    trigger_mode="multiple",
                    queue=True,
                ).then(
                    fn=None, inputs=[bridge_resp], outputs=None, show_progress="hidden",
                    js="(r) => { if (window.promptLibrary) window.promptLibrary.bridgeResponse(r); }",
                )
                # Also expose a button id for the wizard key pointing at the same primary (JS looks either up).
                if primary_key != f"{tab}:wizard_prompt" and "wizard_prompt" in fields:
                    # Alias textbox so JS can find a button id for wizard_prompt keys via targets list.
                    pass

        localize_btn.click(
            fn=self._localize, inputs=[browser_lang],
            outputs=[settings_json, library_json] + tab_outputs,
            show_progress="hidden", queue=False,
            js="(x) => JSON.stringify({ browser: navigator.language || '', lang: (window.promptLibrary && window.promptLibrary.tabRequest) || null })",
        ).then(
            fn=None, inputs=[settings_json, library_json], outputs=None,
            js="(s, lib) => { if (window.promptLibrary) { window.promptLibrary.applySettings(s, true); window.promptLibrary.applyLibrary(lib); } }",
        )

        sync_btn.click(
            fn=lambda: _library_json_for_client(),
            inputs=None, outputs=[library_json], show_progress="hidden", queue=False,
        ).then(
            fn=None, inputs=[library_json], outputs=None,
            js="(lib) => { if (window.promptLibrary) window.promptLibrary.applyLibrary(lib); }",
        )

        # Reference Library collections (names / availability) -> manager selector, settings group and the page cache.
        def refresh_reflib(current_value):
            cols2 = reflib_collections()
            lib = _library_json_for_client()
            if cols2 is None:
                return gr.update(visible=False, choices=[], value=[]), gr.update(visible=False), lib
            known = {c["id"] for c in cols2}
            value = [c for c in (current_value or []) if c in known]
            return gr.update(visible=True, choices=collection_choices(cols2), value=value), gr.update(visible=True), lib

        reflib_btn.click(
            fn=refresh_reflib, inputs=[ui["mgr_collections"]], outputs=[ui["mgr_collections"], reflib_group, library_json],
            show_progress="hidden", queue=False,
        ).then(
            fn=None, inputs=[library_json], outputs=None,
            js="(lib) => { if (window.promptLibrary) window.promptLibrary.applyLibrary(lib); }",
        )
        # Cheap change detection (Python API writes from other plugins): the page polls the revision counter.
        poll_btn.click(
            fn=lambda: str(storage.revision()), inputs=None, outputs=[rev_box], show_progress="hidden", queue=False,
        ).then(
            fn=None, inputs=[rev_box], outputs=None,
            js="(r) => { if (window.promptLibrary) window.promptLibrary._onRevision(r); }",
        )

        settings_inputs = [
            ui["enabled"], ui["show_edit"], ui["save_btn_near"], ui["insert_mode"], ui["undo"],
            ui["toasts"], ui["toast_s"], ui["on_pick_collection"], ui["on_reflib_applied"], ui["language"], browser_lang,
        ]
        ui["save"].click(
            fn=self._save_from_ui, inputs=settings_inputs,
            outputs=[status, settings_json] + tab_outputs, show_progress="hidden",
            js="(...a) => { a[a.length - 1] = navigator.language || ''; return a; }",
        ).then(
            fn=None, inputs=[settings_json], outputs=None,
            js="(s) => { if (window.promptLibrary) window.promptLibrary.applySettings(s, true); }",
        )

        # manager events
        def refresh_list(query="", selected=None):
            choices = _list_choices(query or "")
            value = selected if selected and any(c[1] == selected for c in choices) else (choices[0][1] if choices else None)
            return gr.update(choices=choices, value=value)

        def colls_update(item):
            """Selector value for a prompt: its links to collections Reference Library currently lists."""
            cols2 = reflib_collections()
            if cols2 is None:
                return gr.update(value=[])
            known = {c["id"] for c in cols2}
            links = [c for c in ((item or {}).get("collections") or []) if c in known]
            return gr.update(choices=collection_choices(cols2), value=links)

        def on_select(pid):
            if not pid:
                return "", "", "", "", "", gr.update(value=[])
            try:
                item = storage.get_prompt(pid)
            except storage.StorageError:
                return "", "", "", "", "", gr.update(value=[])
            return (
                item["id"],
                item["title"],
                item["text"],
                ", ".join(item.get("tags") or []),
                item.get("category") or "",
                colls_update(item),
            )

        def do_new():
            return "", "", "", "", "", gr.update(value=[]), tr(resolve_lang(load_settings()["language"]), "mgr_new")

        def links_to_save(pid, selected):
            cols2 = reflib_collections()
            if cols2 is None:
                return None  # Reference Library unavailable: never touch existing links
            previous = []
            if pid:
                try:
                    previous = storage.get_prompt(pid).get("collections") or []
                except storage.StorageError:
                    previous = []
            return merge_links(selected or [], previous, [c["id"] for c in cols2])

        def do_save(pid, title, text, tags, category, colls=None, browser=""):
            lang2 = resolve_lang(load_settings()["language"], browser)
            title = (title or "").strip()
            text = text or ""
            if not title and not text.strip():
                return tr(lang2, "need_title_or_text"), gr.update(), pid, _library_json_for_client()
            try:
                links = links_to_save(pid, colls)
                if pid:
                    item = storage.update_prompt(pid, title=title or None, text=text, tags=tags, category=category, collections=links)
                    msg = tr(lang2, "updated", title=item["title"])
                else:
                    item = storage.create_prompt(title, text, tags=tags, category=category, collections=links)
                    msg = tr(lang2, "created", title=item["title"])
                return msg, refresh_list("", item["id"]), item["id"], _library_json_for_client()
            except storage.StorageError as e:
                return f"❌ {e}", gr.update(), pid, _library_json_for_client()

        def do_dup(pid, browser=""):
            lang2 = resolve_lang(load_settings()["language"], browser)
            if not pid:
                return tr(lang2, "need_select"), gr.update(), pid, "", "", "", "", gr.update(), _library_json_for_client()
            try:
                item = storage.duplicate_prompt(pid)
            except storage.StorageError:
                return tr(lang2, "not_found"), gr.update(), "", "", "", "", "", gr.update(value=[]), _library_json_for_client()
            return (
                tr(lang2, "duplicated", title=item["title"]),
                refresh_list("", item["id"]),
                item["id"], item["title"], item["text"],
                ", ".join(item.get("tags") or []), item.get("category") or "",
                colls_update(item),
                _library_json_for_client(),
            )

        def do_del(pid, confirm, browser=""):
            lang2 = resolve_lang(load_settings()["language"], browser)
            if not pid:
                return tr(lang2, "need_select"), gr.update(), pid, "", "", "", "", gr.update(), confirm, _library_json_for_client()
            if str(confirm or "").strip().upper() != "DELETE":
                return (tr(lang2, "need_confirm"), gr.update(), pid, gr.update(), gr.update(), gr.update(), gr.update(), gr.update(),
                        confirm, _library_json_for_client())
            try:
                storage.delete_prompt(pid)
            except storage.StorageError:
                return tr(lang2, "not_found"), gr.update(), "", "", "", "", "", gr.update(value=[]), "", _library_json_for_client()
            return (
                tr(lang2, "deleted"), refresh_list(""), "", "", "", "", "", gr.update(value=[]), "", _library_json_for_client(),
            )

        def do_import(raw, browser=""):
            lang2 = resolve_lang(load_settings()["language"], browser)
            raw = (raw or "").strip()
            if not raw:
                return tr(lang2, "empty_import"), gr.update(), _library_json_for_client()
            try:
                if raw.lstrip().startswith("{") or raw.lstrip().startswith("["):
                    added, skipped = storage.import_json(raw)
                else:
                    added, skipped = storage.import_plain_text(raw)
            except storage.StorageError as e:
                return f"❌ {e}", gr.update(), _library_json_for_client()
            return tr(lang2, "imported", n=added, skipped=skipped), refresh_list(""), _library_json_for_client()

        def do_export_json(browser=""):
            lang2 = resolve_lang(load_settings()["language"], browser)
            return storage.export_json(), tr(lang2, "exported")

        def do_export_txt(browser=""):
            lang2 = resolve_lang(load_settings()["language"], browser)
            return storage.export_plain_text(), tr(lang2, "exported")

        ui["mgr_list"].change(
            fn=on_select, inputs=[ui["mgr_list"]],
            outputs=[selected_id, ui["mgr_title"], ui["mgr_text"], ui["mgr_tags"], ui["mgr_category"], ui["mgr_collections"]],
            show_progress="hidden",
        )
        ui["mgr_search"].change(
            fn=lambda q: refresh_list(q), inputs=[ui["mgr_search"]], outputs=[ui["mgr_list"]], show_progress="hidden",
        )
        ui["mgr_refresh"].click(
            fn=lambda q: (refresh_list(q), _library_json_for_client()),
            inputs=[ui["mgr_search"]], outputs=[ui["mgr_list"], library_json], show_progress="hidden",
        ).then(fn=None, inputs=[library_json], outputs=None,
               js="(lib) => { if (window.promptLibrary) window.promptLibrary.applyLibrary(lib); }")
        ui["mgr_new"].click(
            fn=do_new, inputs=None,
            outputs=[selected_id, ui["mgr_title"], ui["mgr_text"], ui["mgr_tags"], ui["mgr_category"], ui["mgr_collections"], mgr_status],
            show_progress="hidden",
        )
        ui["mgr_save"].click(
            fn=do_save,
            inputs=[selected_id, ui["mgr_title"], ui["mgr_text"], ui["mgr_tags"], ui["mgr_category"], ui["mgr_collections"], browser_lang],
            outputs=[mgr_status, ui["mgr_list"], selected_id, library_json],
            show_progress="hidden",
        ).then(fn=None, inputs=[library_json], outputs=None,
               js="(lib) => { if (window.promptLibrary) window.promptLibrary.applyLibrary(lib); }")
        ui["mgr_dup"].click(
            fn=do_dup, inputs=[selected_id, browser_lang],
            outputs=[mgr_status, ui["mgr_list"], selected_id, ui["mgr_title"], ui["mgr_text"], ui["mgr_tags"], ui["mgr_category"],
                     ui["mgr_collections"], library_json],
            show_progress="hidden",
        ).then(fn=None, inputs=[library_json], outputs=None,
               js="(lib) => { if (window.promptLibrary) window.promptLibrary.applyLibrary(lib); }")
        ui["mgr_del"].click(
            fn=do_del, inputs=[selected_id, ui["mgr_confirm_del"], browser_lang],
            outputs=[mgr_status, ui["mgr_list"], selected_id, ui["mgr_title"], ui["mgr_text"], ui["mgr_tags"], ui["mgr_category"],
                     ui["mgr_collections"], ui["mgr_confirm_del"], library_json],
            show_progress="hidden",
        ).then(fn=None, inputs=[library_json], outputs=None,
               js="(lib) => { if (window.promptLibrary) window.promptLibrary.applyLibrary(lib); }")
        ui["mgr_import"].click(
            fn=do_import, inputs=[import_box, browser_lang],
            outputs=[mgr_status, ui["mgr_list"], library_json], show_progress="hidden",
        ).then(fn=None, inputs=[library_json], outputs=None,
               js="(lib) => { if (window.promptLibrary) window.promptLibrary.applyLibrary(lib); }")
        # Library changed elsewhere (bar Save / Save as / tags, Python API, another browser): refresh the list and, when the
        # page says the editor holds no unsaved edits ("reload"), the selected prompt's fields too.
        def ext_refresh(query, pid, flag):
            out = [refresh_list(query or "", pid or None)]
            if flag == "reload" and pid:
                try:
                    item = storage.get_prompt(pid)
                    out += [item["title"], item["text"], ", ".join(item.get("tags") or []), item.get("category") or "", colls_update(item)]
                    return out
                except storage.StorageError:
                    pass
            return out + [gr.skip()] * 5

        mgr_ext_btn.click(
            fn=ext_refresh, inputs=[ui["mgr_search"], selected_id, mgr_ext_flag],
            outputs=[ui["mgr_list"], ui["mgr_title"], ui["mgr_text"], ui["mgr_tags"], ui["mgr_category"], ui["mgr_collections"]],
            show_progress="hidden", queue=False,
            js="(q, pid, f) => [q, pid, (window.promptLibrary && window.promptLibrary._mgrFlag()) || '']",
        )
        ui["mgr_export_json"].click(
            fn=do_export_json, inputs=[browser_lang], outputs=[import_box, mgr_status], show_progress="hidden",
        )
        ui["mgr_export_txt"].click(
            fn=do_export_txt, inputs=[browser_lang], outputs=[import_box, mgr_status], show_progress="hidden",
        )

    # ----------------------------------------------------------- settings / localize
    def _localize(self, raw):
        try:
            data = json.loads(raw) if isinstance(raw, str) and raw.strip() else {}
        except Exception:
            data = {}
        forced = data.get("lang")
        browser = data.get("browser") or ""
        setting = forced if forced in LANGS else load_settings()["language"]
        lang = resolve_lang(setting, browser)
        return [json.dumps(load_settings()), _library_json_for_client()] + self.tab_updates(lang)

    def _save_from_ui(self, enabled, show_edit, save_btn_near, insert_mode, undo, toasts, toast_s,
                      on_pick_collection, on_reflib_applied, language, browser_lang):
        settings = load_settings()
        settings["enabled"] = bool(enabled)
        settings["show_edit"] = bool(show_edit)
        settings["save_current_button"] = bool(save_btn_near)
        settings["insert_mode"] = _coerce("insert_mode", DEFAULT_SETTINGS["insert_mode"], insert_mode)
        settings["undo"] = bool(undo)
        settings["toasts"] = bool(toasts)
        try:
            settings["toast_ms"] = _coerce("toast_ms", DEFAULT_SETTINGS["toast_ms"], float(toast_s) * 1000)
        except Exception:
            settings["toast_ms"] = DEFAULT_SETTINGS["toast_ms"]
        settings["on_pick_collection"] = _coerce("on_pick_collection", DEFAULT_SETTINGS["on_pick_collection"], on_pick_collection)
        settings["on_reflib_applied"] = _coerce("on_reflib_applied", DEFAULT_SETTINGS["on_reflib_applied"], on_reflib_applied)
        settings["language"] = _coerce("language", DEFAULT_SETTINGS["language"], language)
        lang = resolve_lang(settings["language"], browser_lang)
        try:
            save_settings(settings)
            msg = tr(lang, "saved", time=time.strftime("%H:%M:%S"))
        except Exception as e:
            msg = tr(lang, "save_failed", error=str(e))
        return [msg, json.dumps(settings)] + self.tab_updates(lang)

    # ---------------------------------------------------------------- bridge
    def _bridge_fn(self, tab):
        def handler(raw, prompt_val, wizard_val):
            return self.bridge(tab, raw, prompt_val, wizard_val)
        return handler

    def bridge(self, tab, raw, prompt_val, wizard_val):
        lang = resolve_lang(load_settings()["language"])
        try:
            req = json.loads(raw) if isinstance(raw, str) and raw.strip() else {}
        except Exception:
            return self._pack(tab, {"ok": False, "error": tr(lang, "bad_request")}, prompt_val, wizard_val, None, None)
        if isinstance(req, dict) and req.get("lang") in LANGS:
            lang = req["lang"]
        action = (req.get("action") or "").strip().lower()
        try:
            if action == "insert":
                return self._action_insert(tab, req, prompt_val, wizard_val, lang)
            if action == "undo":
                return self._action_undo(tab, req, prompt_val, wizard_val, lang)
            if action in ("save_current", "save_as"):
                return self._action_save_as(tab, req, prompt_val, wizard_val, lang)
            if action == "update_text":
                return self._action_update_text(tab, req, prompt_val, wizard_val, lang)
            if action == "set_meta":
                return self._action_set_meta(tab, req, prompt_val, wizard_val, lang)
            if action == "undo_save":
                return self._action_undo_save(tab, req, prompt_val, wizard_val, lang)
            if action == "mark_used":
                pid = req.get("id")
                storage.mark_used(pid)
                return self._pack(tab, dict({"ok": True}, **self._lib_resp()), prompt_val, wizard_val, None, None)
            if action == "peek":
                return self._pack(tab, {"ok": True, "prompt": prompt_val, "wizard_prompt": wizard_val, "id": req.get("req_id")},
                                  prompt_val, wizard_val, None, None)
            if action == "ping":
                return self._pack(tab, {"ok": True, "pong": True, "targets": list(self.targets)}, prompt_val, wizard_val, None, None)
            return self._pack(tab, {"ok": False, "error": tr(lang, "unknown_action")}, prompt_val, wizard_val, None, None)
        except storage.StorageError as e:
            return self._pack(tab, {"ok": False, "error": str(e) or tr(lang, "not_found")}, prompt_val, wizard_val, None, None)
        except Exception as e:
            traceback.print_exc()
            return self._pack(tab, {"ok": False, "error": str(e)}, prompt_val, wizard_val, None, None)

    @staticmethod
    def _lib_resp():
        data = {"library": storage.client_payload()}
        data.update(_client_meta())
        return data

    def _pack(self, tab, resp, prompt_val, wizard_val, new_prompt, new_wizard):
        resp = dict(resp)
        resp.setdefault("id", None)
        out_prompt = gr.update(value=new_prompt) if new_prompt is not None else gr.skip()
        out_wizard = gr.update(value=new_wizard) if new_wizard is not None else gr.skip()
        # Always keep a JSON string in the response box.
        return json.dumps(resp, ensure_ascii=False), out_prompt, out_wizard

    def _resolve_text(self, req, lang):
        """Get insert text from request (inline) or library id; apply template vars."""
        text = req.get("text")
        title = req.get("title") or ""
        pid = req.get("id")
        item = None
        if pid:
            item = storage.get_prompt(pid)
            text = item["text"] if text is None else text
            title = title or item["title"]
        if text is None:
            raise storage.StorageError(tr(lang, "not_found"))
        values = req.get("vars") if isinstance(req.get("vars"), dict) else {}
        if values:
            text = storage.apply_variables(text, values)
        return str(text), title, item

    def _action_insert(self, tab, req, prompt_val, wizard_val, lang):
        settings = load_settings()
        mode = req.get("mode") or settings.get("insert_mode") or "replace"
        if mode not in ("replace", "append", "cursor"):
            mode = "replace"
        field = req.get("field") or "prompt"
        if field not in PROMPT_FIELDS:
            field = "prompt"
        text, title, item = self._resolve_text(req, lang)
        current = prompt_val if field == "prompt" else wizard_val
        # The page sends what the user currently sees in the visible prompt box; prefer it (it is what Undo
        # must restore and what Append must extend), fall back to the Gradio value.
        if isinstance(req.get("current"), str):
            current = req["current"]
        current = "" if current is None else str(current)
        if mode == "append":
            sep = "" if not current or current.endswith("\n") else "\n"
            new_val = current + sep + text
            toast_key = "appended"
        elif mode == "cursor":
            # Cursor insertion is applied client-side when possible; server falls back to append.
            cursor = req.get("cursor")
            if isinstance(cursor, int) and 0 <= cursor <= len(current):
                new_val = current[:cursor] + text + current[cursor:]
            else:
                sep = "" if not current or current.endswith("\n") else "\n"
                new_val = current + sep + text
            toast_key = "inserted"
        else:
            new_val = text
            toast_key = "inserted"

        undo_id = None
        if settings.get("undo", True):
            undo_id = f"{time.time():.6f}-{os.urandom(3).hex()}"
            with self._lock:
                self._undo[undo_id] = {
                    "tab": tab, "field": field, "previous": current,
                    "expires": time.time() + 30,
                }

        if item is not None:
            try:
                storage.mark_used(item["id"])
            except storage.StorageError:
                pass

        resp = {
            "ok": True,
            "toast": tr(lang, toast_key, title=title or "prompt"),
            "undo_id": undo_id,
            "mode": mode,
            "field": field,
            "value": new_val,
            "text": text,  # the rendered prompt (template values applied): baseline of the bar's "modified" indicator
            "prompt_id": item["id"] if item is not None else None,
            "id": req.get("req_id"),
            "tab": tab,
        }
        resp.update(self._lib_resp())
        # Always write both prompt fields so the visible one (advanced or wizard) updates reliably.
        new_prompt = new_val
        new_wizard = new_val
        return self._pack(tab, resp, prompt_val, wizard_val, new_prompt, new_wizard)

    def _action_undo(self, tab, req, prompt_val, wizard_val, lang):
        undo_id = req.get("undo_id")
        with self._lock:
            entry = self._undo.pop(undo_id, None) if undo_id else None
        if not entry or entry.get("expires", 0) < time.time() or entry.get("tab") != tab:
            return self._pack(tab, {"ok": False, "error": tr(lang, "bad_request")}, prompt_val, wizard_val, None, None)
        previous = entry["previous"]
        field = entry["field"]
        resp = {"ok": True, "toast": tr(lang, "undone"), "value": previous, "id": req.get("req_id"), "tab": tab}
        return self._pack(tab, resp, prompt_val, wizard_val, previous, previous)

    # ----------------------------------------------------- bar: Save / Save as / tags + collections (undo-friendly)
    def _remember_save(self, kind, pid, before=None):
        undo_id = f"s{time.time():.6f}-{os.urandom(3).hex()}"
        now = time.time()
        with self._lock:
            for key in [k for k, v in self._save_undo.items() if v["expires"] < now]:
                self._save_undo.pop(key, None)
            self._save_undo[undo_id] = {"kind": kind, "id": pid, "before": before, "expires": now + 120}
        return undo_id

    @staticmethod
    def _snapshot(item):
        return {"title": item["title"], "text": item["text"], "tags": list(item.get("tags") or []),
                "collections": list(item.get("collections") or [])}

    @staticmethod
    def _links_from_request(req, previous):
        """Collections to store: the visible ones the page selected + links Reference Library does not list now (kept)."""
        if not isinstance(req.get("collections"), list):
            return None  # not sent: leave links untouched
        cols = reflib_collections()
        if cols is None:
            return None  # Reference Library unavailable: never touch links
        return merge_links([str(c) for c in req["collections"]], previous or [], [c["id"] for c in cols])

    def _request_text(self, req, prompt_val, wizard_val):
        field = req.get("field") or "prompt"
        text = req.get("text")
        if text is None:
            text = prompt_val if field == "prompt" else wizard_val
        return "" if text is None else str(text)

    def _action_save_as(self, tab, req, prompt_val, wizard_val, lang):
        text = self._request_text(req, prompt_val, wizard_val)
        title = (req.get("title") or "").strip() or (text.split("\n", 1)[0][:60] if text.strip() else "")
        if not text.strip() and not title:
            return self._pack(tab, {"ok": False, "error": tr(lang, "need_title_or_text")}, prompt_val, wizard_val, None, None)
        source_links = []
        if req.get("from_id"):
            try:
                source_links = storage.get_prompt(req["from_id"]).get("collections") or []
            except storage.StorageError:
                source_links = []
        links = self._links_from_request(req, source_links)
        item = storage.create_prompt(title, text, tags=req.get("tags"), category=req.get("category") or "", collections=links)
        legacy = (req.get("action") or "") == "save_current"
        resp = {
            "ok": True,
            "toast": tr(lang, "saved_current" if legacy else "saved_as", title=item["title"]),
            "item": item,
            "save_undo_id": self._remember_save("create", item["id"]),
            "id": req.get("req_id"),
        }
        resp.update(self._lib_resp())
        return self._pack(tab, resp, prompt_val, wizard_val, None, None)

    def _action_update_text(self, tab, req, prompt_val, wizard_val, lang):
        before = storage.get_prompt(req.get("id"))
        text = self._request_text(req, prompt_val, wizard_val)
        if not text.strip():
            return self._pack(tab, {"ok": False, "error": tr(lang, "need_title_or_text")}, prompt_val, wizard_val, None, None)
        item = storage.update_prompt(before["id"], text=text)
        resp = {
            "ok": True, "toast": tr(lang, "saved_over", title=item["title"]), "item": item,
            "save_undo_id": self._remember_save("update", item["id"], self._snapshot(before)), "id": req.get("req_id"),
        }
        resp.update(self._lib_resp())
        return self._pack(tab, resp, prompt_val, wizard_val, None, None)

    def _action_set_meta(self, tab, req, prompt_val, wizard_val, lang):
        before = storage.get_prompt(req.get("id"))
        fields = {}
        if isinstance(req.get("tags"), list):
            fields["tags"] = [str(t) for t in req["tags"]]
        if "title" in req and str(req.get("title") or "").strip():
            fields["title"] = str(req["title"]).strip()
        links = self._links_from_request(req, before.get("collections"))
        if links is not None:
            fields["collections"] = links
        if not fields:
            return self._pack(tab, dict({"ok": True, "item": before}, **self._lib_resp()), prompt_val, wizard_val, None, None)
        item = storage.update_prompt(before["id"], **fields)
        resp = {
            "ok": True, "toast": tr(lang, "meta_saved", title=item["title"]), "item": item,
            "save_undo_id": self._remember_save("update", item["id"], self._snapshot(before)), "id": req.get("req_id"),
        }
        resp.update(self._lib_resp())
        return self._pack(tab, resp, prompt_val, wizard_val, None, None)

    def _action_undo_save(self, tab, req, prompt_val, wizard_val, lang):
        with self._lock:
            entry = self._save_undo.pop(req.get("undo_id") or "", None)
        if not entry or entry["expires"] < time.time():
            return self._pack(tab, {"ok": False, "error": tr(lang, "bad_request")}, prompt_val, wizard_val, None, None)
        if entry["kind"] == "create":
            storage.delete_prompt(entry["id"])
            item = None
        else:
            b = entry["before"]
            item = storage.update_prompt(entry["id"], title=b["title"], text=b["text"], tags=b["tags"], collections=b["collections"])
        resp = {"ok": True, "toast": tr(lang, "save_undone"), "item": item, "undo_kind": entry["kind"],
                "undone_id": entry["id"], "id": req.get("req_id")}
        resp.update(self._lib_resp())
        return self._pack(tab, resp, prompt_val, wizard_val, None, None)


# Register the public API as soon as the plugin module is imported (other plugins look it up lazily).
register_api()

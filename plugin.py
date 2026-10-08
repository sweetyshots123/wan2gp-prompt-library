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
"""
from __future__ import annotations

import copy
import json
import math
import os
import threading
import time
import traceback

import gradio as gr

from shared.utils.plugins import WAN2GPPlugin

from . import storage

PLUGIN_VERSION = "1.0.0"
_PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
SETTINGS_PATH = os.path.join(_PLUGIN_DIR, "settings.json")

TAB_IDS = ("generate", "edit")
PROMPT_FIELDS = ("prompt", "wizard_prompt")
LANGS = ("en", "es")

TEXT = {
    "en": {
        "intro": "Save reusable **prompt templates**, find them with autocomplete next to WanGP's prompt box "
                 "(type one or more words; accent-insensitive), and insert them with replace or append. "
                 "Manage the library below. Data is stored in `library.json` in the plugin folder and survives updates.",
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
        "save_btn_near": "“Save current prompt” button next to the search box",
        "save": "Save settings",
        "saved": "✅ Settings saved and applied ({time}).",
        "save_failed": "❌ Could not save `settings.json`: {error}",
        "mgr_search": "Filter",
        "mgr_title": "Title",
        "mgr_text": "Prompt text",
        "mgr_tags": "Tags (comma-separated)",
        "mgr_category": "Category / collection",
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
        "undone": "Previous prompt restored",
    },
    "es": {
        "intro": "Guarda **plantillas de prompt** reutilizables, encuéntralas con autocompletado junto al cuadro de prompt de WanGP "
                 "(escribe una o varias palabras; sin distinguir acentos) e insértalas reemplazando o añadiendo. "
                 "Gestiona la librería abajo. Los datos están en `library.json` de la carpeta del plugin y sobreviven a las actualizaciones.",
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
        "save_btn_near": "Botón «Guardar prompt actual» junto a la búsqueda",
        "save": "Guardar ajustes",
        "saved": "✅ Ajustes guardados y aplicados ({time}).",
        "save_failed": "❌ No se pudo guardar `settings.json`: {error}",
        "mgr_search": "Filtrar",
        "mgr_title": "Título",
        "mgr_text": "Texto del prompt",
        "mgr_tags": "Etiquetas (separadas por comas)",
        "mgr_category": "Categoría / colección",
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
        "undone": "Prompt anterior restaurado",
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


DEFAULT_SETTINGS = {
    "enabled": True,
    "show_edit": True,
    "insert_mode": "replace",   # replace | append | cursor
    "language": "auto",
    "toasts": True,
    "toast_ms": 3500,
    "undo": True,
    "save_current_button": True,
}
_CHOICES = {"insert_mode": ("replace", "append", "cursor"), "language": ("auto",) + LANGS}
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


def _library_json_for_client():
    return json.dumps({"version": storage.LIBRARY_VERSION, "prompts": storage.client_payload()}, ensure_ascii=False)


def _list_choices(query: str = ""):
    items = storage.search_prompts(query or "", limit=500)
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

    # ------------------------------------------------------------ plugin API
    def setup_ui(self):
        self.request_component("prompt")
        self.request_component("wizard_prompt")
        self.request_component("tab_id")
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
        return {}

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
        }

    def tab_updates(self, lang):
        texts = self.tab_texts(lang)
        return [gr.update(**texts[key]) for key in self.TAB_KEYS]

    # ---------------------------------------------------------------- UI
    def create_ui(self):
        current = lambda key: (lambda: load_settings()[key])
        lang = resolve_lang(load_settings()["language"])
        tx = self.tab_texts(lang)
        ui = {}
        gr.HTML("<style>.plib-hidden{display:none !important;}</style>")
        ui["intro"] = gr.Markdown(tx["intro"]["value"], elem_id="plib_intro")
        with gr.Row():
            ui["language"] = gr.Dropdown(value=current("language"), elem_id="plib_language", **tx["language"])
        with gr.Group():
            ui["sec_search"] = gr.Markdown(tx["sec_search"]["value"])
            with gr.Row():
                ui["enabled"] = gr.Checkbox(value=current("enabled"), elem_id="plib_enabled", **tx["enabled"])
                ui["show_edit"] = gr.Checkbox(value=current("show_edit"), elem_id="plib_show_edit", **tx["show_edit"])
                ui["save_btn_near"] = gr.Checkbox(value=current("save_current_button"), elem_id="plib_save_current_button", **tx["save_btn_near"])
        with gr.Group():
            ui["sec_insert"] = gr.Markdown(tx["sec_insert"]["value"])
            with gr.Row():
                ui["insert_mode"] = gr.Dropdown(value=current("insert_mode"), elem_id="plib_insert_mode", **tx["insert_mode"])
                ui["undo"] = gr.Checkbox(value=current("undo"), elem_id="plib_undo", **tx["undo"])
        with gr.Group():
            ui["sec_messages"] = gr.Markdown(tx["sec_messages"]["value"])
            with gr.Row():
                ui["toasts"] = gr.Checkbox(value=current("toasts"), elem_id="plib_toasts", **tx["toasts"])
                ui["toast_s"] = gr.Number(
                    value=lambda: load_settings()["toast_ms"] / 1000,
                    minimum=1, maximum=30, step=0.5, elem_id="plib_toast_s", **tx["toast_s"],
                )
        ui["save"] = gr.Button(tx["save"]["value"], variant="primary", elem_id="plib_save_settings")
        status = gr.Markdown("", elem_id="plib_status")

        # ---- manager
        ui["sec_manager"] = gr.Markdown(tx["sec_manager"]["value"])
        with gr.Row():
            ui["mgr_search"] = gr.Textbox(value="", elem_id="plib_mgr_search", **tx["mgr_search"])
            ui["mgr_refresh"] = gr.Button(tx["mgr_refresh"]["value"], elem_id="plib_mgr_refresh")
        ui["mgr_list"] = gr.Dropdown(
            choices=_list_choices(), value=None, elem_id="plib_mgr_list",
            allow_custom_value=False, **tx["mgr_list"],
        )
        with gr.Row():
            ui["mgr_title"] = gr.Textbox(elem_id="plib_mgr_title", **tx["mgr_title"])
            ui["mgr_category"] = gr.Textbox(elem_id="plib_mgr_category", **tx["mgr_category"])
        ui["mgr_tags"] = gr.Textbox(elem_id="plib_mgr_tags", **tx["mgr_tags"])
        ui["mgr_text"] = gr.Textbox(lines=6, elem_id="plib_mgr_text", **tx["mgr_text"])
        with gr.Row():
            ui["mgr_new"] = gr.Button(tx["mgr_new"]["value"], elem_id="plib_mgr_new")
            ui["mgr_save"] = gr.Button(tx["mgr_save"]["value"], variant="primary", elem_id="plib_mgr_save")
            ui["mgr_dup"] = gr.Button(tx["mgr_dup"]["value"], elem_id="plib_mgr_dup")
            ui["mgr_del"] = gr.Button(tx["mgr_del"]["value"], variant="stop", elem_id="plib_mgr_del")
        ui["mgr_confirm_del"] = gr.Textbox(value="", elem_id="plib_mgr_confirm_del", **tx["mgr_confirm_del"])
        with gr.Row():
            ui["mgr_import"] = gr.Button(tx["mgr_import"]["value"], elem_id="plib_mgr_import")
            ui["mgr_export_json"] = gr.Button(tx["mgr_export_json"]["value"], elem_id="plib_mgr_export_json")
            ui["mgr_export_txt"] = gr.Button(tx["mgr_export_txt"]["value"], elem_id="plib_mgr_export_txt")
        ui["mgr_io"] = import_box = gr.Textbox(lines=4, elem_id="plib_import_box", **tx["mgr_io"])
        mgr_status = gr.Markdown("", elem_id="plib_mgr_status")

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

        settings_inputs = [
            ui["enabled"], ui["show_edit"], ui["save_btn_near"], ui["insert_mode"], ui["undo"],
            ui["toasts"], ui["toast_s"], ui["language"], browser_lang,
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

        def on_select(pid):
            if not pid:
                return "", "", "", "", ""
            try:
                item = storage.get_prompt(pid)
            except storage.StorageError:
                return "", "", "", "", ""
            return (
                item["id"],
                item["title"],
                item["text"],
                ", ".join(item.get("tags") or []),
                item.get("category") or "",
            )

        def do_new():
            return "", "", "", "", "", tr(resolve_lang(load_settings()["language"]), "mgr_new")

        def do_save(pid, title, text, tags, category, browser=""):
            lang2 = resolve_lang(load_settings()["language"], browser)
            title = (title or "").strip()
            text = text or ""
            if not title and not text.strip():
                return tr(lang2, "need_title_or_text"), gr.update(), pid, _library_json_for_client()
            try:
                if pid:
                    item = storage.update_prompt(pid, title=title or None, text=text, tags=tags, category=category)
                    msg = tr(lang2, "updated", title=item["title"])
                else:
                    item = storage.create_prompt(title, text, tags=tags, category=category)
                    msg = tr(lang2, "created", title=item["title"])
                return msg, refresh_list("", item["id"]), item["id"], _library_json_for_client()
            except storage.StorageError as e:
                return f"❌ {e}", gr.update(), pid, _library_json_for_client()

        def do_dup(pid, browser=""):
            lang2 = resolve_lang(load_settings()["language"], browser)
            if not pid:
                return tr(lang2, "need_select"), gr.update(), pid, "", "", "", "", _library_json_for_client()
            try:
                item = storage.duplicate_prompt(pid)
            except storage.StorageError:
                return tr(lang2, "not_found"), gr.update(), "", "", "", "", "", _library_json_for_client()
            return (
                tr(lang2, "duplicated", title=item["title"]),
                refresh_list("", item["id"]),
                item["id"], item["title"], item["text"],
                ", ".join(item.get("tags") or []), item.get("category") or "",
                _library_json_for_client(),
            )

        def do_del(pid, confirm, browser=""):
            lang2 = resolve_lang(load_settings()["language"], browser)
            if not pid:
                return tr(lang2, "need_select"), gr.update(), pid, "", "", "", "", confirm, _library_json_for_client()
            if str(confirm or "").strip().upper() != "DELETE":
                return tr(lang2, "need_confirm"), gr.update(), pid, gr.update(), gr.update(), gr.update(), gr.update(), confirm, _library_json_for_client()
            try:
                storage.delete_prompt(pid)
            except storage.StorageError:
                return tr(lang2, "not_found"), gr.update(), "", "", "", "", "", "", _library_json_for_client()
            return (
                tr(lang2, "deleted"), refresh_list(""), "", "", "", "", "", "", _library_json_for_client(),
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
            outputs=[selected_id, ui["mgr_title"], ui["mgr_text"], ui["mgr_tags"], ui["mgr_category"]],
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
            outputs=[selected_id, ui["mgr_title"], ui["mgr_text"], ui["mgr_tags"], ui["mgr_category"], mgr_status],
            show_progress="hidden",
        )
        ui["mgr_save"].click(
            fn=do_save,
            inputs=[selected_id, ui["mgr_title"], ui["mgr_text"], ui["mgr_tags"], ui["mgr_category"], browser_lang],
            outputs=[mgr_status, ui["mgr_list"], selected_id, library_json],
            show_progress="hidden",
        ).then(fn=None, inputs=[library_json], outputs=None,
               js="(lib) => { if (window.promptLibrary) window.promptLibrary.applyLibrary(lib); }")
        ui["mgr_dup"].click(
            fn=do_dup, inputs=[selected_id, browser_lang],
            outputs=[mgr_status, ui["mgr_list"], selected_id, ui["mgr_title"], ui["mgr_text"], ui["mgr_tags"], ui["mgr_category"], library_json],
            show_progress="hidden",
        ).then(fn=None, inputs=[library_json], outputs=None,
               js="(lib) => { if (window.promptLibrary) window.promptLibrary.applyLibrary(lib); }")
        ui["mgr_del"].click(
            fn=do_del, inputs=[selected_id, ui["mgr_confirm_del"], browser_lang],
            outputs=[mgr_status, ui["mgr_list"], selected_id, ui["mgr_title"], ui["mgr_text"], ui["mgr_tags"], ui["mgr_category"], ui["mgr_confirm_del"], library_json],
            show_progress="hidden",
        ).then(fn=None, inputs=[library_json], outputs=None,
               js="(lib) => { if (window.promptLibrary) window.promptLibrary.applyLibrary(lib); }")
        ui["mgr_import"].click(
            fn=do_import, inputs=[import_box, browser_lang],
            outputs=[mgr_status, ui["mgr_list"], library_json], show_progress="hidden",
        ).then(fn=None, inputs=[library_json], outputs=None,
               js="(lib) => { if (window.promptLibrary) window.promptLibrary.applyLibrary(lib); }")
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

    def _save_from_ui(self, enabled, show_edit, save_btn_near, insert_mode, undo, toasts, toast_s, language, browser_lang):
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
            if action == "save_current":
                return self._action_save_current(tab, req, prompt_val, wizard_val, lang)
            if action == "mark_used":
                pid = req.get("id")
                storage.mark_used(pid)
                return self._pack(tab, {"ok": True, "library": storage.client_payload()}, prompt_val, wizard_val, None, None)
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
            "library": storage.client_payload(),
            "id": req.get("req_id"),
            "tab": tab,
        }
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

    def _action_save_current(self, tab, req, prompt_val, wizard_val, lang):
        field = req.get("field") or "prompt"
        current = prompt_val if field == "prompt" else wizard_val
        # Prefer explicit text from the browser (visible textarea), fall back to Gradio value.
        text = req.get("text")
        if text is None:
            text = current
        text = "" if text is None else str(text)
        title = (req.get("title") or "").strip() or (text.split("\n", 1)[0][:60] if text.strip() else "")
        if not text.strip() and not title:
            return self._pack(tab, {"ok": False, "error": tr(lang, "need_title_or_text")}, prompt_val, wizard_val, None, None)
        tags = req.get("tags")
        category = req.get("category") or ""
        item = storage.create_prompt(title, text, tags=tags, category=category)
        resp = {
            "ok": True,
            "toast": tr(lang, "saved_current", title=item["title"]),
            "item": item,
            "library": storage.client_payload(),
            "id": req.get("req_id"),
        }
        return self._pack(tab, resp, prompt_val, wizard_val, None, None)

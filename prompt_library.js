// Prompt Library __PLIB_VERSION__ - autocomplete prompt templates for WanGP.
// Injected through WanGP's add_custom_js API. Namespaces: window.promptLibrary, CSS .plib-*
(() => {
    if (window.promptLibrary && window.promptLibrary.version) return;
    const VERSION = "__PLIB_VERSION__";
    let cfg = __PLIB_SETTINGS__;
    let library = [];
    let collections = null;          // null = Reference Library not available (all collection UI hidden)
    let collById = new Map();        // id -> {id, name, count}
    let lastRevision = null;
    const log = (...a) => console.log("[Prompt Library]", ...a);
    const I18N = {
        en: {
            search_ph: "Search prompts…",
            no_results: "No matching prompts",
            insert: "Insert",
            undo: "Undo",
            close: "Close",
            vars_title: "Fill template values",
            vars_apply: "Insert",
            tags: "Tags",
            example_hint: "Example prompts can be deleted from the Prompt Library tab.",
            not_ready: "the plugin is not ready (reload the page)",
            no_response: "no response from the server",
            empty_prompt: "the prompt box is empty",
            open_tab: "Open Prompt Library tab",
            manage: "Manage",
            clear: "Clear",
            keys_hint: "↑↓ to move · Enter to insert · Esc to close",
            collections: "Collections",
            coll_linked: "Linked collection: {names}",
            coll_load: "Load collection {name}",
            coll_loading: "Loading collection «{name}»…",
            coll_prompts: "Prompts linked to «{name}»:",
            use_prompt: "Use «{title}»",
            prompt_missing: "Prompt not found in the library",
            save: "Save",
            save_as: "Save as…",
            save_title: "Overwrite “{title}” with the current prompt text",
            save_none_title: "No prompt loaded: save the current text as a new prompt",
            save_as_title: "Save the current text as a new prompt (the loaded one stays unchanged)",
            save_as_head: "Save as new prompt",
            title_label: "Title",
            text_label: "Text (WanGP's current prompt)",
            copy_title: "{title} (copy)",
            st_none: "No prompt loaded",
            st_loaded: "Prompt “{title}” loaded",
            st_modified: "modified",
            st_modified_title: "WanGP's prompt differs from the saved text: Save to update it",
            no_changes: "“{title}” has no changes to save",
            tpl_confirm: "“{title}” is a template with {vars}; the current text has none of them. Overwrite it anyway?",
            overwrite: "Overwrite",
            cancel: "Cancel",
            add_tag: "+ tag",
            add_coll: "+ collection",
            remove: "Remove",
            no_suggestions: "No more collections",
        },
        es: {
            search_ph: "Buscar prompts…",
            no_results: "Ningún prompt coincide",
            insert: "Insertar",
            undo: "Deshacer",
            close: "Cerrar",
            vars_title: "Completa las variables",
            vars_apply: "Insertar",
            tags: "Etiquetas",
            example_hint: "Los prompts de ejemplo se pueden borrar en la pestaña Prompt Library.",
            not_ready: "el plugin no está listo (recarga la página)",
            no_response: "sin respuesta del servidor",
            empty_prompt: "el cuadro de prompt está vacío",
            open_tab: "Abrir pestaña Prompt Library",
            manage: "Gestionar",
            clear: "Borrar",
            keys_hint: "↑↓ para moverte · Enter para insertar · Esc para cerrar",
            collections: "Colecciones",
            coll_linked: "Colección asociada: {names}",
            coll_load: "Cargar colección {name}",
            coll_loading: "Cargando colección «{name}»…",
            coll_prompts: "Prompts asociados a «{name}»:",
            use_prompt: "Usar «{title}»",
            prompt_missing: "No se encontró el prompt en la librería",
            save: "Guardar",
            save_as: "Guardar como…",
            save_title: "Sobrescribir «{title}» con el texto actual del prompt",
            save_none_title: "No hay ningún prompt cargado: guardar el texto actual como prompt nuevo",
            save_as_title: "Guardar el texto actual como prompt nuevo (el cargado no cambia)",
            save_as_head: "Guardar como prompt nuevo",
            title_label: "Título",
            text_label: "Texto (prompt actual de WanGP)",
            copy_title: "{title} (copia)",
            st_none: "Ningún prompt cargado",
            st_loaded: "Prompt «{title}» cargado",
            st_modified: "modificado",
            st_modified_title: "El prompt de WanGP es distinto del texto guardado: pulsa Guardar para actualizarlo",
            no_changes: "«{title}» no tiene cambios que guardar",
            tpl_confirm: "«{title}» es una plantilla con {vars}; el texto actual no tiene ninguna. ¿Sobrescribir igualmente?",
            overwrite: "Sobrescribir",
            cancel: "Cancelar",
            add_tag: "+ etiqueta",
            add_coll: "+ colección",
            remove: "Quitar",
            no_suggestions: "No hay más colecciones",
        },
    };
    const browserLang = () => String(navigator.language || (navigator.languages && navigator.languages[0]) || "");
    const lang = () => (cfg.language === "en" || cfg.language === "es") ? cfg.language
        : (browserLang().toLowerCase().startsWith("es") ? "es" : "en");
    function t(key, params = {}) {
        const table = I18N[lang()] || I18N.en;
        const text = key in table ? table[key] : (I18N.en[key] ?? key);
        return text.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
    }

    // ------------------------------------------------------------------ styles
    // Every colour comes from Gradio's theme variables (so it follows WanGP's dark / light theme and its local
    // overrides). Elements portaled to <body> (dropdown, dialogs) get those variables copied from the bar's own
    // scope by applyTheme(), see below. Namespace: .plib-*
    const style = document.createElement("style");
    style.id = "plib-style";
    style.textContent = `
/* ---- bar under WanGP's prompt: same family as Reference Library's bar (header + status, control row, buttons with
   icons, 36px controls), own .plib-* classes. WanGP studio variables with Gradio fallbacks (dark + light). */
.plib-panel { --plib-h: 36px; --plib-surface: var(--studio-surface, var(--block-background-fill)); --plib-input: var(--studio-input, var(--input-background-fill));
  --plib-bd: var(--studio-border, var(--block-border-color)); --plib-acc: var(--studio-accent, var(--color-accent)); --plib-label: var(--studio-label, var(--body-text-color));
  container: plib-panel / inline-size; gap: 6px !important; padding: 7px 8px 8px !important; margin: 4px 0 2px !important;
  background: var(--plib-surface) !important; border: 0 !important; border-radius: 7px !important; box-shadow: none !important; min-width: 0 !important; overflow: visible !important; }
.plib-bar[data-disabled="1"], .plib-wrap[data-disabled="1"] { display: none !important; }
.plib-panel .row { gap: 6px !important; margin: 0 !important; padding: 0 !important; background: transparent !important; }
.plib-panel .form { border: 0 !important; background: transparent !important; box-shadow: none !important; min-width: 0 !important; gap: 0 !important; }
.plib-panel .plib-bar-head { flex-wrap: nowrap !important; align-items: center !important; min-height: 0 !important; gap: 10px !important; padding: 0 2px !important; }
.plib-panel :is(.plib-bar-titlebox, .plib-bar-status, .plib-bar-meta) { min-height: 0 !important; padding: 0 !important; margin: 0 !important; border: 0 !important; background: transparent !important; }
.plib-panel .plib-bar-titlebox { flex: 0 0 auto !important; width: auto !important; min-width: 0 !important; }
.plib-panel .plib-bar-status { flex: 1 1 0 !important; width: auto !important; min-width: 0 !important; overflow: hidden; }
.plib-panel :is(.plib-bar-titlebox, .plib-bar-status, .plib-bar-meta) > * { min-height: 0 !important; margin: 0 !important; padding: 0 !important; }
.plib-bar-title { display: flex; align-items: center; gap: 6px; white-space: nowrap; line-height: 18px; font-size: var(--text-sm, 12px); font-weight: 600;
  letter-spacing: .02em; color: var(--plib-label); opacity: .85; }
.plib-bar-ico { display: inline-block; width: 14px; height: 14px; flex: 0 0 14px; background: var(--plib-acc);
  -webkit-mask: var(--plib-icon-prompt) center / contain no-repeat; mask: var(--plib-icon-prompt) center / contain no-repeat; }
.plib-bar-status-text { display: flex; justify-content: flex-end; align-items: center; gap: 6px; line-height: 18px; font-size: var(--text-sm, 12px);
  color: var(--body-text-color-subdued); white-space: nowrap; overflow: hidden; min-width: 0; }
.plib-bar-status-text .plib-st-main { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.plib-bar-status-text[data-kind="none"] { opacity: .75; }
.plib-bar-status-text .plib-st-mod { flex: none; display: inline-flex; align-items: center; gap: 5px; font-weight: 600; color: #b45309 !important; }
.dark .plib-bar-status-text .plib-st-mod { color: #fbbf24 !important; }
.plib-st-mod::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
.plib-panel .plib-row { flex-wrap: wrap !important; align-items: stretch !important; }
.plib-panel .plib-ctl { flex: 1000 1 170px !important; min-width: 150px !important; }
.plib-panel .plib-btns { flex: 1 0 auto !important; width: auto !important; min-width: 0 !important; flex-wrap: nowrap !important; align-items: stretch !important; gap: 6px !important; }
.plib-panel .plib-btn { flex: 1 0 auto !important; width: auto !important; min-width: 0 !important; display: inline-flex !important; align-items: center !important;
  justify-content: center !important; gap: 6px !important; height: var(--plib-h) !important; min-height: var(--plib-h) !important; padding: 0 11px !important;
  white-space: nowrap !important; overflow: visible !important; text-overflow: clip !important; font-size: var(--text-md, 14px) !important;
  font-weight: 400 !important; line-height: 1 !important; border-radius: 6px !important; }
.plib-panel .plib-btn[class*="plib-ico-"]::before { content: "" !important; display: block !important; flex: 0 0 14px !important; width: 14px !important; height: 14px !important;
  margin: 0 !important; position: static !important; background: currentColor !important; pointer-events: none;
  -webkit-mask: var(--plib-icon) center / contain no-repeat !important; mask: var(--plib-icon) center / contain no-repeat !important; }
.plib-panel .plib-btn.plib-hide, .plib-fallback .plib-btn.plib-hide { display: none !important; }
.plib-ico-save { --plib-icon: var(--plib-icon-save); } .plib-ico-saveas { --plib-icon: var(--plib-icon-saveas); } .plib-ico-manage { --plib-icon: var(--plib-icon-manage); }
/* Save highlights (primary look) while WanGP's prompt differs from the loaded prompt */
.plib-panel .plib-btn.plib-attn { font-weight: 600 !important; background: var(--button-primary-background-fill) !important; color: var(--button-primary-text-color) !important;
  border-color: var(--button-primary-border-color, transparent) !important; }
.plib-panel .plib-btn.plib-attn:hover { background: var(--button-primary-background-fill-hover, var(--button-primary-background-fill)) !important; }
.plib-panel .plib-ctl:is(.block) :is(input, textarea) { min-height: var(--plib-h) !important; height: var(--plib-h) !important; box-sizing: border-box !important; border-radius: 5px !important;
  background: var(--plib-input) !important; box-shadow: inset 0 0 0 1px var(--plib-bd) !important; border: 0 !important; resize: none !important;
  font-size: var(--text-md, 14px) !important; line-height: 20px !important; padding-top: 8px !important; padding-bottom: 6px !important; overflow: hidden !important; }
.plib-panel .plib-ctl:is(.block) :is(input, textarea):focus { box-shadow: inset 0 0 0 1px var(--plib-acc), 0 0 0 1px var(--plib-acc) !important; }
.plib-panel .plib-ctl label { margin: 0 !important; }
@container plib-panel (max-width: 430px) {
  .plib-panel .plib-row > .plib-btns { flex-wrap: wrap !important; flex-basis: 100% !important; margin-left: 0 !important; }
  .plib-panel .plib-row > .plib-btns > .plib-btn { flex: 1 1 calc(33% - 4px) !important; }
}
/* current prompt details: tags + Reference Library collections (inline chip editors, saved immediately) */
.plib-panel .plib-bar-meta:not(:has(.plib-meta)) { display: none !important; }
.plib-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; padding: 2px 2px 0; min-width: 0; }
.plib-meta-group { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
.plib-meta-label { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-sm, 12px); font-weight: 600; color: var(--plib-label); opacity: .85; white-space: nowrap; }
.plib-meta-label::before { content: ""; width: 14px; height: 14px; flex: 0 0 14px; background: var(--plib-acc);
  -webkit-mask: var(--plib-lab-icon) center / contain no-repeat; mask: var(--plib-lab-icon) center / contain no-repeat; }
.plib-meta-label[data-kind="tags"] { --plib-lab-icon: var(--plib-icon-tag); } .plib-meta-label[data-kind="coll"] { --plib-lab-icon: var(--plib-icon-images); }
/* chip editor (bar details row and the Save as dialog share it) */
.plib-cedit { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
.plib-echip { display: inline-flex; align-items: center; gap: 4px; height: 26px; padding: 0 4px 0 11px; border-radius: 13px; max-width: 100%; min-width: 0;
  font-size: var(--text-sm, 12px); line-height: 1; color: var(--studio-button-text, var(--button-secondary-text-color, var(--plib-fg)));
  background: var(--studio-button, var(--button-secondary-background-fill, var(--plib-chip-bg))); box-shadow: inset 0 0 0 1px var(--plib-bd, var(--plib-border)); }
.plib-echip.plib-echip-coll { box-shadow: inset 0 0 0 1px var(--plib-acc, var(--plib-accent)); font-weight: 600; }
.plib-echip.plib-echip-coll::before { content: ""; width: 11px; height: 11px; flex: none; margin-right: 1px; background: currentColor; opacity: .85;
  -webkit-mask: var(--plib-icon-images) center / contain no-repeat; mask: var(--plib-icon-images) center / contain no-repeat; }
.plib-echip-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.plib-echip-x { all: unset; cursor: pointer; width: 18px; height: 18px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; opacity: .7; flex: none; }
.plib-echip-x:hover, .plib-echip-x:focus-visible { opacity: 1; background: rgba(127,127,127,.25); }
.plib-echip-x svg { width: 9px; height: 9px; }
input.plib-echip-add { all: unset; box-sizing: border-box; height: 26px; width: 118px; padding: 0 10px; border-radius: 13px; font-size: var(--text-sm, 12px);
  color: var(--body-text-color, var(--plib-fg)); background: transparent; box-shadow: inset 0 0 0 1px var(--plib-bd, var(--plib-border)); border: 0; }
input.plib-echip-add::placeholder { color: var(--body-text-color-subdued, var(--plib-subdued)); opacity: 1; }
input.plib-echip-add:focus { box-shadow: inset 0 0 0 1px var(--plib-acc, var(--plib-accent)), 0 0 0 1px var(--plib-acc, var(--plib-accent)); }
.plib-sugg { position: fixed; z-index: 10100; display: none; min-width: 160px; max-width: 320px; max-height: 220px; overflow-y: auto; padding: 4px; box-sizing: border-box;
  border-radius: 8px; background: var(--plib-bg); color: var(--plib-fg); border: 1px solid var(--plib-border); box-shadow: 0 10px 28px rgba(0,0,0,.35);
  font-family: var(--plib-font, inherit); font-size: 13px; }
.plib-sugg.open { display: block; }
.plib-sugg-item { padding: 6px 9px; border-radius: 6px; cursor: pointer; display: flex; justify-content: space-between; gap: 10px; white-space: nowrap; }
.plib-sugg-item.active, .plib-sugg-item:hover { background: var(--plib-active); }
.plib-sugg-item small { color: var(--plib-subdued); }
.plib-sugg-empty { padding: 6px 9px; color: var(--plib-subdued); }
.plib-search-box { position: relative !important; min-width: 0 !important; }
.plib-search-box input, .plib-search-box textarea { padding-left: 30px !important; padding-right: 30px !important; min-height: 34px; box-sizing: border-box; }
.plib-search-box input::placeholder, .plib-search-box textarea::placeholder { color: var(--input-placeholder-color) !important; opacity: 1 !important; }
.plib-search-box::before { content: ""; position: absolute; left: 10px; top: 50%; width: 14px; height: 14px; transform: translateY(-50%);
  pointer-events: none; z-index: 2; background: var(--body-text-color-subdued); opacity: .9;
  -webkit-mask: var(--plib-icon-search) center / contain no-repeat; mask: var(--plib-icon-search) center / contain no-repeat; }
.plib-clear { all: unset; position: absolute; right: 7px; top: 50%; transform: translateY(-50%); z-index: 3; width: 20px; height: 20px;
  border-radius: 50%; display: none; align-items: center; justify-content: center; cursor: pointer; color: var(--body-text-color-subdued); }
.plib-clear:hover { color: var(--body-text-color); background: var(--background-fill-secondary); }
.plib-clear.show { display: flex; }
.plib-clear svg { width: 10px; height: 10px; }
:root { --plib-icon-images: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='3' y='5' width='18' height='14' rx='2' fill='none' stroke='black' stroke-width='2.4'/%3E%3Cpath d='M5 17l5-5 4 4 2-2 3 3' fill='none' stroke='black' stroke-width='2.2' stroke-linejoin='round'/%3E%3Ccircle cx='15.5' cy='9.5' r='1.6' fill='black'/%3E%3C/svg%3E"); }
:root { --plib-icon-prompt: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 5h16v11H9l-5 4V5Z'/%3E%3Cpath d='M8 9h8M8 12h5'/%3E%3C/svg%3E");
  --plib-icon-save: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 3h12l4 4v14H3V3h2Zm2 0v7h10V3M7 21v-7h10v7'/%3E%3C/svg%3E");
  --plib-icon-saveas: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M13 21H3V3h12l4 4v5M7 3v6h8V3M7 21v-6h5M18 15v6M15 18h6'/%3E%3C/svg%3E");
  --plib-icon-manage: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1'/%3E%3Ccircle cx='15' cy='6' r='2'/%3E%3Ccircle cx='9' cy='12' r='2'/%3E%3Ccircle cx='17' cy='18' r='2'/%3E%3C/svg%3E");
  --plib-icon-tag: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 12V3h9l9 9-9 9-9-9Z'/%3E%3Ccircle cx='7.5' cy='7.5' r='1.5' fill='black'/%3E%3C/svg%3E"); }
:root { --plib-icon-search: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='10.5' cy='10.5' r='6.5' fill='none' stroke='black' stroke-width='2.4'/%3E%3Cpath d='M15.5 15.5L21 21' stroke='black' stroke-width='2.6' stroke-linecap='round'/%3E%3C/svg%3E"); }
/* ---- DOM-only fallback bar (only used if the Gradio bar could not be inserted) */
.plib-wrap.plib-fallback { display: flex; gap: 6px; align-items: center; margin: 6px 0; padding: 4px; border-radius: var(--block-radius);
  background: var(--block-background-fill); border: 1px solid var(--block-border-color); }
.plib-fallback { flex-direction: column; align-items: stretch !important; }
.plib-fallback .plib-fb-row { display: flex; gap: 6px; align-items: center; }
.plib-fallback .plib-search-box { flex: 1 1 auto; }
.plib-fallback input { width: 100%; height: 34px; border-radius: var(--input-radius); border: 1px solid var(--input-border-color);
  background: var(--input-background-fill); color: var(--body-text-color); font: inherit; font-size: var(--input-text-size); outline: none; }
.plib-fallback input:focus { border-color: var(--input-border-color-focus); box-shadow: var(--input-shadow-focus); }
.plib-fallback button.plib-btn { all: unset; cursor: pointer; padding: var(--button-small-padding); border-radius: var(--button-small-radius);
  background: var(--button-secondary-background-fill); color: var(--button-secondary-text-color); font-size: var(--button-small-text-size);
  font-weight: var(--button-small-text-weight); white-space: nowrap; min-height: 30px; display: inline-flex; align-items: center; }
.plib-fallback button.plib-btn:hover { background: var(--button-secondary-background-fill-hover); color: var(--button-secondary-text-color-hover); }
/* ---- dropdown: portaled to <body>, position fixed, opaque, above every Gradio block */
.plib-dd { position: fixed; z-index: 9990; display: none; box-sizing: border-box; max-height: min(360px, 50vh); overflow-y: auto;
  overscroll-behavior: contain; padding: 4px; border-radius: var(--plib-radius, 8px);
  background: var(--plib-bg); color: var(--plib-fg); border: 1px solid var(--plib-border);
  box-shadow: 0 10px 28px rgba(0,0,0,.35), 0 2px 6px rgba(0,0,0,.2); font-family: var(--plib-font, inherit); isolation: isolate; }
.plib-dd.open { display: block; }
.plib-item { padding: 8px 10px; border-radius: calc(var(--plib-radius, 8px) - 2px); cursor: pointer; border: 1px solid transparent; }
.plib-item + .plib-item { margin-top: 2px; }
.plib-item:hover { background: var(--plib-hover); }
.plib-item.active { background: var(--plib-active); border-color: var(--plib-accent); }
.plib-item-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0; }
.plib-item-title { font-weight: 600; font-size: 13px; line-height: 1.3; color: var(--plib-fg); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.plib-item-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.plib-chip { font-size: 11px; line-height: 1.5; padding: 0 7px; border-radius: 999px; background: var(--plib-chip-bg); color: var(--plib-subdued);
  border: 1px solid var(--plib-border); white-space: nowrap; }
.plib-chip.plib-coll-chip { color: var(--plib-fg); background: var(--plib-hover); border-color: var(--plib-accent);
  display: inline-flex; align-items: center; gap: 4px; font-weight: 600; }
.plib-coll-chip::before { content: ""; width: 10px; height: 10px; flex: none; background: currentColor; opacity: .85;
  -webkit-mask: var(--plib-icon-images) center / contain no-repeat; mask: var(--plib-icon-images) center / contain no-repeat; }
.plib-item-snip { margin-top: 4px; font-size: 12px; line-height: 1.4; color: var(--plib-subdued); overflow: hidden; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; }
.plib-hl { background: var(--plib-hl-bg); color: var(--plib-fg); border-radius: 3px; padding: 0 1px; font-weight: 600; }
.plib-empty { padding: 10px 12px; color: var(--plib-subdued); font-size: 13px; }
.plib-dd-foot { position: sticky; bottom: -4px; margin: 4px -4px -4px; padding: 5px 10px; font-size: 11px; color: var(--plib-subdued);
  background: var(--plib-bg); border-top: 1px solid var(--plib-border); }
/* ---- toasts (same family as Dragger's, opaque, theme accent) */
.plib-toasts { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 10080;
  display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; max-width: min(92vw, 640px); }
.plib-toast { pointer-events: auto; display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-radius: 10px;
  font: 500 14px/1.35 system-ui, sans-serif; color: #fff; background: var(--color-accent, #2563eb); box-shadow: 0 6px 22px rgba(0,0,0,.35);
  opacity: 1; transition: opacity .3s; white-space: pre-line; }
.plib-toast[data-kind="error"] { background: #b91c1c; }
.plib-toast[data-kind="info"] { background: #1f2937; }
.plib-toast.hiding { opacity: 0; }
.plib-toast button { all: unset; cursor: pointer; padding: 4px 10px; border-radius: 6px; background: rgba(255,255,255,.2); font-weight: 700; white-space: nowrap; }
.plib-toast button:hover { background: rgba(255,255,255,.32); }
.plib-toast[data-kind="offer"] { background: #1f2937; border: 1px solid var(--color-accent, #2563eb); flex-wrap: wrap; justify-content: center; }
.plib-toast[data-kind="offer"] button { background: var(--color-accent, #2563eb); }
.plib-toast[data-kind="offer"] button:hover { filter: brightness(1.12); background: var(--color-accent, #2563eb); }
/* ---- dialogs (template variables, save current) */
.plib-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 10090; display: flex; align-items: center; justify-content: center; }
.plib-modal { background: var(--plib-bg); color: var(--plib-fg); border: 1px solid var(--plib-border); border-radius: var(--plib-radius, 8px);
  padding: 16px 18px; width: min(92vw, 440px); box-shadow: 0 16px 50px rgba(0,0,0,.45); font-family: var(--plib-font, inherit); }
.plib-modal h3 { margin: 0 0 10px; font-size: 15px; font-weight: 700; color: var(--plib-fg); }
.plib-modal label { display: block; font-size: 12px; color: var(--plib-subdued); margin: 10px 0 4px; }
.plib-modal input { width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: var(--plib-input-radius, 6px); border: 1px solid var(--plib-border);
  background: var(--plib-input-bg); color: var(--plib-fg); font: inherit; font-size: 13px; outline: none; }
.plib-modal input:focus { border-color: var(--plib-accent); }
.plib-modal.plib-saveas { width: min(92vw, 520px); }
.plib-modal .plib-cedit { padding: 6px; border-radius: var(--plib-input-radius, 6px); border: 1px solid var(--plib-border); background: var(--plib-input-bg);
  --plib-bd: var(--plib-border); --plib-acc: var(--plib-accent); }
.plib-modal .plib-echip { color: var(--plib-fg); background: var(--plib-chip-bg); }
.plib-modal input.plib-echip-add { width: 130px; height: 26px; padding: 0 10px; border: 0; border-radius: 13px; color: var(--plib-fg); background: transparent;
  box-shadow: inset 0 0 0 1px var(--plib-border); }
.plib-modal input.plib-echip-add:focus { box-shadow: inset 0 0 0 1px var(--plib-accent), 0 0 0 1px var(--plib-accent); }
.plib-saveas-text { max-height: 96px; overflow: auto; padding: 8px 10px; border-radius: var(--plib-input-radius, 6px); border: 1px dashed var(--plib-border);
  font-size: 12px; line-height: 1.45; color: var(--plib-subdued); white-space: pre-wrap; word-break: break-word; }
.plib-modal-text { margin: 0; font-size: 13px; line-height: 1.5; color: var(--plib-fg); }
.plib-modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
.plib-modal-actions button { all: unset; cursor: pointer; padding: 6px 14px; border-radius: var(--plib-btn-radius, 6px); font-size: 13px; font-weight: 600;
  background: var(--plib-primary-bg); color: var(--plib-primary-fg); }
.plib-modal-actions button.plib-secondary { background: var(--plib-secondary-bg); color: var(--plib-secondary-fg); }
.plib-modal-actions button:hover { filter: brightness(1.1); }
/* ---- manager tab */
#plib_mgr_editor .plib-mgr-actions button, #plib_mgr_io_row button { flex: 0 1 auto !important; }
#plib_intro p { margin-bottom: 4px; }
.plib-mgr-filter { align-items: flex-end !important; }
.plib-mgr-filter #plib_mgr_refresh { align-self: flex-end !important; margin: 0 8px 10px 0 !important; min-height: 36px; }
.plib-sec { padding: 8px 12px 2px !important; background: var(--block-background-fill) !important; }
.plib-sec h3 { margin: 0 !important; font-size: 14px !important; font-weight: 600 !important; }
#plib_mgr_status:empty, #plib_status:empty { display: none; }
`;
    document.head.appendChild(style);

    // Resolve Gradio theme variables in the scope of `from` (WanGP overrides some of them locally) and copy them as
    // --plib-* onto `to` (an element portaled to <body>). Colours are resolved to opaque rgb() values.
    function resolveColor(from, expr) {
        const probe = document.createElement("span");
        probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;color:" + expr;
        from.appendChild(probe);
        const c = getComputedStyle(probe).color;
        probe.remove();
        return c;
    }
    function isOpaque(c) {
        const m = String(c).match(/rgba?\(([^)]+)\)/);
        if (!m) return false;
        const parts = m[1].split(/[ ,/]+/).filter(Boolean);
        return parts.length < 4 || parseFloat(parts[3]) >= 0.98;
    }
    function firstOpaque(from, exprs) {
        for (const e of exprs) { const c = resolveColor(from, e); if (isOpaque(c)) return c; }
        return document.documentElement.classList.contains("dark") || document.body.classList.contains("dark") ? "rgb(30, 41, 59)" : "rgb(255, 255, 255)";
    }
    function themeSource() {
        for (const s of mounts.values()) if (s.wrap && s.wrap.isConnected) return s.wrap;
        return document.querySelector(".gradio-container") || document.body;
    }
    function applyTheme(to, from) {
        from = from || themeSource();
        const v = (name, fallback) => {
            const val = getComputedStyle(from).getPropertyValue(name).trim();
            return val || fallback;
        };
        const set = (k, val) => to.style.setProperty(k, val);
        set("--plib-bg", firstOpaque(from, ["var(--block-background-fill)", "var(--background-fill-primary)", "var(--body-background-fill)"]));
        set("--plib-fg", resolveColor(from, "var(--body-text-color)"));
        set("--plib-subdued", resolveColor(from, "color-mix(in srgb, var(--body-text-color) 72%, var(--block-background-fill))"));
        set("--plib-border", resolveColor(from, "var(--border-color-primary)"));
        set("--plib-accent", resolveColor(from, "var(--color-accent)"));
        set("--plib-input-bg", firstOpaque(from, ["var(--input-background-fill)", "var(--background-fill-secondary)", "var(--block-background-fill)"]));
        set("--plib-hover", resolveColor(from, "color-mix(in srgb, var(--color-accent) 12%, transparent)"));
        set("--plib-active", resolveColor(from, "color-mix(in srgb, var(--color-accent) 24%, transparent)"));
        set("--plib-hl-bg", resolveColor(from, "color-mix(in srgb, var(--color-accent) 35%, transparent)"));
        set("--plib-chip-bg", firstOpaque(from, ["var(--background-fill-secondary)", "var(--input-background-fill)", "var(--block-background-fill)"]));
        set("--plib-primary-bg", resolveColor(from, "var(--button-primary-background-fill)"));
        set("--plib-primary-fg", resolveColor(from, "var(--button-primary-text-color)"));
        set("--plib-secondary-bg", resolveColor(from, "var(--button-secondary-background-fill)"));
        set("--plib-secondary-fg", resolveColor(from, "var(--button-secondary-text-color)"));
        set("--plib-radius", v("--radius-lg", "8px"));
        set("--plib-input-radius", v("--input-radius", "6px"));
        set("--plib-btn-radius", v("--button-small-radius", "6px"));
        set("--plib-font", getComputedStyle(from).fontFamily || "inherit");
    }

    // ------------------------------------------------------------------ fold / search (mirrors storage.py)
    function fold(s) {
        return String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    }
    function searchLocal(query, limit = 40) {
        const words = fold(query).split(/\s+/).filter(Boolean);
        const scored = [];
        for (const item of library) {
            const title = fold(item.title);
            const tags = fold((item.tags || []).join(" ") + " " + (item.category || ""));
            const body = fold(item.text);
            const colls = fold(linkedCollections(item).map(c => c.name).join(" "));
            const all = `${title} ${tags} ${colls} ${body}`;
            if (words.length && !words.every(w => all.includes(w))) continue;
            const titleHits = words.reduce((n, w) => n + (title.includes(w) ? 1 : 0), 0);
            const tagHits = words.reduce((n, w) => n + (tags.includes(w) ? 1 : 0), 0);
            const collHits = words.reduce((n, w) => n + (colls.includes(w) ? 1 : 0), 0);
            const bodyHits = words.reduce((n, w) => n + (body.includes(w) ? 1 : 0), 0);
            scored.push({
                rank: [-titleHits * 100 - tagHits * 40 - collHits * 30 - bodyHits * 10, -(item.last_used || 0), -(item.use_count || 0), -(item.updated || 0)],
                item,
            });
        }
        scored.sort((a, b) => {
            for (let i = 0; i < a.rank.length; i++) if (a.rank[i] !== b.rank[i]) return a.rank[i] - b.rank[i];
            return fold(a.item.title).localeCompare(fold(b.item.title));
        });
        return scored.slice(0, limit).map(s => s.item);
    }
    function linkedCollections(item) {
        // Only collections Reference Library lists right now (unknown / trashed ids are ignored, never shown).
        if (!collections || !item || !Array.isArray(item.collections)) return [];
        return item.collections.map(id => collById.get(id)).filter(Boolean);
    }
    function snippet(item, query, maxLen = 110) {
        const text = String(item.text || "").replace(/\n/g, " ").trim();
        if (!text) return "";
        const words = fold(query).split(/\s+/).filter(Boolean);
        const folded = fold(text);
        let idx = -1, hit = "";
        for (const w of words) {
            const pos = folded.indexOf(w);
            if (pos >= 0 && (idx < 0 || pos < idx)) { idx = pos; hit = w; }
        }
        if (idx < 0) return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
        let start = Math.max(0, idx - Math.min(70, Math.floor(maxLen / 3)));
        if (start > 0) { // begin on a word boundary
            const sp = text.slice(start, idx).indexOf(" ");
            if (sp >= 0) start += sp + 1;
        }
        let end = Math.min(text.length, idx + hit.length + maxLen - 40);
        if (end < text.length) { const sp = text.lastIndexOf(" ", end); if (sp > idx + hit.length) end = sp; }
        const chunk = text.slice(start, idx) + "⟦" + text.slice(idx, idx + hit.length) + "⟧" + text.slice(idx + hit.length, end);
        return (start > 0 ? "…" : "") + chunk + (end < text.length ? "…" : "");
    }
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
    function highlightHtml(snip) {
        return escapeHtml(snip).replace(/⟦/g, '<span class="plib-hl">').replace(/⟧/g, "</span>");
    }

    // ------------------------------------------------------------------ toasts
    function ensureToasts() {
        let box = document.querySelector(".plib-toasts");
        if (!box) { box = document.createElement("div"); box.className = "plib-toasts"; document.body.appendChild(box); }
        return box;
    }
    function toast(text, kind, buttons, opts = {}) {
        if (!text) return;
        if (kind !== "error" && cfg.toasts === false && !opts.force) return;
        const el = document.createElement("div");
        el.className = "plib-toast";
        el.dataset.kind = kind || "ok";
        const span = document.createElement("span");
        span.textContent = text;
        el.appendChild(span);
        for (const b of buttons || []) {
            const btn = document.createElement("button");
            btn.textContent = b.label;
            btn.addEventListener("click", () => { try { b.onClick && b.onClick(); } finally { el.remove(); } });
            el.appendChild(btn);
        }
        ensureToasts().appendChild(el);
        const ms = Math.max(opts.minMs || 1000, Math.min(30000, Number(cfg.toast_ms) || 3500));
        setTimeout(() => { el.classList.add("hiding"); setTimeout(() => el.remove(), 350); }, ms);
        return el;
    }

    // ------------------------------------------------------------------ Gradio bridge
    let targets = [];
    const pending = new Map();
    function loadTargets() {
        if (targets.length) return targets;
        const box = document.querySelector("#plib_targets textarea, #plib_targets input");
        if (!box || !box.value) return targets;
        try { targets = JSON.parse(box.value) || []; } catch (_) { targets = []; }
        if (targets.length) log(`v${VERSION}: ${targets.length} prompt fields`, targets.map(t => t.key).join(", "));
        return targets;
    }
    function setText(elemId, value) {
        const root = document.getElementById(elemId);
        if (!root) return false;
        const ta = root.tagName === "TEXTAREA" || root.tagName === "INPUT" ? root : root.querySelector("textarea, input");
        if (!ta) return false;
        const proto = ta.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (setter) setter.call(ta, value); else ta.value = value;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
    }
    function bridgeButton(tab) {
        // Primary button is always registered as `${tab}:prompt` when available.
        return document.getElementById("plib_bridge_" + tab + "_prompt")
            || document.getElementById("plib_bridge_" + tab + "_wizard_prompt");
    }
    function sendBridge(req) {
        req = Object.assign({ req_id: Math.random().toString(16).slice(2), lang: lang() }, req || {});
        const tab = req.tab || "generate";
        req.tab = tab;
        setText("plib_bridge_req", JSON.stringify(req));
        const btn = bridgeButton(tab);
        if (!btn) {
            toast(t("not_ready"), "error");
            return Promise.reject(new Error("bridge missing"));
        }
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                pending.delete(req.req_id);
                reject(new Error(t("no_response")));
            }, 30000);
            pending.set(req.req_id, { resolve, reject, timer });
            btn.click();
        });
    }
    function bridgeResponse(raw) {
        let data = raw;
        if (typeof raw === "string") {
            try { data = JSON.parse(raw); } catch (_) { return; }
        }
        if (!data || typeof data !== "object") return;
        if (data.library) applyLibrary({ prompts: data.library, collections: data.collections, revision: data.revision, change: data.change });
        const entry = data.id != null ? pending.get(data.id) : null;
        if (entry) {
            clearTimeout(entry.timer);
            pending.delete(data.id);
            entry.resolve(data);
        }
        const offer = data.id != null ? offers.get(data.id) : null;
        if (offer) offers.delete(data.id);
        if (data.ok === false) toast(data.error || "error", "error");
        else if (data.toast) {
            const buttons = [];
            if (data.undo_id && cfg.undo !== false) {
                buttons.push({
                    label: t("undo"),
                    onClick: () => sendBridge({ action: "undo", tab: data.tab || activeTab(), undo_id: data.undo_id }).then((r) => {
                        // Undoing an insert also gives back the previously loaded prompt of the bar.
                        const ctx = insertUndo.get(data.undo_id);
                        if (r && r.ok && ctx) { insertUndo.delete(data.undo_id); setCurrent(ctx.tab, ctx.prev); }
                    }).catch(() => {}),
                });
            }
            if (data.save_undo_id) {
                buttons.push({ label: t("undo"), onClick: () => undoSave(data.save_undo_id) });
                toast(data.toast, "ok", buttons, { minMs: 6000 });
                return;
            }
            const linked = offer ? collectionAction(offer) : null;
            if (linked && linked.buttons.length) {
                // "offer": one toast with the insert message, Undo and "Load collection X" (kept on screen longer).
                toast(data.toast + "\n" + linked.text, "offer", buttons.concat(linked.buttons), { force: true, minMs: 9000 });
            } else {
                toast(data.toast, "ok", buttons);
            }
        }
    }

    // ------------------------------------------------------------------ Reference Library link
    const offers = new Map(); // req_id -> picked item (collection offer after the insert succeeds)
    function applyCollection(c) {
        // Contract: Reference Library listens for this and loads the collection into Reference Images.
        window.dispatchEvent(new CustomEvent("reflib:apply", { detail: { id: c.id } }));
    }
    function collectionAction(item) {
        const linked = linkedCollections(item);
        const mode = cfg.on_pick_collection || "offer";
        if (!linked.length || mode === "none") return null;
        if (mode === "auto") {
            applyCollection(linked[0]);
            toast(t("coll_loading", { name: linked[0].name }), "info");
            return null;
        }
        return {
            text: t("coll_linked", { names: linked.map(c => c.name).join(", ") }),
            buttons: linked.slice(0, 3).map(c => ({ label: t("coll_load", { name: c.name }), onClick: () => applyCollection(c) })),
        };
    }
    async function applyPromptById(id, opts = {}) {
        // Used by the promptlib:apply event (Reference Library offering a linked prompt) and by our own offers.
        let item = library.find(p => p.id === id);
        if (!item) { await syncLibrary(); item = library.find(p => p.id === id); }
        if (!item) { toast(t("prompt_missing"), "error"); return false; }
        let vars = null;
        if (item.vars && item.vars.length) {
            vars = await askVariables(item);
            if (vars === null) return false;
        }
        const tab = opts.tab || activeTab();
        const mode = ["replace", "append", "cursor"].includes(opts.mode) ? opts.mode : (cfg.insert_mode || "replace");
        const reqId = Math.random().toString(16).slice(2);
        if (opts.offerCollections) offers.set(reqId, item);
        try {
            const r = await sendBridge({
                req_id: reqId, action: "insert", tab, field: fieldOf(visiblePromptRoot(tab)), id: item.id, mode,
                cursor: mode === "cursor" ? cursorOf(tab) : null, current: readPromptValue(tab), vars: vars || undefined,
            });
            if (r && r.ok) {
                loadedFrom(tab, item, r);
                window.dispatchEvent(new CustomEvent("promptlib:applied", { detail: { id: item.id, title: item.title, source: opts.source || null } }));
            }
            return !!(r && r.ok);
        } catch (e) {
            offers.delete(reqId);
            toast(String(e.message || e), "error");
            return false;
        }
    }
    window.addEventListener("promptlib:apply", (e) => {
        const d = (e && e.detail) || {};
        if (!d.id) return;
        // Coming from Reference Library: do not offer to load a collection back (it was just loaded).
        applyPromptById(String(d.id), { mode: d.mode, source: d.source || "event", offerCollections: d.offerCollections === true });
    });
    window.addEventListener("reflib:applied", (e) => {
        const d = (e && e.detail) || {};
        if (!d.id || cfg.on_reflib_applied !== "offer" || !collections) return; // default "none": Reference Library offers
        const linked = library.filter(p => Array.isArray(p.collections) && p.collections.includes(d.id));
        if (!linked.length) return;
        const name = d.name || (collById.get(d.id) || {}).name || "";
        toast(t("coll_prompts", { name }), "offer",
            linked.slice(0, 3).map(p => ({ label: t("use_prompt", { title: p.title }), onClick: () => applyPromptById(p.id, { source: "reflib-offer" }) })),
            { force: true, minMs: 9000 });
    });
    let reflibTimer = null;
    // Any reason (create / rename / delete / images / restore / duplicate / future ones): just re-fetch names.
    window.addEventListener("reflib:changed", () => {
        clearTimeout(reflibTimer);
        reflibTimer = setTimeout(() => { const b = document.getElementById("plib_reflib_refresh"); if (b) b.click(); }, 250);
    });
    function syncLibrary() {
        return new Promise((resolve) => {
            const b = document.getElementById("plib_sync");
            if (!b) return resolve();
            const before = lastRevision;
            b.click();
            let n = 0;
            const iv = setInterval(() => { if (lastRevision !== before || ++n > 20) { clearInterval(iv); resolve(); } }, 100);
        });
    }
    function onRevision(raw) {
        const rev = Number(raw);
        if (!Number.isFinite(rev) || rev === lastRevision) return;
        const b = document.getElementById("plib_sync");
        if (b) b.click();
    }

    // ------------------------------------------------------------------ prompt field discovery
    function activeTab() {
        // Edit tab content has elem_id edit-tab-content when visible.
        const edit = document.getElementById("edit-tab-content");
        if (edit) {
            const r = edit.getBoundingClientRect();
            if (r.width > 4 && r.height > 4) return "edit";
        }
        return "generate";
    }
    function visiblePromptRoot(tab) {
        const advanced = document.getElementById("wangp-prompt-advanced");
        const wizard = document.getElementById("wangp-prompt-wizard");
        const prefer = (el) => {
            if (!el || !el.isConnected) return null;
            // Prefer the one that is actually shown (Gradio hides with display/visibility or zero size).
            const r = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden" || r.width < 2 || r.height < 2) return null;
            // Scope to edit tab when needed
            if (tab === "edit") {
                if (!el.closest("#edit-tab-content") && !el.closest('[id*="edit"]')) {
                    // Still accept if only one exists on page
                }
            }
            return el;
        };
        // When edit tab is active, prefer prompts inside it.
        if (tab === "edit") {
            const scope = document.getElementById("edit-tab-content") || document;
            const a = scope.querySelector ? scope.querySelector("#wangp-prompt-advanced") : null;
            const w = scope.querySelector ? scope.querySelector("#wangp-prompt-wizard") : null;
            return prefer(a) || prefer(w) || prefer(advanced) || prefer(wizard);
        }
        return prefer(advanced) || prefer(wizard);
    }
    function fieldOf(root) {
        if (!root) return "prompt";
        const id = root.id || "";
        if (id.includes("wizard")) return "wizard_prompt";
        return "prompt";
    }
    function textareaOf(root) {
        if (!root) return null;
        if (root.tagName === "TEXTAREA") return root;
        return root.querySelector("textarea");
    }
    function readPromptValue(tab) {
        const root = visiblePromptRoot(tab);
        const ta = textareaOf(root);
        return ta ? ta.value : "";
    }
    function cursorOf(tab) {
        const ta = textareaOf(visiblePromptRoot(tab));
        if (!ta) return null;
        try { return typeof ta.selectionStart === "number" ? ta.selectionStart : null; } catch (_) { return null; }
    }

    // ------------------------------------------------------------------ autocomplete UI
    // The bar is a real Gradio Group (#plib_bar_<tab>) built by plugin.py right after WanGP's prompt column:
    // a Textbox (#plib_search_<tab>) + two small secondary Buttons. If it is missing (insertion failed) a DOM-only
    // fallback bar is created under the visible prompt. The result list is portaled to <body> (position: fixed)
    // so it is never clipped or painted under the Gradio blocks that follow the prompt.
    const mounts = new Map(); // tab -> { wrap, input, dd, saveBtn, manageBtn, clearBtn, activeIdx, results }
    const X_SVG = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/></svg>';
    function setInputValue(input, value) {
        const proto = input.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        if (setter) setter.call(input, value); else input.value = value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    function buildFallbackBar(tab) {
        const root = visiblePromptRoot(tab);
        if (!root) return null;
        const stack = root.closest(".wangp-prompt-tools-stack") || root.parentElement || root;
        const wrap = document.createElement("div");
        wrap.className = "plib-wrap plib-fallback";
        wrap.innerHTML = `<div class="plib-fb-row"><div class="plib-search-box"><input type="text" autocomplete="off" spellcheck="false" /></div>
          <button type="button" class="plib-btn plib-save-btn"></button><button type="button" class="plib-btn plib-saveas-btn"></button>
          <button type="button" class="plib-btn plib-manage-btn"></button></div><div class="plib-fb-status"></div><div class="plib-fb-meta"></div>`;
        stack.parentElement.insertBefore(wrap, stack.nextSibling);
        return wrap;
    }
    function ensureMount(tab) {
        const existing = mounts.get(tab);
        if (existing && existing.input.isConnected) return existing;
        if (existing) { existing.dd.remove(); mounts.delete(tab); }
        let wrap = document.getElementById("plib_bar_" + tab);
        let input = wrap && wrap.querySelector("#plib_search_" + tab + " input, #plib_search_" + tab + " textarea");
        if (!wrap || !input) {
            wrap = document.querySelector('.plib-fallback[data-tab="' + tab + '"]') || buildFallbackBar(tab);
            if (!wrap) return null;
            input = wrap.querySelector("input");
        }
        wrap.classList.add("plib-wrap");
        wrap.dataset.tab = tab;
        input.classList.add("plib-q");
        input.setAttribute("autocomplete", "off");
        input.setAttribute("spellcheck", "false");
        input.setAttribute("role", "combobox");
        input.setAttribute("aria-autocomplete", "list");
        const box = input.closest(".plib-search-box") || input.parentElement;
        box.classList.add("plib-search-box");
        let clearBtn = box.querySelector(".plib-clear");
        if (!clearBtn) {
            clearBtn = document.createElement("button");
            clearBtn.type = "button";
            clearBtn.className = "plib-clear";
            clearBtn.innerHTML = X_SVG;
            box.appendChild(clearBtn);
        }
        const saveBtn = wrap.querySelector(".plib-save-btn");
        const saveAsBtn = wrap.querySelector(".plib-saveas-btn");
        const manageBtn = wrap.querySelector(".plib-manage-btn");
        const dd = document.createElement("div");
        dd.className = "plib-dd";
        dd.dataset.tab = tab;
        dd.setAttribute("role", "listbox");
        document.body.appendChild(dd);
        const state = { tab, wrap, input, dd, saveBtn, saveAsBtn, manageBtn, clearBtn, activeIdx: -1, results: [] };
        mounts.set(tab, state);
        relabel(state);
        const syncClear = () => clearBtn.classList.toggle("show", !!input.value);
        input.addEventListener("input", () => { syncClear(); if (!state.silent) renderDropdown(state); });
        input.addEventListener("focus", () => { if (input.value || library.length) renderDropdown(state); });
        input.addEventListener("keydown", (e) => onKey(state, e));
        input.addEventListener("keyup", (e) => { if (e.key === "Escape") { e.preventDefault(); closeDropdown(state); } });
        input.addEventListener("blur", () => setTimeout(() => {
            if (!dd.matches(":hover") && document.activeElement !== input) closeDropdown(state);
        }, 180));
        clearBtn.addEventListener("mousedown", (e) => e.preventDefault());
        clearBtn.addEventListener("click", () => { setInputValue(input, ""); syncClear(); input.focus(); renderDropdown(state); });
        if (saveBtn) saveBtn.addEventListener("click", () => onSave(tab));
        if (saveAsBtn) saveAsBtn.addEventListener("click", () => onSaveAs(tab));
        if (manageBtn) manageBtn.addEventListener("click", openManageTab);
        dd.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus in the input
        syncClear();
        updateBar(tab, true);
        return state;
    }
    // One set of global listeners for all mounts (Esc in capture phase, outside click, reposition on scroll/resize).
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        for (const s of mounts.values()) if (s.dd.classList.contains("open")) closeDropdown(s);
    }, true);
    document.addEventListener("mousedown", (e) => {
        for (const s of mounts.values()) if (!s.wrap.contains(e.target) && !s.dd.contains(e.target)) closeDropdown(s);
    }, true);
    const repositionAll = () => { for (const s of mounts.values()) if (s.dd.classList.contains("open")) position(s); };
    window.addEventListener("scroll", repositionAll, true);
    window.addEventListener("resize", repositionAll);
    function position(state) {
        const anchor = state.input.closest(".plib-bar-row") || state.input.closest(".plib-wrap") || state.input;
        const r = anchor.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) { closeDropdown(state); return; }
        const gap = 4;
        const below = innerHeight - r.bottom - gap - 8;
        const above = r.top - gap - 8;
        const want = Math.min(360, innerHeight * 0.5);
        const dd = state.dd;
        dd.style.left = Math.max(8, r.left) + "px";
        dd.style.width = Math.min(r.width, innerWidth - 16) + "px";
        if (below >= Math.min(want, 180) || below >= above) {
            dd.style.top = (r.bottom + gap) + "px"; dd.style.bottom = "auto";
            dd.style.maxHeight = Math.max(120, Math.min(want, below)) + "px";
        } else {
            dd.style.top = "auto"; dd.style.bottom = (innerHeight - r.top + gap) + "px";
            dd.style.maxHeight = Math.max(120, Math.min(want, above)) + "px";
        }
    }
    function relabel(state) {
        if (!state) return;
        state.input.placeholder = t("search_ph");
        const hideSave = cfg.save_current_button === false;
        if (state.saveBtn) { state.saveBtn.textContent = t("save"); state.saveBtn.classList.toggle("plib-hide", hideSave); }
        if (state.saveAsBtn) { state.saveAsBtn.textContent = t("save_as"); state.saveAsBtn.title = t("save_as_title"); state.saveAsBtn.classList.toggle("plib-hide", hideSave); }
        state.statusHtml = null; state.metaSig = null;
        updateBar(state.tab, true);
        if (state.manageBtn) { state.manageBtn.textContent = t("manage"); state.manageBtn.title = t("open_tab"); }
        state.clearBtn && (state.clearBtn.title = t("clear"));
    }
    function openDropdown(state) {
        applyTheme(state.dd, state.wrap);
        state.dd.classList.add("open");
        state.input.setAttribute("aria-expanded", "true");
        position(state);
    }
    function renderDropdown(state) {
        const q = state.input.value;
        const results = searchLocal(q, 40);
        state.results = results;
        state.activeIdx = results.length ? 0 : -1;
        if (!q.trim() && !results.length) { closeDropdown(state); state.dd.innerHTML = ""; return; }
        if (!results.length) {
            state.dd.innerHTML = `<div class="plib-empty">${escapeHtml(t("no_results"))}</div>`;
            openDropdown(state);
            return;
        }
        state.dd.innerHTML = results.map((item, i) => {
            const chips = linkedCollections(item).slice(0, 4).map(c => `<span class="plib-chip plib-coll-chip" title="${escapeHtml(t("collections"))}">${escapeHtml(c.name)}</span>`).join("")
                + (item.tags || []).slice(0, 8).map(tag => `<span class="plib-chip">${escapeHtml(tag)}</span>`).join("");
            const snip = highlightHtml(snippet(item, q, 220));
            return `<div class="plib-item${i === state.activeIdx ? " active" : ""}" data-i="${i}" role="option" title="${escapeHtml(item.title)}">
              <div class="plib-item-head"><div class="plib-item-title">${highlightHtml(titleHl(item.title, q))}</div></div>
              ${chips ? `<div class="plib-item-tags" aria-label="${escapeHtml(t("tags"))}">${chips}</div>` : ""}
              ${snip ? `<div class="plib-item-snip">${snip}</div>` : ""}
            </div>`;
        }).join("") + `<div class="plib-dd-foot">${escapeHtml(t("keys_hint"))}</div>`;
        state.dd.querySelectorAll(".plib-item").forEach(el => {
            el.addEventListener("mousedown", (e) => { e.preventDefault(); pick(state, Number(el.dataset.i)); });
            el.addEventListener("mousemove", () => {
                const i = Number(el.dataset.i);
                if (i !== state.activeIdx) { state.activeIdx = i; syncActive(state, false); }
            });
        });
        openDropdown(state);
    }
    function titleHl(title, q) {
        // mark the first matching query word in the title (accent-insensitive)
        const words = fold(q).split(/\s+/).filter(Boolean);
        const folded = fold(title);
        for (const w of words) {
            const i = folded.indexOf(w);
            if (i >= 0) return title.slice(0, i) + "⟦" + title.slice(i, i + w.length) + "⟧" + title.slice(i + w.length);
        }
        return title;
    }
    function onKey(state, e) {
        if (!state.dd.classList.contains("open") && (e.key === "ArrowDown" || e.key === "Enter")) {
            renderDropdown(state);
        }
        const n = state.results.length;
        if (e.key === "ArrowDown" && n) {
            e.preventDefault();
            state.activeIdx = (state.activeIdx + 1) % n;
            syncActive(state);
        } else if (e.key === "ArrowUp" && n) {
            e.preventDefault();
            state.activeIdx = (state.activeIdx - 1 + n) % n;
            syncActive(state);
        } else if (e.key === "Enter" && n && state.activeIdx >= 0 && state.dd.classList.contains("open")) {
            e.preventDefault(); e.stopPropagation();
            pick(state, state.activeIdx);
        } else if (e.key === "Escape") {
            e.preventDefault(); e.stopPropagation();
            closeDropdown(state);
        }
    }
    function closeDropdown(state) {
        if (!state) return;
        state.dd.classList.remove("open");
        state.input.setAttribute("aria-expanded", "false");
        state.activeIdx = -1;
    }
    function syncActive(state, scroll = true) {
        state.dd.querySelectorAll(".plib-item").forEach((el, i) => {
            el.classList.toggle("active", i === state.activeIdx);
            el.setAttribute("aria-selected", i === state.activeIdx ? "true" : "false");
            if (scroll && i === state.activeIdx) el.scrollIntoView({ block: "nearest" });
        });
    }
    async function pick(state, index) {
        const item = state.results[index];
        if (!item) return;
        closeDropdown(state);
        state.silent = true;
        try { setInputValue(state.input, ""); } finally { state.silent = false; }
        state.clearBtn && state.clearBtn.classList.remove("show");
        const tab = state.wrap.dataset.tab || activeTab();
        let vars = null;
        if (item.vars && item.vars.length) {
            vars = await askVariables(item);
            if (vars === null) return; // cancelled
        }
        const mode = cfg.insert_mode || "replace";
        const field = fieldOf(visiblePromptRoot(tab));
        const reqId = Math.random().toString(16).slice(2);
        offers.set(reqId, item);
        try {
            const r = await sendBridge({
                req_id: reqId,
                action: "insert",
                tab,
                field,
                id: item.id,
                mode,
                cursor: mode === "cursor" ? cursorOf(tab) : null,
                current: readPromptValue(tab),
                vars: vars || undefined,
            });
            if (r && r.ok) loadedFrom(tab, item, r);
        } catch (e) {
            offers.delete(reqId);
            toast(String(e.message || e), "error");
        }
    }
    function askVariables(item) {
        return new Promise((resolve) => {
            const bg = document.createElement("div");
            bg.className = "plib-modal-bg";
            const modal = document.createElement("div");
            modal.className = "plib-modal";
            modal.innerHTML = `<h3>${escapeHtml(t("vars_title"))}</h3>`;
            const inputs = {};
            for (const name of item.vars) {
                const lab = document.createElement("label");
                lab.textContent = "{" + name + "}";
                const inp = document.createElement("input");
                inp.dataset.var = name;
                inputs[name] = inp;
                modal.appendChild(lab);
                modal.appendChild(inp);
            }
            const actions = document.createElement("div");
            actions.className = "plib-modal-actions";
            const cancel = document.createElement("button");
            cancel.className = "plib-secondary";
            cancel.textContent = t("close");
            const ok = document.createElement("button");
            ok.textContent = t("vars_apply");
            actions.appendChild(cancel);
            actions.appendChild(ok);
            modal.appendChild(actions);
            bg.appendChild(modal);
            applyTheme(modal);
            document.body.appendChild(bg);
            const first = modal.querySelector("input");
            if (first) first.focus();
            const done = (val) => { bg.remove(); resolve(val); };
            cancel.addEventListener("click", () => done(null));
            bg.addEventListener("click", (e) => { if (e.target === bg) done(null); });
            ok.addEventListener("click", () => {
                const out = {};
                for (const name of item.vars) out[name] = inputs[name].value;
                done(out);
            });
            modal.addEventListener("keydown", (e) => {
                if (e.key === "Enter") { e.preventDefault(); ok.click(); }
                if (e.key === "Escape") done(null);
            });
        });
    }
    // ------------------------------------------------------------------ current prompt (per tab, per browser session)
    // The bar remembers which library prompt is loaded in WanGP's prompt (picked from the autocomplete or applied
    // through promptlib:apply), shows it in its header and compares WanGP's text with the saved one ("modified").
    const current = new Map();       // tab -> { id, rendered }  (rendered: text with template values applied, else null)
    const insertUndo = new Map();    // insert undo_id -> { tab, prev }
    const saveUndoCtx = new Map();   // save undo id -> { tab, prev }
    const SS_KEY = (tab) => "plib.current." + tab;
    function getCurrent(tab) {
        if (!current.has(tab)) {
            let v = null;
            try { v = JSON.parse(sessionStorage.getItem(SS_KEY(tab)) || "null"); } catch (_) { v = null; }
            current.set(tab, v && typeof v.id === "string" ? { id: v.id, rendered: typeof v.rendered === "string" ? v.rendered : null } : null);
        }
        return current.get(tab);
    }
    function setCurrent(tab, cur) {
        cur = cur && cur.id ? { id: String(cur.id), rendered: typeof cur.rendered === "string" ? cur.rendered : null } : null;
        current.set(tab, cur);
        try { cur ? sessionStorage.setItem(SS_KEY(tab), JSON.stringify(cur)) : sessionStorage.removeItem(SS_KEY(tab)); } catch (_) {}
        updateBar(tab, true);
        setTimeout(() => updateBar(tab), 350); // Gradio may apply the new prompt value a moment later
    }
    function loadedFrom(tab, item, r) {
        const prev = getCurrent(tab);
        if (r.undo_id) insertUndo.set(r.undo_id, { tab, prev });
        setCurrent(tab, { id: item.id, rendered: item.vars && item.vars.length && typeof r.text === "string" ? r.text : null });
    }
    function currentItem(tab) {
        const c = getCurrent(tab);
        return c ? library.find(p => p.id === c.id) || null : null;
    }
    const normText = (v) => String(v == null ? "" : v).replace(/\r\n/g, "\n").replace(/\s+$/, "");
    function isModified(tab) {
        const c = getCurrent(tab), item = currentItem(tab);
        if (!item) return false;
        return normText(readPromptValue(tab)) !== normText(c.rendered != null ? c.rendered : item.text);
    }
    function statusEl(state) {
        const el = document.getElementById("plib_bar_status_" + state.tab) || state.wrap.querySelector(".plib-fb-status");
        return el ? (el.querySelector(".prose") || el) : null;
    }
    function metaEl(state) {
        const el = document.getElementById("plib_bar_meta_" + state.tab) || state.wrap.querySelector(".plib-fb-meta");
        return el ? (el.querySelector(".prose") || el) : null;
    }
    function updateBar(tab, force) {
        const state = mounts.get(tab);
        if (!state || !state.wrap.isConnected) return;
        const item = currentItem(tab);
        const modified = !!item && isModified(tab);
        // header status
        const st = statusEl(state);
        if (st) {
            let html;
            if (!item) html = `<div class="plib-bar-status-text" data-kind="none"><span class="plib-st-main">${escapeHtml(t("st_none"))}</span></div>`;
            else {
                const main = t("st_loaded", { title: item.title });
                html = `<div class="plib-bar-status-text" data-kind="${modified ? "modified" : "ok"}" title="${escapeHtml(main)}">`
                    + `<span class="plib-st-main">${escapeHtml(main)}</span>`
                    + (modified ? `<span class="plib-st-mod" title="${escapeHtml(t("st_modified_title"))}">${escapeHtml(t("st_modified"))}</span>` : "")
                    + `</div>`;
            }
            if (force || state.statusHtml !== html || st.innerHTML !== html) { st.innerHTML = html; state.statusHtml = html; }
        }
        state.wrap.dataset.current = item ? item.id : "";
        state.wrap.dataset.modified = modified ? "1" : "0";
        if (state.saveBtn) {
            state.saveBtn.classList.toggle("plib-attn", modified);
            state.saveBtn.title = item ? t("save_title", { title: item.title }) : t("save_none_title");
        }
        renderMeta(state, item, force);
    }
    function updateAllBars() { for (const tab of mounts.keys()) updateBar(tab); }
    document.addEventListener("input", (e) => {
        const el = e.target;
        if (el && el.closest && el.closest("#wangp-prompt-advanced, #wangp-prompt-wizard")) {
            clearTimeout(updateAllBars._t);
            updateAllBars._t = setTimeout(updateAllBars, 120);
        }
    }, true);

    // ---- details row: tags + collections of the current prompt, edited inline and saved immediately (with Undo)
    function visibleLinks(item) { return linkedCollections(item).map(c => c.id); }
    function metaSig(item) {
        return item ? JSON.stringify([item.id, item.tags || [], collections ? visibleLinks(item) : null, lang()]) : "";
    }
    function renderMeta(state, item, force) {
        const box = metaEl(state);
        if (!box) return;
        const sig = metaSig(item);
        if (!force && sig === state.metaSig && box.isConnected && (sig === "" || box.querySelector(".plib-meta"))) return;
        state.metaSig = sig;
        const focused = document.activeElement && box.contains(document.activeElement) ? document.activeElement.dataset.kind : null;
        (state.editors || []).forEach(ed => ed.destroy());
        state.editors = [];
        box.innerHTML = "";
        if (!item) return;
        const row = document.createElement("div");
        row.className = "plib-meta";
        const group = (kind, label, editor) => {
            const g = document.createElement("div");
            g.className = "plib-meta-group";
            g.dataset.kind = kind;
            const l = document.createElement("span");
            l.className = "plib-meta-label";
            l.dataset.kind = kind;
            l.textContent = label;
            g.append(l, editor.el);
            row.appendChild(g);
            state.editors.push(editor);
        };
        const id = item.id;
        group("tags", t("tags"), chipEditor({
            kind: "tags", values: item.tags || [], placeholder: t("add_tag"), allowFree: true, suggest: tagSuggestions,
            onChange: (vals) => { state.metaSig = metaSig(Object.assign({}, item, { tags: vals })); saveMeta(state.tab, id, { tags: vals }); },
        }));
        if (collections) {
            group("coll", t("collections"), chipEditor({
                kind: "coll", values: visibleLinks(item), placeholder: t("add_coll"), allowFree: false, suggest: collSuggestions,
                labelOf: (v) => (collById.get(v) || {}).name || v, emptyText: t("no_suggestions"),
                onChange: (vals) => {
                    state.metaSig = metaSig(Object.assign({}, item, { collections: vals.concat((item.collections || []).filter(c => !collById.has(c))) }));
                    saveMeta(state.tab, id, { collections: vals });
                },
            }));
        }
        box.appendChild(row);
        if (focused) { const inp = box.querySelector(`input.plib-echip-add[data-kind="${focused}"]`); if (inp) inp.focus(); }
    }
    async function saveMeta(tab, id, fields) {
        try { await sendBridge(Object.assign({ action: "set_meta", tab, id }, fields)); }
        catch (e) { toast(String(e.message || e), "error"); }
        updateBar(tab, true);
    }
    function tagSuggestions(query, have) {
        const counts = new Map();
        for (const p of library) for (const tag of p.tags || []) {
            const k = fold(tag);
            const e = counts.get(k) || { value: tag, n: 0 };
            e.n++; counts.set(k, e);
        }
        const q = fold(query).trim(), haveF = new Set(have.map(fold));
        return [...counts.entries()].filter(([k]) => !haveF.has(k) && (!q || k.includes(q)))
            .sort((a, b) => (q ? (b[0].startsWith(q) - a[0].startsWith(q)) : 0) || b[1].n - a[1].n || a[0].localeCompare(b[0]))
            .slice(0, 8).map(([, e]) => ({ value: e.value, label: e.value, hint: String(e.n) }));
    }
    function collSuggestions(query, have) {
        const q = fold(query).trim();
        return (collections || []).filter(c => !have.includes(c.id) && (!q || fold(c.name).includes(q)))
            .slice(0, 12).map(c => ({ value: c.id, label: c.name, hint: c.count != null ? String(c.count) : "" }));
    }
    function chipEditor(opts) {
        // values: strings; suggest(query, values) -> [{value, label, hint}]; allowFree: typed text becomes a value.
        const root = document.createElement("div");
        root.className = "plib-cedit";
        root.dataset.kind = opts.kind;
        let vals = [...(opts.values || [])];
        const labelOf = opts.labelOf || ((v) => v);
        const input = document.createElement("input");
        input.className = "plib-echip-add";
        input.dataset.kind = opts.kind;
        input.placeholder = opts.placeholder || "";
        input.setAttribute("autocomplete", "off");
        input.setAttribute("spellcheck", "false");
        root.appendChild(input);
        const pop = document.createElement("div");
        pop.className = "plib-sugg";
        pop.dataset.kind = opts.kind;
        let sugg = [], active = -1;
        const emit = () => { if (opts.onChange) opts.onChange([...vals]); };
        function render() {
            root.querySelectorAll(".plib-echip").forEach(n => n.remove());
            for (const v of vals) {
                const chip = document.createElement("span");
                chip.className = "plib-echip" + (opts.kind === "coll" ? " plib-echip-coll" : "");
                chip.dataset.value = v;
                const tx = document.createElement("span");
                tx.className = "plib-echip-text";
                tx.textContent = labelOf(v);
                const x = document.createElement("button");
                x.type = "button";
                x.className = "plib-echip-x";
                x.title = t("remove") + " " + labelOf(v);
                x.setAttribute("aria-label", x.title);
                x.innerHTML = X_SVG;
                x.addEventListener("click", (e) => { e.preventDefault(); vals = vals.filter(o => o !== v); render(); emit(); });
                chip.append(tx, x);
                root.insertBefore(chip, input);
            }
        }
        function add(v) {
            v = String(v || "").trim();
            if (!v || vals.some(o => fold(o) === fold(v))) { input.value = ""; return; }
            vals.push(v); input.value = ""; render(); emit();
            if (document.activeElement === input) show();
        }
        function show() {
            sugg = opts.suggest ? opts.suggest(input.value, vals) : [];
            active = opts.allowFree ? -1 : (sugg.length ? 0 : -1);
            if (!sugg.length && !(opts.emptyText && !opts.allowFree)) { hide(); return; }
            pop.innerHTML = sugg.length ? sugg.map((s2, i) => `<div class="plib-sugg-item${i === active ? " active" : ""}" data-i="${i}">`
                + `<span>${escapeHtml(s2.label)}</span>${s2.hint ? `<small>${escapeHtml(s2.hint)}</small>` : ""}</div>`).join("")
                : `<div class="plib-sugg-empty">${escapeHtml(opts.emptyText)}</div>`;
            pop.querySelectorAll(".plib-sugg-item").forEach(el => el.addEventListener("mousedown", (e) => { e.preventDefault(); add(sugg[Number(el.dataset.i)].value); }));
            if (!pop.isConnected) document.body.appendChild(pop);
            applyTheme(pop);
            const r = input.getBoundingClientRect();
            pop.style.left = Math.max(8, Math.min(r.left, innerWidth - 330)) + "px";
            pop.style.top = (r.bottom + 4) + "px";
            pop.classList.add("open");
        }
        function hide() { pop.classList.remove("open"); active = -1; }
        function mark() { pop.querySelectorAll(".plib-sugg-item").forEach((el, i) => el.classList.toggle("active", i === active)); }
        input.addEventListener("focus", show);
        input.addEventListener("input", show);
        input.addEventListener("blur", () => setTimeout(hide, 120));
        input.addEventListener("keydown", (e) => {
            if (e.key === "ArrowDown" && sugg.length) { e.preventDefault(); active = (active + 1) % sugg.length; mark(); }
            else if (e.key === "ArrowUp" && sugg.length) { e.preventDefault(); active = (active - 1 + sugg.length) % sugg.length; mark(); }
            else if (e.key === "Enter" || (e.key === "," && opts.allowFree)) {
                e.preventDefault(); e.stopPropagation();
                if (active >= 0 && sugg[active]) add(sugg[active].value);
                else if (opts.allowFree) add(input.value.replace(/,/g, " "));
            } else if (e.key === "Escape") { if (pop.classList.contains("open")) { e.stopPropagation(); hide(); } }
        });
        render();
        return { el: root, get: () => [...vals], destroy: () => pop.remove() };
    }

    // ---- Save (overwrite the loaded prompt) / Save as… (new prompt, becomes the current one)
    async function onSave(tab) {
        const item = currentItem(tab);
        if (!item) return onSaveAs(tab);
        const text = readPromptValue(tab);
        if (!String(text || "").trim()) { toast(t("empty_prompt"), "error"); return; }
        if (!isModified(tab)) { toast(t("no_changes", { title: item.title }), "info"); return; }
        if (item.vars && item.vars.length && !item.vars.some(v => text.includes("{" + v + "}"))) {
            const ok = await askConfirm(t("tpl_confirm", { title: item.title, vars: item.vars.map(v => "{" + v + "}").join(", ") }), t("overwrite"));
            if (!ok) return;
        }
        try {
            const r = await sendBridge({ action: "update_text", tab, id: item.id, field: fieldOf(visiblePromptRoot(tab)), text });
            if (r && r.ok) setCurrent(tab, { id: item.id, rendered: null });
        } catch (e) { toast(String(e.message || e), "error"); }
    }
    async function onSaveAs(tab) {
        const text = readPromptValue(tab);
        if (!String(text || "").trim()) { toast(t("empty_prompt"), "error"); return; }
        const item = currentItem(tab);
        const res = await askSaveAs({
            title: item ? t("copy_title", { title: item.title }) : text.split("\n")[0].slice(0, 60),
            tags: item ? item.tags || [] : [],
            colls: item && collections ? visibleLinks(item) : [],
            text,
        });
        if (!res) return;
        try {
            const prev = getCurrent(tab);
            const r = await sendBridge({
                action: "save_as", tab, field: fieldOf(visiblePromptRoot(tab)), text, title: res.title, tags: res.tags,
                collections: collections ? res.colls : undefined, from_id: item ? item.id : null,
            });
            if (r && r.ok && r.item) {
                if (r.save_undo_id) saveUndoCtx.set(r.save_undo_id, { tab, prev });
                setCurrent(tab, { id: r.item.id, rendered: null });
            }
        } catch (e) { toast(String(e.message || e), "error"); }
    }
    async function undoSave(undoId) {
        try {
            const r = await sendBridge({ action: "undo_save", tab: activeTab(), undo_id: undoId });
            const ctx = saveUndoCtx.get(undoId);
            saveUndoCtx.delete(undoId);
            // Undoing a "Save as" removes the new prompt: the previously loaded one becomes current again.
            // (the library refresh may already have cleared the deleted prompt from the bar).
            if (r && r.ok && r.undo_kind === "create" && ctx) {
                const now = getCurrent(ctx.tab);
                if (!now || now.id === r.undone_id) setCurrent(ctx.tab, ctx.prev);
            }
            updateAllBars();
        } catch (e) { toast(String(e.message || e), "error"); }
    }
    function modalShell(cls) {
        const bg = document.createElement("div");
        bg.className = "plib-modal-bg";
        const modal = document.createElement("div");
        modal.className = "plib-modal " + (cls || "");
        bg.appendChild(modal);
        return { bg, modal };
    }
    function modalActions(modal, okLabel) {
        const actions = document.createElement("div");
        actions.className = "plib-modal-actions";
        const cancel = document.createElement("button");
        cancel.className = "plib-secondary plib-cancel";
        cancel.textContent = t("cancel");
        const ok = document.createElement("button");
        ok.className = "plib-ok";
        ok.textContent = okLabel;
        actions.append(cancel, ok);
        modal.appendChild(actions);
        return { cancel, ok };
    }
    function askConfirm(text, okLabel) {
        return new Promise((resolve) => {
            const { bg, modal } = modalShell("plib-confirm");
            const p = document.createElement("p");
            p.className = "plib-modal-text";
            p.textContent = text;
            modal.appendChild(p);
            const { cancel, ok } = modalActions(modal, okLabel);
            applyTheme(modal);
            document.body.appendChild(bg);
            ok.focus();
            const done = (v) => { bg.remove(); resolve(v); };
            cancel.addEventListener("click", () => done(false));
            ok.addEventListener("click", () => done(true));
            bg.addEventListener("click", (e) => { if (e.target === bg) done(false); });
            modal.addEventListener("keydown", (e) => { if (e.key === "Escape") done(false); });
        });
    }
    function askSaveAs(init) {
        // Title + tags + collections (same chip editors as the bar's details row) + a read-only preview of the text.
        return new Promise((resolve) => {
            const { bg, modal } = modalShell("plib-saveas");
            modal.innerHTML = `<h3>${escapeHtml(t("save_as_head"))}</h3><label>${escapeHtml(t("title_label"))}</label>`;
            const inp = document.createElement("input");
            inp.className = "plib-saveas-title";
            inp.value = init.title || "";
            modal.appendChild(inp);
            const lab = (txt) => { const l = document.createElement("label"); l.textContent = txt; modal.appendChild(l); };
            lab(t("tags"));
            const tagsEd = chipEditor({ kind: "tags", values: init.tags, placeholder: t("add_tag"), allowFree: true, suggest: tagSuggestions });
            modal.appendChild(tagsEd.el);
            let collEd = null;
            if (collections) {
                lab(t("collections"));
                collEd = chipEditor({ kind: "coll", values: init.colls, placeholder: t("add_coll"), allowFree: false, suggest: collSuggestions,
                    labelOf: (v) => (collById.get(v) || {}).name || v, emptyText: t("no_suggestions") });
                modal.appendChild(collEd.el);
            }
            lab(t("text_label"));
            const pre = document.createElement("div");
            pre.className = "plib-saveas-text";
            pre.textContent = init.text.length > 400 ? init.text.slice(0, 400) + "…" : init.text;
            modal.appendChild(pre);
            const { cancel, ok } = modalActions(modal, t("save"));
            applyTheme(modal);
            document.body.appendChild(bg);
            inp.focus();
            inp.select();
            const done = (v) => { tagsEd.destroy(); collEd && collEd.destroy(); bg.remove(); resolve(v); };
            cancel.addEventListener("click", () => done(null));
            bg.addEventListener("mousedown", (e) => { if (e.target === bg) done(null); });
            ok.addEventListener("click", () => done({ title: inp.value.trim() || init.title, tags: tagsEd.get(), colls: collEd ? collEd.get() : [] }));
            inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ok.click(); } });
            modal.addEventListener("keydown", (e) => { if (e.key === "Escape") done(null); });
        });
    }
    function openManageTab() {
        // Click a VISIBLE main-tabs button labelled "Prompt Library" (Gradio may render duplicates).
        const buttons = [...document.querySelectorAll('button, [role="tab"]')];
        const hit = buttons.find(b => {
            if (!/Prompt Library/i.test((b.textContent || "").trim())) return false;
            const r = b.getBoundingClientRect();
            const st = getComputedStyle(b);
            return r.width > 2 && r.height > 2 && st.visibility !== "hidden" && st.display !== "none";
        }) || buttons.find(b => /Prompt Library/i.test((b.textContent || "").trim()));
        if (hit) hit.click();
        else toast(t("open_tab"), "info");
    }

    // ------------------------------------------------------------------ settings / library
    function applySettings(raw, fromServer) {
        try {
            const data = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (data && typeof data === "object") cfg = Object.assign({}, cfg, data);
        } catch (_) {}
        for (const state of mounts.values()) relabel(state);
        refreshMounts();
        if (fromServer) log("settings applied", cfg);
    }
    function applyLibrary(raw) {
        let data = null;
        try { data = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (_) { return; }
        if (Array.isArray(data)) { library = data; updateAllBars(); return; }
        if (!data || typeof data !== "object") return;
        const prevById = new Map(library.map(p => [p.id, p]));
        if (Array.isArray(data.prompts)) library = data.prompts;
        if ("collections" in data) {
            collections = Array.isArray(data.collections) ? data.collections : null;
            collById = new Map((collections || []).map(c => [c.id, c]));
        }
        if (data.revision != null) {
            const rev = Number(data.revision);
            const changed = lastRevision !== null && rev !== lastRevision;
            lastRevision = rev;
            if (changed) {
                const ch = data.change || {};
                // Contract: tell other plugins (Reference Library) that prompts or links changed.
                window.dispatchEvent(new CustomEvent("promptlib:changed", { detail: { revision: rev, reason: ch.reason || null, id: ch.id || null } }));
                syncManager(prevById);
            }
        }
        // A loaded prompt deleted elsewhere is no longer "current".
        if (lastRevision !== null) for (const tab of [...current.keys()]) { const c = current.get(tab); if (c && !library.some(p => p.id === c.id)) setCurrent(tab, null); }
        updateAllBars();
    }
    // Manager tab: refresh its list after any library change; reload the editor fields of the selected prompt only when
    // they still hold that prompt's previous values (no unsaved edits get overwritten).
    let mgrFlag = "";
    function boxVal(id) { const el = document.querySelector(`#${id} textarea, #${id} input`); return el ? el.value : null; }
    function syncManager(prevById) {
        const btn = document.getElementById("plib_mgr_ext");
        if (!btn) return;
        const sel = boxVal("plib_mgr_selected");
        const prev = sel ? prevById.get(sel) : null;
        mgrFlag = "";
        if (prev) {
            const tokens = [...document.querySelectorAll("#plib_mgr_collections .token")].map(x => x.textContent.trim()).sort();
            const prevColls = linkedCollections(prev).map(c => c.name).sort();
            const clean = boxVal("plib_mgr_title") === prev.title && normText(boxVal("plib_mgr_text")) === normText(prev.text)
                && fold(boxVal("plib_mgr_tags") || "").replace(/\s+/g, "") === fold((prev.tags || []).join(",")).replace(/\s+/g, "")
                && (!collections || JSON.stringify(tokens) === JSON.stringify(prevColls));
            if (clean) mgrFlag = "reload";
        }
        clearTimeout(syncManager._t);
        syncManager._t = setTimeout(() => btn.click(), 60);
    }
    function refreshMounts() {
        const tab = activeTab();
        const enabled = cfg.enabled !== false && (tab !== "edit" || cfg.show_edit !== false);
        // Keep both mounts if possible; hide when disabled for that tab.
        for (const [tname, state] of mounts) {
            const on = cfg.enabled !== false && (tname !== "edit" || cfg.show_edit !== false);
            state.wrap.dataset.disabled = on ? "0" : "1";
        }
        if (enabled) ensureMount(tab);
    }

    // ------------------------------------------------------------------ boot
    function boot() {
        loadTargets();
        setText("plib_browser_lang", browserLang());
        // Seed library from the hidden textbox if present.
        const libBox = document.querySelector("#plib_library_json textarea, #plib_library_json input");
        if (libBox && libBox.value) applyLibrary(libBox.value);
        const setBox = document.querySelector("#plib_settings_json textarea, #plib_settings_json input");
        if (setBox && setBox.value) applySettings(setBox.value);
        refreshMounts();
        // Ask server for localized tab + fresh library (same pattern as Dragger).
        const loc = document.getElementById("plib_localize");
        if (loc) setTimeout(() => loc.click(), 400);
        // Reference Library collections may register after us: refresh names/availability once the page is up.
        setTimeout(() => { const b = document.getElementById("plib_reflib_refresh"); if (b) b.click(); }, 1500);
        // Detect writes made through the Python API (e.g. Reference Library's "Prompts" selector): poll the revision.
        setInterval(() => {
            if (document.visibilityState !== "visible") return;
            const b = document.getElementById("plib_poll");
            if (b) b.click();
        }, 3000);
        // Re-check mounts as Gradio re-renders the form on model changes.
        setInterval(() => {
            loadTargets();
            const bl = document.querySelector("#plib_browser_lang textarea, #plib_browser_lang input");
            if (bl && !bl.value) setText("plib_browser_lang", browserLang());
            refreshMounts();
            updateAllBars();
        }, 1500);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();

    window.promptLibrary = {
        version: VERSION,
        settings: cfg,
        applySettings,
        applyLibrary,
        bridgeResponse,
        loadTargets,
        searchLocal,
        fold,
        tabRequest: null,
        apply: (id, opts) => applyPromptById(id, opts || {}),
        collections: () => collections,
        collectionsFor: (id) => linkedCollections(library.find(p => p.id === id)),
        revision: () => lastRevision,
        current: (tab) => { const c = getCurrent(tab || activeTab()); return c ? Object.assign({ modified: isModified(tab || activeTab()) }, c) : null; },
        _onRevision: onRevision,
        _mgrFlag: () => mgrFlag,
        _setCurrent: setCurrent,
        // test helpers
        _library: () => library,
        _mounts: () => mounts,
        _ensureMount: ensureMount,
        _activeTab: activeTab,
        _readPrompt: readPromptValue,
        _sendBridge: sendBridge,
        _toast: toast,
        _closeDropdown: () => { for (const s of mounts.values()) closeDropdown(s); },
    };
    log(`v${VERSION} ready`);
})();

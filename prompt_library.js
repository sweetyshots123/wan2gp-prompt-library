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
            save_current: "Save current",
            save_title_ph: "Title for the new prompt",
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
            save_current_title: "Save the current prompt to the library",
            keys_hint: "↑↓ to move · Enter to insert · Esc to close",
            collections: "Collections",
            coll_linked: "Linked collection: {names}",
            coll_load: "Load collection {name}",
            coll_loading: "Loading collection «{name}»…",
            coll_prompts: "Prompts linked to «{name}»:",
            use_prompt: "Use «{title}»",
            prompt_missing: "Prompt not found in the library",
        },
        es: {
            search_ph: "Buscar prompts…",
            save_current: "Guardar actual",
            save_title_ph: "Título del prompt nuevo",
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
            save_current_title: "Guardar el prompt actual en la librería",
            keys_hint: "↑↓ para moverte · Enter para insertar · Esc para cerrar",
            collections: "Colecciones",
            coll_linked: "Colección asociada: {names}",
            coll_load: "Cargar colección {name}",
            coll_loading: "Cargando colección «{name}»…",
            coll_prompts: "Prompts asociados a «{name}»:",
            use_prompt: "Usar «{title}»",
            prompt_missing: "No se encontró el prompt en la librería",
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
/* ---- search bar (real Gradio Group / Textbox / Buttons, only small layout touches here) */
.plib-bar { margin: 6px 0 4px !important; overflow: visible !important; }
.plib-bar[data-disabled="1"], .plib-wrap[data-disabled="1"] { display: none !important; }
.plib-bar .plib-bar-row { gap: 6px !important; align-items: center !important; flex-wrap: nowrap !important; padding: 4px !important;
  background: var(--block-background-fill) !important; }
.plib-bar .plib-save-btn, .plib-bar .plib-manage-btn { align-self: center !important; white-space: nowrap !important; flex: 0 0 auto !important;
  min-height: 34px; }
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
:root { --plib-icon-search: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='10.5' cy='10.5' r='6.5' fill='none' stroke='black' stroke-width='2.4'/%3E%3Cpath d='M15.5 15.5L21 21' stroke='black' stroke-width='2.6' stroke-linecap='round'/%3E%3C/svg%3E"); }
/* ---- DOM-only fallback bar (only used if the Gradio bar could not be inserted) */
.plib-wrap.plib-fallback { display: flex; gap: 6px; align-items: center; margin: 6px 0; padding: 4px; border-radius: var(--block-radius);
  background: var(--block-background-fill); border: 1px solid var(--block-border-color); }
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
                    onClick: () => sendBridge({ action: "undo", tab: data.tab || activeTab(), undo_id: data.undo_id }).catch(() => {}),
                });
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
            if (r && r.ok) window.dispatchEvent(new CustomEvent("promptlib:applied", { detail: { id: item.id, title: item.title, source: opts.source || null } }));
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
        wrap.innerHTML = `<div class="plib-search-box"><input type="text" autocomplete="off" spellcheck="false" /></div>
          <button type="button" class="plib-btn plib-save-btn"></button><button type="button" class="plib-btn plib-manage-btn"></button>`;
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
        const manageBtn = wrap.querySelector(".plib-manage-btn");
        const dd = document.createElement("div");
        dd.className = "plib-dd";
        dd.dataset.tab = tab;
        dd.setAttribute("role", "listbox");
        document.body.appendChild(dd);
        const state = { wrap, input, dd, saveBtn, manageBtn, clearBtn, activeIdx: -1, results: [] };
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
        if (saveBtn) saveBtn.addEventListener("click", () => onSaveCurrent(tab));
        if (manageBtn) manageBtn.addEventListener("click", openManageTab);
        dd.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus in the input
        syncClear();
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
        if (state.saveBtn) { state.saveBtn.textContent = t("save_current"); state.saveBtn.title = t("save_current_title");
            state.saveBtn.style.display = cfg.save_current_button === false ? "none" : ""; }
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
            await sendBridge({
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
    async function onSaveCurrent(tab) {
        const text = readPromptValue(tab);
        if (!String(text || "").trim()) { toast(t("empty_prompt"), "error"); return; }
        const title = await askTitle(text.split("\n")[0].slice(0, 60));
        if (title === null) return;
        try {
            await sendBridge({
                action: "save_current",
                tab,
                field: fieldOf(visiblePromptRoot(tab)),
                text,
                title: title || text.split("\n")[0].slice(0, 60),
            });
        } catch (e) {
            toast(String(e.message || e), "error");
        }
    }
    function askTitle(defaultTitle) {
        return new Promise((resolve) => {
            const bg = document.createElement("div");
            bg.className = "plib-modal-bg";
            const modal = document.createElement("div");
            modal.className = "plib-modal";
            modal.innerHTML = `<h3>${escapeHtml(t("save_current"))}</h3>
              <label>${escapeHtml(t("save_title_ph"))}</label>`;
            const inp = document.createElement("input");
            inp.value = defaultTitle || "";
            modal.appendChild(inp);
            const actions = document.createElement("div");
            actions.className = "plib-modal-actions";
            const cancel = document.createElement("button");
            cancel.className = "plib-secondary";
            cancel.textContent = t("close");
            const ok = document.createElement("button");
            ok.textContent = t("save_current");
            actions.appendChild(cancel);
            actions.appendChild(ok);
            modal.appendChild(actions);
            bg.appendChild(modal);
            applyTheme(modal);
            document.body.appendChild(bg);
            inp.focus();
            inp.select();
            const done = (val) => { bg.remove(); resolve(val); };
            cancel.addEventListener("click", () => done(null));
            bg.addEventListener("click", (e) => { if (e.target === bg) done(null); });
            ok.addEventListener("click", () => done(inp.value));
            inp.addEventListener("keydown", (e) => {
                if (e.key === "Enter") { e.preventDefault(); ok.click(); }
                if (e.key === "Escape") done(null);
            });
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
        if (Array.isArray(data)) { library = data; return; }
        if (!data || typeof data !== "object") return;
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
            }
        }
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
        _onRevision: onRevision,
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

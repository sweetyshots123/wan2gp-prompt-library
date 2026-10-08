// Prompt Library __PLIB_VERSION__ - autocomplete prompt templates for WanGP.
// Injected through WanGP's add_custom_js API. Namespaces: window.promptLibrary, CSS .plib-*
(() => {
    if (window.promptLibrary && window.promptLibrary.version) return;
    const VERSION = "__PLIB_VERSION__";
    let cfg = __PLIB_SETTINGS__;
    let library = [];
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
    const style = document.createElement("style");
    style.id = "plib-style";
    style.textContent = `
.plib-wrap { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 4px 0 8px; position: relative; z-index: 20; }
.plib-wrap[data-disabled="1"] { display: none !important; }
.plib-search { flex: 1 1 220px; min-width: 160px; position: relative; }
.plib-search input { width: 100%; box-sizing: border-box; padding: 7px 10px; border-radius: 8px;
  border: 1px solid rgba(148,163,184,.45); background: rgba(15,23,42,.55); color: inherit;
  font: 500 13px/1.3 system-ui, sans-serif; outline: none; }
.plib-search input:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(129,140,248,.25); }
.plib-save-btn, .plib-manage-btn { all: unset; cursor: pointer; padding: 7px 12px; border-radius: 8px;
  background: rgba(79,70,229,.25); border: 1px solid rgba(129,140,248,.45); font: 600 12px/1.2 system-ui, sans-serif; white-space: nowrap; }
.plib-save-btn:hover, .plib-manage-btn:hover { background: rgba(79,70,229,.4); }
.plib-dd { position: absolute; left: 0; right: 0; top: calc(100% + 4px); max-height: 320px; overflow: auto;
  background: #0f172a; border: 1px solid #334155; border-radius: 10px; box-shadow: 0 12px 40px rgba(0,0,0,.45);
  z-index: 10070; display: none; }
.plib-dd.open { display: block; }
.plib-item { padding: 8px 12px; cursor: pointer; border-bottom: 1px solid rgba(51,65,85,.6); }
.plib-item:last-child { border-bottom: none; }
.plib-item:hover, .plib-item.active { background: rgba(79,70,229,.28); }
.plib-item-title { font: 600 13px/1.3 system-ui, sans-serif; color: #e2e8f0; }
.plib-item-tags { font: 500 11px/1.3 system-ui, sans-serif; color: #94a3b8; margin-top: 2px; }
.plib-item-snip { font: 400 12px/1.35 system-ui, sans-serif; color: #cbd5e1; margin-top: 4px; }
.plib-item-snip mark, .plib-item-snip .plib-hl { background: rgba(250,204,21,.35); color: #fef9c3; border-radius: 3px; padding: 0 2px; }
.plib-empty { padding: 12px; color: #94a3b8; font: 500 13px system-ui, sans-serif; }
.plib-toasts { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 10080;
  display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; max-width: min(92vw, 640px); }
.plib-toast { pointer-events: auto; display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-radius: 10px;
  font: 500 14px/1.35 system-ui, sans-serif; color: #fff; background: #4f46e5; box-shadow: 0 6px 22px rgba(0,0,0,.35);
  opacity: 1; transition: opacity .3s; white-space: pre-line; }
.plib-toast[data-kind="error"] { background: #b91c1c; }
.plib-toast[data-kind="info"] { background: #1f2937; border: 1px solid #374151; }
.plib-toast.hiding { opacity: 0; }
.plib-toast button { all: unset; cursor: pointer; padding: 4px 10px; border-radius: 6px; background: rgba(255,255,255,.18);
  font-weight: 700; white-space: nowrap; }
.plib-toast button:hover { background: rgba(255,255,255,.3); }
.plib-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 10090; display: flex; align-items: center; justify-content: center; }
.plib-modal { background: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 16px 18px; min-width: min(92vw, 420px);
  box-shadow: 0 16px 50px rgba(0,0,0,.5); color: #e2e8f0; }
.plib-modal h3 { margin: 0 0 10px; font: 700 15px system-ui, sans-serif; }
.plib-modal label { display: block; font: 500 12px system-ui, sans-serif; color: #94a3b8; margin: 8px 0 4px; }
.plib-modal input { width: 100%; box-sizing: border-box; padding: 7px 10px; border-radius: 8px; border: 1px solid #334155;
  background: #1e293b; color: #e2e8f0; font: 500 13px system-ui, sans-serif; }
.plib-modal .plib-modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px; }
.plib-modal .plib-modal-actions button { all: unset; cursor: pointer; padding: 7px 12px; border-radius: 8px;
  background: rgba(79,70,229,.35); border: 1px solid rgba(129,140,248,.5); font: 600 12px system-ui, sans-serif; }
.plib-modal .plib-modal-actions button.plib-secondary { background: transparent; }
`;
    document.head.appendChild(style);

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
            const all = `${title} ${tags} ${body}`;
            if (words.length && !words.every(w => all.includes(w))) continue;
            const titleHits = words.reduce((n, w) => n + (title.includes(w) ? 1 : 0), 0);
            const tagHits = words.reduce((n, w) => n + (tags.includes(w) ? 1 : 0), 0);
            const bodyHits = words.reduce((n, w) => n + (body.includes(w) ? 1 : 0), 0);
            scored.push({
                rank: [-titleHits * 100 - tagHits * 40 - bodyHits * 10, -(item.last_used || 0), -(item.use_count || 0), -(item.updated || 0)],
                item,
            });
        }
        scored.sort((a, b) => {
            for (let i = 0; i < a.rank.length; i++) if (a.rank[i] !== b.rank[i]) return a.rank[i] - b.rank[i];
            return fold(a.item.title).localeCompare(fold(b.item.title));
        });
        return scored.slice(0, limit).map(s => s.item);
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
        const start = Math.max(0, idx - 28);
        const end = Math.min(text.length, idx + hit.length + maxLen - 40);
        let chunk = text.slice(start, end);
        const approx = text.slice(idx, idx + hit.length);
        chunk = chunk.replace(approx, "⟦" + approx + "⟧");
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
    function toast(text, kind, buttons) {
        if (!text) return;
        if (kind !== "error" && cfg.toasts === false) return;
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
        const ms = Math.max(1000, Math.min(30000, Number(cfg.toast_ms) || 3500));
        setTimeout(() => { el.classList.add("hiding"); setTimeout(() => el.remove(), 350); }, ms);
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
        if (data.library) applyLibrary({ prompts: data.library });
        const entry = data.id != null ? pending.get(data.id) : null;
        if (entry) {
            clearTimeout(entry.timer);
            pending.delete(data.id);
            entry.resolve(data);
        }
        if (data.ok === false) toast(data.error || "error", "error");
        else if (data.toast) {
            const buttons = [];
            if (data.undo_id && cfg.undo !== false) {
                buttons.push({
                    label: t("undo"),
                    onClick: () => sendBridge({ action: "undo", tab: data.tab || activeTab(), undo_id: data.undo_id }).catch(() => {}),
                });
            }
            toast(data.toast, "ok", buttons);
        }
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
    const mounts = new Map(); // tab -> { wrap, input, dd, activeIdx, results }
    function ensureMount(tab) {
        if (mounts.has(tab)) return mounts.get(tab);
        const root = visiblePromptRoot(tab);
        if (!root) return null;
        // Anchor under the prompt tools stack column when possible.
        const stack = root.closest(".wangp-prompt-tools-stack") || root.parentElement || root;
        const wrap = document.createElement("div");
        wrap.className = "plib-wrap";
        wrap.dataset.tab = tab;
        wrap.innerHTML = `
          <div class="plib-search">
            <input type="search" autocomplete="off" spellcheck="false" class="plib-q" />
            <div class="plib-dd" role="listbox"></div>
          </div>
          <button type="button" class="plib-save-btn"></button>
          <button type="button" class="plib-manage-btn"></button>`;
        // Insert after the prompt block
        if (stack.nextSibling) stack.parentElement.insertBefore(wrap, stack.nextSibling);
        else stack.parentElement.appendChild(wrap);
        const input = wrap.querySelector(".plib-q");
        const dd = wrap.querySelector(".plib-dd");
        const saveBtn = wrap.querySelector(".plib-save-btn");
        const manageBtn = wrap.querySelector(".plib-manage-btn");
        const state = { wrap, input, dd, saveBtn, manageBtn, activeIdx: -1, results: [] };
        mounts.set(tab, state);
        relabel(state);
        input.addEventListener("input", () => renderDropdown(state));
        input.addEventListener("focus", () => renderDropdown(state));
        input.addEventListener("keydown", (e) => onKey(state, e));
        input.addEventListener("keyup", (e) => { if (e.key === "Escape") { e.preventDefault(); closeDropdown(state); } });
        // Capture Esc even if Gradio steals bubbling keydown.
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && dd.classList.contains("open") && mounts.get(tab) === state) {
                dd.classList.remove("open");
                state.activeIdx = -1;
            }
        }, true);
        input.addEventListener("blur", () => setTimeout(() => {
            if (!dd.matches(":hover") && document.activeElement !== input) dd.classList.remove("open");
        }, 180));
        saveBtn.addEventListener("click", () => onSaveCurrent(tab));
        manageBtn.addEventListener("click", openManageTab);
        document.addEventListener("click", (e) => {
            if (!wrap.contains(e.target)) dd.classList.remove("open");
        });
        return state;
    }
    function relabel(state) {
        if (!state) return;
        state.input.placeholder = t("search_ph");
        state.saveBtn.textContent = t("save_current");
        state.manageBtn.textContent = t("open_tab");
        state.saveBtn.style.display = cfg.save_current_button === false ? "none" : "";
    }
    function renderDropdown(state) {
        const q = state.input.value;
        const results = searchLocal(q, 40);
        state.results = results;
        state.activeIdx = results.length ? 0 : -1;
        if (!q && !results.length) { state.dd.classList.remove("open"); state.dd.innerHTML = ""; return; }
        if (!results.length) {
            state.dd.innerHTML = `<div class="plib-empty">${escapeHtml(t("no_results"))}</div>`;
            state.dd.classList.add("open");
            return;
        }
        state.dd.innerHTML = results.map((item, i) => {
            const tags = (item.tags || []).join(", ");
            const snip = highlightHtml(snippet(item, q));
            return `<div class="plib-item${i === state.activeIdx ? " active" : ""}" data-i="${i}" role="option">
              <div class="plib-item-title">${escapeHtml(item.title)}</div>
              ${tags ? `<div class="plib-item-tags">${escapeHtml(t("tags") + ": " + tags)}</div>` : ""}
              <div class="plib-item-snip">${snip}</div>
            </div>`;
        }).join("");
        state.dd.classList.add("open");
        state.dd.querySelectorAll(".plib-item").forEach(el => {
            el.addEventListener("mousedown", (e) => { e.preventDefault(); pick(state, Number(el.dataset.i)); });
        });
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
        } else if (e.key === "Enter" && n && state.activeIdx >= 0) {
            e.preventDefault();
            pick(state, state.activeIdx);
        } else if (e.key === "Escape") {
            e.preventDefault(); e.stopPropagation();
            closeDropdown(state);
        }
    }
    function closeDropdown(state) {
        if (!state) return;
        state.dd.classList.remove("open");
        state.activeIdx = -1;
    }
    function syncActive(state) {
        state.dd.querySelectorAll(".plib-item").forEach((el, i) => {
            el.classList.toggle("active", i === state.activeIdx);
            if (i === state.activeIdx) el.scrollIntoView({ block: "nearest" });
        });
    }
    async function pick(state, index) {
        const item = state.results[index];
        if (!item) return;
        state.dd.classList.remove("open");
        state.input.value = "";
        const tab = state.wrap.dataset.tab || activeTab();
        let vars = null;
        if (item.vars && item.vars.length) {
            vars = await askVariables(item);
            if (vars === null) return; // cancelled
        }
        const mode = cfg.insert_mode || "replace";
        const field = fieldOf(visiblePromptRoot(tab));
        try {
            await sendBridge({
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
        try {
            const data = typeof raw === "string" ? JSON.parse(raw) : raw;
            if (Array.isArray(data)) library = data;
            else if (data && Array.isArray(data.prompts)) library = data.prompts;
        } catch (_) {}
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

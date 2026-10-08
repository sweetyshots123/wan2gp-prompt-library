# Changelog

## 1.1.0 — 2026-10-08

- **Two-way links with Reference Library collections** (needs Reference Library 1.1+, which has the matching API). Each prompt can have collections, and each collection lists its prompts. Prompt Library is the single source of truth (`collections: [...]` per prompt in `library.json`, schema 2). 1.0.x files are migrated transparently.
- Manager: **Collections** multi-select per prompt. Its names come from Reference Library and refresh when Reference Library reports a change.
- Autocomplete: linked collections are shown as chips, distinct from the tags. Searching by collection name also finds the prompts.
- New setting *When I pick a prompt that has collections*: do nothing / offer to load its collection (default; a **Load collection X** button in the insert toast) / load the first one automatically.
- New setting *When a collection is loaded in Reference Library*: do nothing (default, because Reference Library offers its prompts itself) / also offer the linked prompts here. It never overwrites the prompt without a click.
- Python API for other plugins: `sys.modules["wan2gp_prompt_library_api"]` (API_VERSION 1):
  - `list_prompts`, `prompts_for_collection`, `set_collection_prompts`, `collections_for_prompt`, `set_prompt_collections`, `get_prompt`, `revision`.
  - Thread-safe, with atomic saves.
- JS events:
  - Listens for `promptlib:apply` {id}.
  - Emits `promptlib:applied` and `promptlib:changed`. `promptlib:changed` also fires for Python-API changes, because the page polls a revision counter every 3 s while visible.
  - Dispatches `reflib:apply` {id}.
  - Listens for `reflib:changed` and `reflib:applied`.
- Reference Library is looked up lazily at call time. If it is missing or has another API version, all collection UI is hidden and the plugin works as before.
- Links to unknown or deleted collections are ignored and **never pruned automatically**, so undoing a deletion in Reference Library restores them. Saving a prompt keeps them too.
- The "Category / collection" field is now just "Category", to avoid confusion with Reference Library collections.

## 1.0.1 — 2026-10-08

- Interface redesign so the plugin looks native in WanGP's **dark** and light themes (no behaviour changes).
- The search bar is now made of real Gradio components (a Group with a Textbox and small secondary buttons), inserted right after the prompt. It has a search icon, a visible placeholder (“Search prompts…” / “Buscar prompts…”) and a clear (×) button. The buttons are now “Save current” and “Manage” (“Guardar actual” / “Gestionar”).
- Dropdown fixes:
  - It was semi-transparent and Gradio labels showed through it. It is now attached to the page body with a fixed position and an opaque theme background, border and shadow, so nothing shows through or clips it.
  - It flips above the bar when there is no room below, and has a max height with scrolling.
  - Clear hover and selected states; tags shown as chips; the snippet is limited to 2 lines with an ellipsis and starts at a word boundary; a hint line for the keyboard keys.
- Dialogs (template variables, save current) and toasts now use the theme colours.
- Manager tab: two-column layout (library and editor on the left, settings on the right), grouped blocks, small buttons.

## 1.0.0 — 2026-10-08

- First release.
- Autocomplete search box next to WanGP's main prompt (and the queue Edit tab): multi-word AND search across title, tags and text; accent-insensitive and case-insensitive; title/tag matches ranked above body matches, then by recent/frequent use.
- Keyboard navigation (↑↓ Enter Esc) and mouse selection; highlighted snippet in the dropdown.
- Insert modes: replace (default), append, or insert at cursor (best effort).
- Optional Undo toast after inserting.
- “Save current prompt” button next to the search box.
- Manager tab: list/filter, create, edit, duplicate, delete (with DELETE confirmation), import/export JSON and plain text.
- Persistent `library.json` in the plugin folder (atomic writes, not shipped in the zip). Ships with 3 clearly labeled `[Example]` prompts that can be deleted.
- Settings in `settings.json` (merged from defaults). Language / Idioma: Auto / English / Español.
- Coexists with Dragger, Vidosser and Reference Library (own CSS/JS namespaces: `plib-*` / `window.promptLibrary`).

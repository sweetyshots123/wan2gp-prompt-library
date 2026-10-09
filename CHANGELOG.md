# Changelog

## 1.3.0 — 2026-10-09

- **Prompt history.** The prompt in the visible box is recorded when WanGP's **Generate** or **Add New Prompt To Queue** is clicked.
  - The plugin only adds a CSS class to those buttons in `post_ui_setup`, and the page records on click. There are no Wan2GP core changes and no extra Gradio event on Generate.
  - Consecutive identical prompts collapse into one entry with a refreshed timestamp, empty prompts are ignored, and the list is capped at 500 entries.
- **History** button in the bar opens a dialog. Entries are newest first, with their date and an accent-insensitive multi-word search with highlights.
  - Each entry has **Apply** (loads it into WanGP's prompt, with the usual Undo), **Save to library** (the existing *Save as…* dialog, prefilled) and **Delete**.
  - **Clear history** asks for confirmation. A **Record history** checkbox turns recording off (`history` setting, default on).
- Stored in `history.json` next to `library.json`: atomic writes, gitignored, never in the zip, and kept on update. New bridge actions: `history_add`, `history_list`, `history_delete`, `history_clear` and `history_enable`.
- Toasts now show above dialogs. Dark and light themes, EN/ES.

## 1.2.1 — 2026-10-09

- **Rename a tag everywhere.** Editing a tag renames that tag itself on every prompt; it does not create a new one.
  - **In the bar:** double-click a tag chip, or click the small pencil that appears on hover. The chip becomes a text field: Enter or blur saves, Esc cancels.
    - The toast reads *Tag “neon” renamed to “neón” in N prompts*, or says *merged into* when the name already existed.
    - It has **Undo**, which restores the exact previous tags on every affected prompt.
  - **In the manager:** a new **Tags** section with a dropdown of the existing tags and their counts, a new-name field and **Rename**.
  - **Matching:** case- and accent-insensitive, like the rest of the tag handling. If a prompt already has the new name, the two merge without a duplicate. An empty name, or one containing `,` or `;`, is rejected.
  - **Saving:** one atomic, thread-safe save with a single revision bump (reason `tags`). `promptlib:changed` fires, so the manager, Reference Library and other pages refresh.
- **The search box shows the loaded prompt and renames it.** Like Reference Library's collection select, the idle box shows the loaded prompt's title as its value.
  - Focusing selects the title, so typing searches as usual; Esc or blur without a pick restores the title.
  - Rename with the pencil inside the box (next to the clear ×) or by double-clicking the box. The box gets an amber frame and the placeholder *Rename prompt…*, and the dropdown is suppressed.
  - Enter saves, Esc cancels, and an empty title is rejected.
  - Same prompt id; text, tags and collections are untouched.
  - The toast *Prompt renamed to “Y”* has **Undo**, which restores only the title.
  - Long titles get an ellipsis in the status.
  - The refresh goes through `promptlib:changed`, so the status, autocomplete, manager and Reference Library's chips update. New bridge action: `rename_prompt`.
- **Fix:** adding a second tag/collection chip right after another could drop the first one. A background refresh rebuilt the chips from a library snapshot older than the in-flight save. The *modified* indicator now also updates as you type in WanGP's prompt.
- Storage: `rename_tag`, `restore_tags` and `tag_counts`. Python API: `rename_tag(old, new)` → `{old, new, count, merged}`, which raises `ValueError` on bad names.

## 1.2.0 — 2026-10-08

- **New bar under WanGP's prompt, in the same style as Reference Library's bar.** It is still a separate block.
  - A **Prompt Library** header with an icon, and a status on the right: *Prompt “X” loaded*, plus a **modified** marker.
  - The search box, and buttons with icons and the same 36 px height as Reference Library's: **Save**, **Save as…** and **Manage**.
  - It replaces the old *Save current* button.
- **Current prompt:**
  - Picking from the autocomplete or receiving `promptlib:apply` remembers that prompt, per browser session and per tab.
  - It is shown as **modified** while WanGP's text differs from the saved one. For templates, the comparison uses the values you filled in.
  - If the prompt is deleted elsewhere, the bar clears it. Undoing an insert gives back the previously loaded prompt.
- **Save** overwrites the loaded prompt with WanGP's current text.
  - The toast has **Undo**.
  - With nothing loaded, it works like *Save as…*. With no changes, it only shows a notice.
  - It asks before saving over a template whose `{variables}` would be lost.
- **Save as…** creates a new prompt.
  - Its dialog has the title (prefilled “X (copy)”), tags and collections copied from the loaded prompt, and a text preview.
  - The original is untouched and the new prompt becomes the current one. **Undo** deletes it.
- **Inline tags and Reference Library collections** for the current prompt:
  - Chips with ×, plus an add field. Tags autocomplete from existing tags; collections can only be picked from the existing ones, and only when the Reference Library API is present.
  - Saved immediately, with **Undo**. The Save as dialog uses the same chip editor.
  - Links to collections Reference Library doesn't list right now (for example ones in its trash) are kept.
- **Manager tab refresh:** it refreshes on `promptlib:changed`, so it picks up changes from the bar, the Python API or other pages. Its editor reloads only when it has no unsaved edits.
- New bridge actions `update_text`, `save_as`, `set_meta` and `undo_save`. `save_current` is still accepted. The insert response now includes the rendered text and the prompt id.
- **Reference Library compatibility** (notes from Reference Library 1.1.0's owner):
  - Any Reference Library `API_VERSION` ≥ 1 is accepted (major-compatible). It used to require exactly 1.
  - `reflib:changed` with any reason (`duplicate`, …) just refreshes.
  - Offering linked prompts on `reflib:applied` stays off by default, so prompts aren't offered twice.
  - Tested end to end against the real Reference Library 1.1.0, with Dragger also enabled.

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

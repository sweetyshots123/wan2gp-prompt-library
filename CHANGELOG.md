# Changelog

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

# Prompt Library — reusable text prompts for Wan2GP

*[Español](README.es.md)* · MIT License · v1.0.0

**Prompt Library** is a plugin for [Wan2GP / WanGP](https://github.com/deepbeepmeep/Wan2GP) that turns your best prompts into a searchable library of templates.

- Type a word (or several) next to WanGP's prompt box → matching prompts appear in a dropdown.
- Pick one → it is inserted into WanGP's own prompt field (replace, append, or at the cursor).
- Manage everything from the **Prompt Library** tab: create, edit, duplicate, delete, import and export.

It is a regular WanGP plugin. It doesn't modify any core WanGP file, so it survives WanGP updates. It coexists with [Dragger](https://github.com/sweetyshots123/wan2gp-dragger), [Vidosser](https://github.com/sweetyshots123/wan2gp-vidosser) and Reference Library.

> Prompt Library speaks **English and Spanish**. By default it follows the browser language (Spanish if it is Spanish, English otherwise); you can force either one in the settings (*Language / Idioma*).

## Features

**Autocomplete search**
- A compact bar sits right under WanGP's main prompt (and in the queue **Edit** tab if enabled): search field with a placeholder, clear (×) button, **Save current** and **Manage** buttons. It is built from regular Gradio components, so it follows WanGP's **dark and light themes**.
- Multi-word queries use **AND**: every word must match somewhere in the title, tags or body.
- Matching is **case-insensitive and accent-insensitive** (`cancion` finds `canción`). Partial words are fine.
- Ranking: title matches first, then tags, then body text; then by last used / use count.
- The opaque dropdown shows the title, tags as chips and a highlighted snippet (2 lines max). It floats above the rest of the page and scrolls when there are many results. Navigate with **↑ ↓ Enter Esc** or the mouse.
- Search runs **client-side** on a cached copy of the library (fast with hundreds/thousands of prompts).

**Insert**
- Default: **replace** the current prompt. Options: **append**, or **insert at cursor**.
- The server writes into WanGP's own `prompt` / `wizard_prompt` Gradio components, so generation reads the new value (no DOM-only fake).
- Optional **Undo** toast for a few seconds after inserting.
- Simple template variables like `{subject}` open a small dialog to fill values before insert.

**Save current**
- Optional button next to the search box saves whatever is currently in the prompt as a new library entry.

**Manager (Prompt Library tab, or the Manage button)**
- Library and editor on the left, settings on the right.
- List + filter, create, edit, duplicate, delete (type `DELETE` to confirm).
- Tags and optional category/collection.
- Import / export as JSON (full library) or plain text (blocks separated by `---`).

**Starter examples**
- The first run creates three prompts titled `[Example] …`. Delete them whenever you like; they are only seeds.

## How it works

1. Prompts are stored in `library.json` inside the plugin folder (atomic writes). That file is **gitignored** and never included in the release zip, so updates don't wipe your library. Settings live in `settings.json` next to it.
2. `prompt_library.js` (injected with WanGP's `add_custom_js` API) mounts the search UI next to the visible prompt textbox and searches the cached library.
3. Choosing a prompt fires a hidden Gradio bridge (textbox + button in the Prompt Library tab) whose outputs are WanGP's real prompt components. Use counts / last-used are updated on the server.

## Settings

| Option | Meaning | Default |
|---|---|---|
| Language / Idioma | *Auto (browser language)*, *English* or *Español* | Auto |
| Show search box next to the prompt | master switch for the autocomplete UI | on |
| Also show it in the queue Edit tab | mount the search UI in Edit too | on |
| “Save current prompt” button | button next to the search box | on |
| How to insert | *Replace* / *Append* / *Insert at cursor* | Replace |
| Offer “Undo” after inserting | undo toast | on |
| Confirmation messages + Duration | toasts (errors always show) | on, 3.5 s |

## Install

1. Download the release zip (`wan2gp-prompt-library.zip`).
2. In WanGP → Plugins, install from zip (or copy the `wan2gp-prompt-library/` folder into WanGP's `plugins/` directory).
3. Enable **Prompt Library** and restart WanGP if needed.

## Data location

Inside the plugin folder (next to `plugin.py`):

- `library.json` — your prompts (created on first use, with 3 example entries).
- `settings.json` — your settings (created when you save).

Both are excluded from the zip and from git.

## License

MIT © 2026 sweetyshots123

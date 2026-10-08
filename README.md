# Prompt Library — reusable text prompts for Wan2GP

*[Español](README.es.md)* · MIT License · v1.2.0

**Prompt Library** is a plugin for [Wan2GP / WanGP](https://github.com/deepbeepmeep/Wan2GP) that turns your best prompts into a searchable library of templates.

- Type a word (or several) next to WanGP's prompt box → matching prompts appear in a dropdown.
- Pick one → it is inserted into WanGP's own prompt field (replace, append, or at the cursor).
- Manage everything from the **Prompt Library** tab: create, edit, duplicate, delete, import and export.
- Optional: link prompts to [Reference Library](https://github.com/sweetyshots123/wan2gp-reference-library) image collections, in both directions.

It is a regular WanGP plugin. It doesn't modify any core WanGP file, so it survives WanGP updates. It coexists with [Dragger](https://github.com/sweetyshots123/wan2gp-dragger), [Vidosser](https://github.com/sweetyshots123/wan2gp-vidosser) and Reference Library.

> Prompt Library speaks **English and Spanish**. By default it follows the browser language (Spanish if it is Spanish, English otherwise); you can force either one in the settings (*Language / Idioma*).

## Features

**Autocomplete search**
- A **Prompt Library** bar sits right under WanGP's main prompt (and in the queue **Edit** tab if enabled). It follows the same style as Reference Library's bar: a header with an icon and a status on the right, the search field (placeholder + clear ×), and the **Save**, **Save as…** and **Manage** buttons. It is built from regular Gradio components, so it follows WanGP's **dark and light themes**.
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

**Current prompt, Save and Save as… (1.2.0)**
- The bar remembers the prompt you loaded, whether you picked it from the autocomplete or another plugin applied it (`promptlib:apply`, e.g. a Reference Library chip). It is kept per browser session and per tab (Generate / Edit). The header shows **Prompt “X” loaded**, plus a **modified** marker while WanGP's prompt differs from the saved text. For a template, the comparison uses the values you filled in.
- **Save** overwrites the loaded prompt with WanGP's current text. The toast has **Undo**. If nothing is loaded, Save works like *Save as…*. If there are no changes, it just says so. If you save over a template whose `{variables}` are gone from the text, it asks first.
- **Save as…** creates a **new** prompt from the current text and leaves the loaded one unchanged. Its dialog has the title (prefilled “X (copy)”), the tags and the Reference Library collections of the loaded prompt as a starting point, and a preview of the text. The new prompt becomes the current one. **Undo** in the toast deletes it again.
- **Inline details:** under the bar, the current prompt's **tags** are chips with × plus a “+ tag” field that autocompletes from your existing tags. When Reference Library 1.1+ is present, its **collections** get the same editor, with a picker limited to the existing collections. Changes are saved immediately and the toast has **Undo**. The *Save as…* dialog uses the same chip editors, but there nothing is saved until you confirm.
- Every change fires `promptlib:changed`, so the manager tab refreshes its list, and its editor too unless it holds unsaved edits. Reference Library and other open pages refresh as well.

**Manager (Prompt Library tab, or the Manage button)**
- Library and editor on the left, settings on the right.
- List + filter, create, edit, duplicate, delete (type `DELETE` to confirm).
- Tags and an optional category.
- Import / export as JSON (full library) or plain text (blocks separated by `---`).

**Starter examples**
- The first run creates three prompts titled `[Example] …`. Delete them whenever you like; they are only seeds.

## Reference Library collections (1.1.0)

If [Reference Library](https://github.com/sweetyshots123/wan2gp-reference-library) **1.1 or newer** is installed, prompts and image collections can be linked to each other:

- **Manager:** a **Collections** multi-select under the tags lists the Reference Library collections. Select the ones that go with the prompt and press *Save prompt*. Reference Library shows the same link from its side (its *Prompts* selector), because both plugins read the same data.
- **Autocomplete:** linked collections appear as small accent chips with an image icon, separate from the tags. Typing a collection name also finds its prompts (e.g. `retratos`).
- **Picking a prompt that has collections** (setting *When I pick a prompt that has collections*):
  - *Offer to load its collection* (default): the insert message gets a **Load collection X** button. Nothing changes until you click it.
  - *Load the first collection automatically*.
  - *Do nothing*.
- **Loading a collection in Reference Library:** Reference Library itself offers the linked prompts, so by default Prompt Library stays quiet. The setting *When a collection is loaded in Reference Library → Also offer its linked prompts here* adds a toast with *Use «title»* buttons. The prompt is never overwritten without a click.
- **Without Reference Library** (or with an older or incompatible version), every collection control is hidden and everything else works as before.

**Deleted collections.** A link to a collection that Reference Library no longer lists (deleted, or in its 15-minute trash) is simply ignored: it is not shown and not searchable. It is never pruned automatically. If you undo the deletion, the links come back. Saving a prompt in the manager also keeps those hidden links.

### For plugin developers

Links live only in Prompt Library's `library.json` (`collections: [collection id, …]` per prompt; schema 2). Old 1.0.x files are migrated transparently.

**Python:** `sys.modules["wan2gp_prompt_library_api"]`, `API_VERSION = 1`. All writes are thread-safe and saved atomically.

| Function | Returns / does |
|---|---|
| `list_prompts()` | `[{id, title, preview, tags, collections}]` |
| `prompts_for_collection(cid)` | `[prompt ids]` |
| `set_collection_prompts(cid, prompt_ids)` | makes exactly those prompts linked to `cid`; other links untouched; unknown ids ignored; returns the result |
| `collections_for_prompt(pid)` | `[collection ids]` |
| `set_prompt_collections(pid, cids)` | replaces one prompt's links |
| `get_prompt(pid)` | `{id, title, text, tags, collections}` or `None` |
| `revision()` | change counter |

Invalid ids raise `ValueError`. Look the module up at call time, because plugin load order is not guaranteed.

**JS events (on `window`):**

- Listens for `promptlib:apply` `{detail: {id, mode?}}` and inserts that prompt (template variables are asked first).
- Emits `promptlib:applied` `{id, title}` after a successful insert.
- Emits `promptlib:changed` `{revision, reason, id}` after any change to the library. This includes changes made through the Python API: the page polls the revision every 3 s while visible.
- Dispatches `reflib:apply` `{id}` to load a collection.
- Listens for `reflib:changed` (refreshes names) and `reflib:applied`.

Prompt Library consumes `sys.modules["wan2gp_reference_library_api"]` (any `API_VERSION` ≥ 1, `list_collections()`) and never reads Reference Library's files.

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
| “Save” / “Save as…” buttons in the bar | show the two save buttons | on |
| How to insert | *Replace* / *Append* / *Insert at cursor* | Replace |
| Offer “Undo” after inserting | undo toast | on |
| Confirmation messages + Duration | toasts (errors always show) | on, 3.5 s |
| When I pick a prompt that has collections | *Do nothing* / *Offer to load its collection* / *Load the first collection automatically* (only with Reference Library 1.1+) | Offer |
| When a collection is loaded in Reference Library | *Do nothing here* / *Also offer its linked prompts here* (only with Reference Library 1.1+) | Do nothing |

## Install

1. Download the release zip (`wan2gp-prompt-library.zip`).
2. In WanGP → Plugins, install from zip (or copy the `wan2gp-prompt-library/` folder into WanGP's `plugins/` directory).
3. Enable **Prompt Library** and restart WanGP if needed.

## Data location

Inside the plugin folder (next to `plugin.py`):

- `library.json` — your prompts and their links to Reference Library collections (created on first use, with 3 example entries).
- `settings.json` — your settings (created when you save).

Both are excluded from the zip and from git.

## License

MIT © 2026 sweetyshots123

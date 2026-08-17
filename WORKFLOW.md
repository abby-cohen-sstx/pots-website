# Article Authoring Workflow — Obsidian → MDX

How a finished article gets from a draft in Obsidian into an `.mdx` entry in the
`articles` content collection. This doc covers the **authoring and conversion
process**; for the deep reference on the schema, components, and the citation
pipeline, see the "Content and articles" and "References and citations" sections
of [`CLAUDE.md`](CLAUDE.md).

The article body is authored in Obsidian, then cleaned up and moved into
`src/content/articles/<id>.mdx`. `npm run build` (which runs `astro check`
first) is the safety net for the whole move — a bad `collection`/`type`, an
unknown citation key, or a missing image filename all fail the build with a
message naming the problem.

---

## 1. Authoring in Obsidian — mixed approach

Two styles, freely mixed per situation depending on which is more convenient:

- **Raw MDX tags** — type the finished component (`<Callout>`, `<Cite>`,
  `<Figure>`, `<Toggle>`) directly. Obsidian shows it as literal text (unstyled
  but readable). **No conversion needed on the way over** — it's already MDX.
- **Obsidian-native syntax** — use Obsidian's own callouts, embeds, and links
  while drafting because they render live and are faster to type. **Convert to
  the MDX tag when moving over** using the cheat sheet below.

Citations are the exception: with the ZotFlow setup in §2, the `@@` autocomplete
inserts the finished `<Cite>` tag directly, so citations are effectively always
"raw tag" with zero typing. The native `[@key]` → `<Cite>` conversion is only a
fallback for when you hand-type a citation.

### Rules that apply to both styles

- **Headings start at `##`** and run `##`–`####`. The page `<h1>` comes from the
  `header` frontmatter field and the subtitle from `subheader`, so `##` is the
  top section level. Anything outside `##`–`####` silently drops out of the
  table of contents. Draft with `##` as your top level in Obsidian too, so
  nothing needs renumbering.
- **External links** are already plain Markdown in Obsidian (`[text](https://…)`)
  and carry over unchanged. Only Obsidian `[[wikilinks]]` need converting.

### Conversion cheat sheet (Obsidian-native → MDX)

| Feature   | Obsidian-native draft                     | MDX target                                                    |
| --------- | ----------------------------------------- | ------------------------------------------------------------- |
| Callout   | `> [!note] Optional Title`<br>`> body`    | `<Callout type="note" title="Optional Title">body</Callout>`  |
| Callout types | `[!note]` `[!tip]` `[!warning]`       | `type="note\|tip\|warning\|anecdote"` (`anecdote` = personal experience; no native equivalent, use the raw tag) |
| Citation  | `[@key]` &nbsp; / &nbsp; `[@keyA; @keyB]` | `<Cite ids="key" />` &nbsp; / &nbsp; `<Cite ids="keyA keyB" />` |
| Image     | `![[file.png]]` or `![alt](path)`         | `<Figure src="file.png" alt="…" width="partial">caption…</Figure>` (caption in the body; move the file into `src/images/articles/`) |
| Internal link | `[[Some Article]]`                    | `[text](/articles/some-article-id)`                           |
| Toggle    | `> [!note]- Title` (collapsible callout)  | `<Toggle summary="Title">body</Toggle>` (no clean native form; prefer the raw tag) |

Conversion notes:
- **Callouts**: strip the leading `> ` from each body line; map Obsidian's title
  line (`> [!note] Custom Title`) to `title="Custom Title"`.
- **Figures**: Obsidian embeds carry no alt text or caption, so add those on
  conversion. `src` is the **bare filename**; the file must live in
  `src/images/articles/`. `alt` is required; `width` (`"full"` default |
  `"partial"` = 60%, centered) is optional. The **caption is the component
  body** (its children), not a prop, so it can hold rich text and a `<Cite>`;
  omit the body for no caption.
- **Toggles**: for an accordion, give several a shared `group="name"`. For a
  rich label (bold/link/`<Cite>`), use a `slot="summary"` on its own line with a
  blank line before the body instead of the `summary` prop.

---

## 2. Fast citations with ZotFlow (`@@` → finished `<Cite>` tag)

The site's `<Cite ids="…" />` is keyed on **Better BibTeX citation keys**, and
ZotFlow's citation templates expose that key as `item.citationKey`. So ZotFlow
can be configured to insert the finished MDX tag directly — no conversion.

### One-time setup

In **Settings → ZotFlow → Citation**, set the **Pandoc Template** to:

```
<Cite ids="{{ item.citationKey | default: item.key }}" />
```

Then set the **default insertion format to Pandoc**. The **Trigger Character**
(default `@@`) opens the search popup.

Why the Pandoc slot: of ZotFlow's four formats, only Pandoc/Footnote/Wikilink
are template-backed. Footnote also injects a definition at the document end
(junk in prose); Wikilink is likely used for research source-note links. Pandoc
inline-citation syntax is never processed by the site, so repurposing it costs
nothing — a `<Cite>` tag is meaningless in a research note and `[@key]` is
meaningless in article prose, so the two uses never collide in one file.

### Per-citation workflow

At the superscript spot, type `@@` → search by title/author → **Enter**.
ZotFlow inserts, e.g., `<Cite ids="rajDiagnosisManagementPostural2022" />`.
Drag-and-drop from the tree view works too.

### Two gotchas

1. **ZotFlow sees your whole library; the site sees only the exported
   collection.** `references.json` is auto-exported from one Better BibTeX
   collection, but `@@` will insert a `<Cite>` for *any* library item. Cite an
   item that isn't in that collection and the build fails naming the article and
   id. Discipline: only cite items you've also added to the exported collection.
   (Upside: the build is a hard backstop against stray citations.)
2. **Grouped multi-source cites need a manual merge.** ZotFlow inserts one
   citation per action, so two inserts give `<Cite ids="a" /><Cite ids="b" />`
   (two superscripts). For one grouped superscript, hand-merge into
   `<Cite ids="a b" />`. Single-source cites need no cleanup.

---

## 3. Moving a finished draft into MDX

1. **File.** Save as `src/content/articles/<kebab-case-id>.mdx`. That filename
   **is** the article id — used in the URL (`/articles/<id>`), in
   `ARTICLE_ORDER`, and in the collection.
2. **Frontmatter.** Strip any Obsidian-added properties (`tags`, `aliases`,
   `cssclasses`, …) and replace with exactly the schema:
   ```yaml
   ---
   title: 'Causes of POTS'        # browser tab title
   header: 'Causes of POTS'       # on-page <h1>
   subheader: 'One-line subtitle' # styled <p>, NOT a heading
   description: '1–2 sentence summary.'   # → meta description + OG tags
   pubDate: 2022-07-01            # bare YAML date, no quotes
   updatedDate: 2026-08-17        # optional; shown as "Last updated" when present
   collection: "About POTS"       # must be a value in COLLECTION_LIST
   type: "Deep Dives"             # Overviews | Deep Dives | Resources
   draft: true                    # optional; omit to publish (see note below)
   ---
   ```
   `collection` and `type` must match their allowed values exactly (a typo fails
   the build). In `.mdx` YAML the date is a **bare** `2022-07-01`; the quoted
   `new Date(...)` form is only for `.astro` script blocks.
3. **Convert any remaining Obsidian-native syntax** to MDX tags using the §1
   cheat sheet. Raw tags you already typed need no changes — **no imports**:
   `articles/[...slug].astro` injects `Cite`, `Figure`, `Callout`, `Toggle`, and
   the `Link` override via the MDX `components` prop.
4. **Register reading order.** Add the id to `ARTICLE_ORDER` in
   [`src/globals/articleOrder.ts`](src/globals/articleOrder.ts), or the article
   sorts to the end.
5. **Move images** into `src/images/articles/` (bare filename must match each
   `<Figure src>`).
6. **Build to validate.**
   ```bash
   npm run build
   ```
   Runs `astro check` first, so it catches a bad `collection`/`type`, an unknown
   citation key, a missing image, or a schema mismatch — naming the article and
   the problem. Build (not just `npm run dev`) also catches the trailing-slash
   URL class of bug that dev hides.

### Previewing an unfinished article (`draft: true`)

You don't have to wait until an article is finished to move it into the repo. Add
`draft: true` to its frontmatter and it is **excluded from the production build**
entirely — no page is generated, and it's absent from every listing, the nav,
prev/next, and search — while staying fully visible in `npm run dev`. So you can
convert a rough draft early, preview it live alongside the real site, and keep
iterating; delete the `draft` line (or set it to `false`) when it's ready to
publish. Because the field defaults to `false`, a normal article just omits it.
The filtering lives in one place — `getPublishedArticles()` in
[`src/globals/serverUtilities.ts`](src/globals/serverUtilities.ts) — which every
article-listing code path routes through.

---

## Component syntax quick reference

```mdx
<Cite ids="keyA keyB" />                          {/* space-separated keys */}

<Callout type="note">Body.</Callout>              {/* note | tip | warning | anecdote */}
<Callout type="warning" title="Custom label">Body.</Callout>

<Figure src="file.png" alt="Required." width="partial">
Optional caption in the body; may hold <Cite ids="key" />.
</Figure>

<Toggle summary="Plain label">Body MDX, may hold <Cite ids="key" />.</Toggle>
<Toggle summary="Item" group="faq">Accordion member.</Toggle>
```

Example usage of every component now lives in the
[`inline-components-cheat-sheet.mdx`](src/content/articles/inline-components-cheat-sheet.mdx)
article — go there to see each component and its variants used in context.
([`what-is-pots.mdx`](src/content/articles/what-is-pots.mdx) remains the throwaway
sandbox for live-testing new features.)

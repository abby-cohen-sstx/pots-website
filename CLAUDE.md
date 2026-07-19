# POTS Website

A resource site for patients with POTS (Postural Orthostatic Tachycardia Syndrome).

## Claude References
- `Cleanup Proposals.md` contains a report of all proposed bug fixes and changes; items already done are marked **✅ IMPLEMENTED** with a date, everything else is still pending

## Purpose

The site fills the gap between two kinds of existing sources:

- **Surface-level summaries** (WebMD, Mayo Clinic) — accurate but too shallow to
  actually help someone understand or manage their condition.
- **Research papers and clinical literature** — substantive but jargon-heavy and
  inaccessible to most patients.

The goal is writing that is genuinely substantive and detailed while remaining
readable by a patient with no medical background. Content should never be dumbed
down; it should be explained well.

## Scope of Claude's role

**Claude helps with web development only — never with research or medical
content.**

The user researches and writes all article content themselves. Do not:

- Draft, rewrite, fact-check, or suggest edits to article prose.
- Research POTS, its symptoms, treatments, or the underlying medical literature.

Placeholder content is allowed, but **always ask first**. Generating dummy
article text, sample content, or fake citations is fine for testing layouts,
components, and systems — just confirm before producing it, and make sure it is
obviously placeholder rather than something that could be mistaken for real
medical content.

When work touches article files (`src/content/articles/*.mdx`), limit changes to
structure, frontmatter, components, and formatting — leave the body text alone
unless the user explicitly asks otherwise. If a task seems to require medical
judgment, stop and hand it back to the user.

### Accessibility is not a POTS research question

POTS does not typically cause symptoms that interfere with website
accessibility. Treat accessibility here as ordinary good web practice — semantic
HTML, keyboard navigation, focus handling, color contrast, screen reader
support — applied for the same reasons it matters on any site.

Do not research POTS symptoms when the user asks an accessibility question. An
accessibility question is a web development question; answer it as one.

## Working with the user

The user is self-taught and still a beginner at web development. They have built
real projects but have not taken a full course, so they are missing the baseline
of conventions and best practices such a course would have provided. Gaps are in
breadth and vocabulary, not intelligence.

### Explanation style

**Explain concepts in depth by default.** Do not just make a change work and move
on — explain what the change does and why that approach is correct.

- Explanations should be thorough, well-organized, and define terms clearly.
- **Do not dumb things down.** Use real terminology and then define it, rather
  than avoiding it. Precision is more useful than simplification.
- Skip explanations of truly basic programming concepts — variables,
  conditionals, loops, functions, and similar. Assume these are known.
- **TypeScript is the exception: explain everything, including very simple
  syntax.** The user is new to TypeScript specifically, so annotations, generics,
  utility types, `as const`, type narrowing, interfaces vs. types, and even basic
  type annotations all warrant explanation when they appear.
- Web platform and framework concepts (Astro's islands and build model, SASS
  module syntax, CSS layout behavior, accessibility APIs, browser behavior)
  should also be explained — these are where the self-taught gaps are widest.

### Ask which mode we are in

The user is balancing two competing priorities: genuinely learning and
understanding everything that ends up in the project, and shipping on a tight
deadline. Neither one always wins.

**When it is ambiguous which matters more for a given task, ask.** The two modes:

1. **Guided mode** — "I want to figure this out myself with some guidance and
   hints." Claude explains the concepts, points toward the approach, and lets
   the user write the code. Do not hand over a finished solution.
2. **Ship mode** — "Just get this done and working; explain afterward if there's
   time." Claude implements it directly, keeps commentary brief, and offers a
   deeper explanation at the end that the user can take or skip.

Ask up front, before starting the work, since the answer changes the whole shape
of the response. A short question is enough — do not write out both options in
full each time.

## Tech stack

- **Astro 6** — static site generator; `.astro` components with a frontmatter
  script section and a template section.
- **MDX** (`@astrojs/mdx`) — article content, allowing Astro components inline.
- **TypeScript** — `strictNullChecks` is on; `@/*` is aliased to `src/*`.
- **SASS** — `.scss` partials in `src/styles/`.
- **Fuse.js** — client-side fuzzy search.

Commands: `npm run dev` (localhost:4321), `npm run build` (runs `astro check`
first, so type errors — including reference-store problems — fail the build),
`npm run preview`, `npm run astro check` (type checking alone).

## Architecture

### Content and articles

Articles are `.mdx` files in `src/content/articles/`, the base of the
`articles` content collection (`glob` loader in `src/content.config.js`). They
are **not** in `src/pages/` and are not file-based routes; the single dynamic
route `src/pages/articles/[...slug].astro` turns every collection entry into a
page at `/articles/<id>` via `getStaticPaths`, renders it with
`render(entry)`, and passes the entry and its extracted `headings` to
`MarkdownLayout` as props. The collection also provides the sorted/filtered
article lists used by navigation, collection pages, and search.

Article frontmatter is validated by a Zod schema in `src/content.config.js`:

| Field            | Purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| `title`          | Browser tab title                                               |
| `header`         | On-page `h1`                                                    |
| `subheader`      | Subtitle beneath the header (a styled `<p>`, **not** a heading) |
| `description`    | 1–2 sentence summary; emitted as meta description + OG tags     |
| `pubDate`        | Publication date                                                |
| `updatedDate`    | Optional; when present, shown as the "Last updated" date        |
| `collection`     | One of the values in `COLLECTION_LIST`                          |
| `type`           | `Overviews` \| `Deep Dives` \| `Resources`                      |

The article page shows "Last updated: <date>" using `updatedDate ?? pubDate`,
formatted with `timeZone: "UTC"` (YAML dates parse to midnight UTC; local
formatting would show the previous day).

**Heading convention: article prose starts at `##`** and runs `##`–`####`.
The page `h1` is the article header; the subheader is a styled `<p>`, so `##`
is the top section level. `MarkdownLayout` styles `h2`–`h4` in prose;
`TableOfContents` filters to depths 2–4 (anything outside that range is
silently excluded from the TOC — a stray `#` or `#####` is a writing error).

**Images**: article images live in `src/images/articles/` and are placed in
prose with `<Figure src="filename.png" alt="..." caption="..."
width="partial" />` (no import — injected like `Cite`). `src` is the bare
filename; an unknown filename fails the build listing available files. `alt`
is required; `caption` and `width` (`"full"` default \| `"partial"` = 60%,
centered) are optional. `Figure` uses `astro:assets` `<Image>`, so files are
optimized and resized at build time.

Frontmatter carries **no citation data** — see "References and citations"
below. Changing the schema means updating every existing article, so schema
changes are a coordinated migration, not a one-file edit.

#### References and citations

Bibliographic data lives in one central store, and citation numbers are
computed from the prose at build time. The pipeline:

1. **Zotero → `src/globals/references.json`.** A dedicated Zotero collection is
   auto-exported by the Better BibTeX plugin ("Better CSL JSON" format with
   "Keep updated") into this committed CSL-JSON file. Reference ids used
   everywhere on the site are the Better BibTeX citation keys. Setup checklist:
   install Better BibTeX; pin citation keys; right-click the collection →
   Export → "Better CSL JSON" + "Keep updated" → save to
   `src/globals/references.json`. The export only refreshes while Zotero is
   open; the file is committed, so builds never depend on Zotero running.
2. **`src/globals/references.ts`** adapts the CSL entries into the site's
   `Reference` shape at module load and throws (failing the build) on anything
   unmappable: duplicate ids, missing authors/title/link, unknown CSL types.
   Per-id corrections go in its `OVERRIDES` record; `citationOverride` is the
   escape hatch for source types the formatter has no branch for (book
   chapters etc.) — a hand-written string with `*italic segments*` marked.
3. **`src/globals/formatCitation.ts`** renders a `Reference` into AMA-ish
   citation "runs" (plain/italic segments). Three branches: journal, webpage,
   book. Dates are formatted from CSL date-parts directly, never through a
   `Date` object (a `Date` round-trip caused the old off-by-one-day bug).
4. **`<Cite ids="key1 key2" />` in prose** is the only thing an article
   author writes. No import needed — `articles/[...slug].astro` injects the
   component via `<Content components={{ Cite }} />`. The `ids` value must be
   a **plain space-separated string**, not a JSX array: the remark plugin
   reads it before any JavaScript is evaluated.
5. **`src/plugins/remark-citations.mjs`** (registered in `astro.config.mjs`)
   walks each article's AST at build time, numbers references by order of
   first appearance in the prose (repeat cites reuse their number), injects
   `nums`/`firstId` attributes that `Cite.astro` receives as props, and
   exposes the ordered id list as `remarkPluginFrontmatter.citedIds`.
6. **`MarkdownLayout.astro`** resolves `citedIds` against `REFERENCES` (a
   typo'd id fails the build naming the article and id) and hands the list to
   `ReferencesSection`, which renders a single numbered list with
   `id="ref-<id>"` anchors that the superscripts link to.

Adding a citation while writing: save the source to the Zotero collection
(step 1 keeps the JSON current), then type `<Cite ids="itskey" />` in the
prose. Numbering, renumbering, and the reference list all recompute at build.

#### Deriving an article id from the URL (currently nothing does this)

All article-page components (`PageNavigation`, `TableOfContents`,
`MarkdownLayout`, `Cite`) receive what they need as props — from the dynamic
route or via plugin-injected attributes. Never re-derive the article id from
the URL in those. If a future component genuinely must parse
`Astro.url.pathname` (e.g. one authored inside MDX prose that needs
article-level data no plugin provides), the only safe parse is:

```ts
const articleID = Astro.url.pathname.split('/').filter(Boolean).pop() ?? '';
```

`build.format` defaults to `"directory"`, so a built page is emitted at
`/articles/what-is-pots/index.html` and its pathname carries a **trailing
slash**. `filter(Boolean)` discards the empty segment that slash produces.
This class of bug is invisible during development, because `astro dev` serves
the same page without the trailing slash. It only appears on `npm run build`,
which is a good reason to build before assuming a change works.

#### Types

Types for article data are **derived from the schema** rather than written by
hand, using indexed access types:

```ts
type ReferenceList = CollectionEntry<'articles'>['data']['references'];
```

`CollectionEntry<'articles'>` is the type Astro generates from the Zod schema;
`['data']` and `['references']` index into it the way property access indexes
into a value. The payoff is that editing the schema updates these types
automatically. Keep using this pattern instead of redeclaring shapes by hand.
(Reference data is no longer part of the schema; its types live in
`src/globals/references.ts` as the exported `Reference` interface.)

### Global data and ordering

- `src/globals/articleOrder.ts` — `ARTICLE_ORDER`, a hand-maintained array of
  article ids (filenames without extension) defining site-wide reading order.
  Adding an article means adding it here, or it sorts to the end.
- `src/globals/collectionList.ts` — `COLLECTION_LIST`, the top-level groupings.
  Typed `as const` so the Zod `z.enum` can consume it.
- `src/globals/serverUtilities.ts` — build-time helpers: `sortArticles`,
  `articlesByType`, `articlesByCollectionAndType`.
- `src/globals/references.json` / `references.ts` / `formatCitation.ts` — the
  reference store and citation formatter (see "References and citations").
- `src/globals/browserUtilities.ts` — client-side helpers, notably the typed DOM
  getters `getByID`, `getByQuery`, and `getAllByQuery`, which take an expected
  element class and throw if the match is missing or the wrong type.

### Components

Grouped by role, each with a barrel `index.ts` re-exporting its members, imported
as a namespace:

- `src/components/general/` — site chrome (nav, search), imported as `G`.
- `src/components/markdownTemplate/` — article page furniture: table of contents,
  page navigation, references section, share buttons, medical disclaimer.
  Imported as `M`.
- `src/components/inlineContent/` — components used inside MDX prose:
  `Cite` (citation superscripts) and `Figure` (optimized images with
  captions). Neither is **imported in articles** — `articles/[...slug].astro`
  injects both through the MDX `components` prop, so `<Cite ids="..." />` and
  `<Figure src="..." ... />` work in any article with zero boilerplate. New
  prose components should be injected the same way.

Follow the existing pattern when adding a component: create it in the right
folder, export it from that folder's `index.ts`, and use it through the
namespace import.

### Layouts

- `BaseLayout.astro` — the html shell: head, fonts, global style imports, main
  nav, and the max-width container.
- `MarkdownLayout.astro` — wraps `BaseLayout` and supplies article structure
  (header, references, both table-of-contents variants, footer). It takes the
  article's `CollectionEntry` and `headings` as props from
  `articles/[...slug].astro`, which is the only place that renders it.

### Pages

- `articles/[...slug].astro` — the dynamic route that renders every article
  (see "Content and articles" above).
- `index.astro` — home page; still essentially a stub.
- `collections/[collection].astro` — dynamic route rendering one collection's
  articles grouped by type. The main nav's "See all…" links point here.
- `reference-sources.astro` — site-wide list of general reference sources; an
  ordered array of ids resolved against the central `REFERENCES` store.
- `search.astro` — the search UI.
- `search.json.ts` — the search index endpoint (see below).

Note a date gotcha across these two contexts: in `.mdx` frontmatter, YAML parses
`2021-06-05` into a Date automatically, but in an `.astro` script block it is
plain TypeScript, so the same value must be written `new Date("2021-06-05")`.
Zod rejects a bare string in the second case.

### Styles

- `src/styles/_variables.scss` — colors, `$max-width`, `$breakpoint`,
  `$nav-height`, spacing.
- `src/styles/_mixins.scss` — flexbox shorthand mixins and similar.
- `src/styles/_index.scss` — forwards variables and mixins; this is the file
  components `@use`.
- `src/styles/_reset.scss`, `_globals.scss`, and `_classes.scss` — the
  rule-emitting stylesheets, imported once in `BaseLayout.astro` in that order
  so globals override the reset. Some overlap remains to reconcile: `_globals`
  independently sets `margin`, `padding`, and `box-sizing` on `*`.

**Only forward files that emit no CSS through `_index.scss`.** Variables and
mixins produce no output, so every component can `@use` the index for free. A
stylesheet containing real rules would be duplicated into every component's
scoped block — and Astro's scoping would rewrite selectors like `*` with a
`data-astro-cid-*` attribute, so a forwarded reset would not even work as a
reset. Rule-emitting stylesheets get imported once in `BaseLayout.astro`.

Component-scoped styles go in `<style lang="scss">` blocks, opening with
`@use "/src/styles/index" as *;` to pull in variables and mixins.

When a value defined locally in one component turns out to be needed by another,
promote it to `_variables.scss` rather than duplicating it. `$nav-height` is the
worked example: it began inside `MainNav.astro` and moved out once `BaseLayout`
needed it for top margin.

#### Scoped styles and MDX content

Astro scopes component styles by adding a generated attribute to elements **that
component itself renders**. Content arriving through `<slot />` — which is how
all MDX article body content reaches `MarkdownLayout` — does not get that
attribute, so ordinary selectors silently fail to match it.

Styling article body elements therefore requires `:global()`:

```scss
article :global(h3) { font-weight: 600; }
```

This says "scope the `article` wrapper normally, but match `h3` descendants
globally." Keep the scoped ancestor on the outside so the rule stays contained
rather than leaking site-wide. `MarkdownLayout.astro` styles `h3`–`h5` this way,
and `TableOfContents.astro` uses the same technique to reach article headings.
Expect this to come up constantly while finishing the article-writing system —
a style that "does nothing" on article content is almost always this.

### Search

`src/pages/search.json.ts` emits a JSON endpoint of article titles, subheaders,
and ids at build time. `src/scripts/search.ts` fetches it on first search, builds
a Fuse.js index, and renders matches by assigning an HTML string to
`resultsList.innerHTML`.

That markup is assembled by string interpolation with no sanitizer. It is safe
as written, for two specific reasons worth preserving:

- The interpolated values (`title`, article `id`) come from the build-time
  search index — the project's own content, not user input.
- The user's search term is never interpolated into HTML. It reaches the DOM
  only through `textContent`, and `validateSearch` in `browserUtilities.ts`
  strips everything outside `a-z0-9` and whitespace first.

Both properties must hold for this to stay safe. If search results ever start
echoing the search term into `innerHTML`, or the index grows to include content
not authored in this repo, that changes and the markup needs escaping or a
sanitizer. Prefer building result nodes with `document.createElement` and
`textContent` over growing the `innerHTML` string — it removes the hazard by
construction rather than by convention.

## Project state and roadmap

The site is currently an **unrevised minimum viable product** — everything works
end to end, but nothing has been cleaned up or reviewed. Expect rough edges,
inconsistencies between similar files, placeholder content, and leftover
commented-out code. Treat these as known, not as discoveries worth interrupting
the current task for.

Planned phases, roughly in order:

1. **Clean up what exists** — done for the article system; other systems still
   have pending items in `Cleanup Proposals.md`.
2. **Evaluate systems for major changes** — done for the article system
   (content-collection move + reference redesign, July 2026).
3. **Finish the article-writing system** — **fundamentals complete
   (2026-07-19):** all of section 1 of `Cleanup Proposals.md` is implemented.
   Before moving to phase 4, the user wants a few inline-content additions
   (see proposal 1.15): an anecdote callout, a collapsible toggle list, a
   footnote system (design discussion needed — it must coexist cleanly with
   the numbered citation superscripts), and distinct styling for external vs
   internal links. New prose components inject via the `components` prop in
   `articles/[...slug].astro`, like `Cite` and `Figure`.
4. **Fix up the remaining systems** — search, navigation, collection pages,
   home. Starts after the 1.15 additions.
5. **Final touches** — style cleanup, polish, and accessibility improvements.

Accessibility is explicitly scheduled for the end. Still, some of it is far
cheaper to do right the first time than to retrofit across every article and
component later — semantic HTML, heading order, focus handling, form labeling.
Do those correctly as you go and mention it briefly, rather than deferring them
to phase 5.

## Conventions

- Article filenames are kebab-case; the filename is the article id used in
  `ARTICLE_ORDER`, in URLs, and in the content collection.
- Import from `src/` with the `@/` alias, not long relative paths.
- Add new components to their folder's barrel `index.ts`.
- Prefer the typed DOM getters in `browserUtilities.ts` over raw
  `document.getElementById` in client scripts.
- Run `npm run astro check` after TypeScript changes; it type-checks `.astro`
  files, which a plain `tsc` run does not.

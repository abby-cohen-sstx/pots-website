# POTS Website

A resource site for patients with POTS (Postural Orthostatic Tachycardia Syndrome).

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

When work touches article files (`src/pages/articles/*.mdx`), limit changes to
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
- **DOMPurify** — sanitizing search result markup.

Commands: `npm run dev` (localhost:4321), `npm run build`, `npm run preview`,
`npm run astro check` (type checking).

## Architecture

### Content and articles

Articles are `.mdx` files in `src/pages/articles/`. Note that this directory
serves double duty: it is both a **file-based route directory** (each file
becomes a page at `/articles/<slug>`) and the **base of a content collection**
defined in `src/content.config.js` via a `glob` loader. The collection provides
the sorted/filtered article lists used by navigation, collection pages, and
search.

Article frontmatter is validated by a Zod schema in `src/content.config.js`:

| Field            | Purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| `layout`         | Path to `MarkdownLayout.astro` (Astro's md/mdx layout field)    |
| `title`          | Browser tab title                                               |
| `header`         | On-page `h1`                                                    |
| `subheader`      | On-page `h2` beneath the header                                 |
| `pubDate`        | Publication date                                                |
| `collection`     | One of the values in `COLLECTION_LIST`                          |
| `type`           | `Overviews` \| `Deep Dives` \| `Resources`                      |
| `references`     | Optional array of citation objects, each with a string `id`     |
| `referenceOrder` | Optional array of reference `id`s setting display order         |

Changing the schema means updating every existing article, so schema changes are
a coordinated migration, not a one-file edit.

### Global data and ordering

- `src/globals/articleOrder.ts` — `ARTICLE_ORDER`, a hand-maintained array of
  article ids (filenames without extension) defining site-wide reading order.
  Adding an article means adding it here, or it sorts to the end.
- `src/globals/collectionList.ts` — `COLLECTION_LIST`, the top-level groupings.
  Typed `as const` so the Zod `z.enum` can consume it.
- `src/globals/serverUtilities.ts` — build-time helpers: `sortArticles`,
  `articlesByType`, `articlesByCollectionAndType`, `sortReferences`.
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
- `src/components/inlineContent/` — components used inside MDX prose. Currently
  `Sup`, which renders reference superscripts and takes a `targetIDs` array of
  reference ids. Imported as `i`.

Follow the existing pattern when adding a component: create it in the right
folder, export it from that folder's `index.ts`, and use it through the
namespace import.

### Layouts

- `BaseLayout.astro` — the html shell: head, fonts, global style imports, main
  nav, and the max-width container.
- `MarkdownLayout.astro` — wraps `BaseLayout` and supplies article structure
  (header, references, both table-of-contents variants, footer). Articles reach
  it through their `layout` frontmatter field.

### Styles

- `src/styles/_variables.scss` — colors, `$max-width`, `$breakpoint`, spacing.
- `src/styles/_mixins.scss` — flexbox shorthand mixins and similar.
- `src/styles/_index.scss` — forwards variables and mixins; this is the file
  components `@use`.
- `src/styles/_globals.scss` and `_classes.scss` — global element styles and
  shared utility classes, imported once in `BaseLayout.astro`.

Component-scoped styles go in `<style lang="scss">` blocks, opening with
`@use "/src/styles/index" as *;` to pull in variables and mixins.

### Search

`src/pages/search.json.ts` emits a JSON endpoint of article titles, subheaders,
and ids at build time. `src/scripts/search.ts` loads it client-side and queries
it with Fuse.js; results are sanitized with DOMPurify before insertion.

## Project state and roadmap

The site is currently an **unrevised minimum viable product** — everything works
end to end, but nothing has been cleaned up or reviewed. Expect rough edges,
inconsistencies between similar files, placeholder content, and leftover
commented-out code. Treat these as known, not as discoveries worth interrupting
the current task for.

Planned phases, roughly in order:

1. **Clean up what exists** — current phase.
2. **Evaluate systems for major changes** — decide which architectures are worth
   keeping versus reworking before more content is committed to them.
3. **Finish the article-writing system** — the highest-priority milestone. It
   needs to be fully done so the user can start writing articles in volume
   without fighting the tooling or facing another migration.
4. **Fix up the remaining systems** — search, navigation, collection pages, home.
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

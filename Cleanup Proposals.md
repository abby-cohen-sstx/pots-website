Read-only audit of the MVP, 2026-07-19. No code was changed in this pass; every
item below is a proposal. Each is graded **Urgency** (1 = small nitpick, 5 =
website-breaking) and **Scope** (1 = single-line edit, 5 = whole-system
overhaul), with the files and systems the change would touch. Items marked
**[verified in dist]** were confirmed against actual built output from
`npm run build`, not just source inspection.

`npx astro check` currently reports **0 errors, 0 warnings, 4 hints** — the
hints are all captured below. The build is clean.

---

## 1. Article Writing and Article Pages

The systems touched every time an article is written, and the article-page
template itself. Fix these first.

### 1.1 Citation dates render one day early — Urgency 4 · Scope 1

> **✅ IMPLEMENTED 2026-07-19** — subsumed by the 1.3 redesign: dates are now
> formatted from CSL date-parts directly in `formatCitation.ts`; no `Date`
> object round-trip exists anymore.

**[verified in dist]** Every date in the "Stylized" citation view is wrong:
frontmatter `2021-06-05` renders as "(Fri Jun 04 2021)", `2026-04-01` as
"(Tue Mar 31 2026)" — all five citations in `what-is-pots` are off by one day.

Cause: YAML parses `2021-06-05` as **midnight UTC**. `ReferencesSection.astro:47`
does `new Date(reference.date.toString())` and then `.toDateString()`, which
formats in the **build machine's local timezone** (US, behind UTC) — midnight
UTC is the previous evening locally. The `.toString()` → `new Date()` roundtrip
is also a fragile no-op (re-parsing a locale string).

Fix direction: format the existing Date in UTC, e.g.
`reference.date.toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" })`.
Impacts: `ReferencesSection.astro` only, but the wrong output appears on every
article with references and on `reference-sources.astro`. On a site whose whole
pitch is credibility, wrong citation dates are close to the worst cosmetic bug
possible, hence urgency 4.

### 1.2 `citation.split("*")` parsing is fragile and silently drops text — Urgency 3 · Scope 2

> **✅ IMPLEMENTED 2026-07-19** — subsumed by 1.3: citations are generated
> from structured fields; the `*` syntax survives only in the optional
> `citationOverride` escape hatch, parsed with the robust alternate-segment
> approach (any number of italic segments, no data loss).

`ReferencesSection.astro:33–38` renders the "Original" citation by splitting the
`citation` string on `*` and assuming exactly three parts: plain, italic, tail.

- A citation with **no** asterisks (e.g. the `ninds-pots` and
  `johns-hopkins-pots` entries) renders with a doubled period ("…2026..")
  because the code unconditionally appends `"."`.
- A citation with **two or more** italic segments silently drops everything
  after the second `*`-pair — actual data loss in rendered output.

This is an undocumented format contract the article writer must know. Fix
direction: map over `split("*")` treating odd indices as italic (handles any
number of segments), or store the citation as structured parts. Consider a Zod
`refine` on the schema enforcing an even count of `*`. Impacts:
`ReferencesSection.astro`, the `citation` field convention in every article,
`reference-sources.astro`.

### 1.3 Reference system redesign: central store, drop `referenceOrder` — Urgency 3 · Scope 4

> **✅ IMPLEMENTED 2026-07-19**, going beyond the proposal after discussion
> with the user. Final architecture: Zotero + Better BibTeX auto-export →
> `src/globals/references.json` (CSL-JSON) → typed adapter
> `src/globals/references.ts` → generated AMA-ish citations
> (`formatCitation.ts`). Citation numbers are auto-derived from order of first
> appearance in prose by `src/plugins/remark-citations.mjs`; authors write
> only `<Cite ids="key1 key2" />` (injected via the MDX `components` prop, no
> imports). Frontmatter carries no reference data; `referenceOrder`,
> `sortReferences`, and the `citation` string field are gone. The
> Original/Stylized toggle was removed in favor of a single numbered view
> (user decision; a card view may return via a future settings UI).
> See CLAUDE.md "References and citations" for the full pipeline.

Three compounding problems with how references work today:

1. **Duplication across files.** `diagnosis-management-cmaj` and `ninds-pots`
   are fully duplicated (~8 lines each) in `what-is-pots.mdx` frontmatter and
   `reference-sources.astro`. Every reuse of a source across articles will copy
   the whole object again; any correction must be found and fixed N times.
2. **`referenceOrder` duplicates information `references` already has.**
   Citation numbers come solely from `referenceOrder`; the order of the
   `references` array is ignored. Writers maintain two parallel lists per
   article, and a mismatch is either a build error (after the recent `Sup.astro`
   fix) or was previously a silent wrong number.
3. **Frontmatter bulk.** A 5-reference article carries ~50 lines of YAML before
   any prose. At 25+ articles this is the single biggest writing-workflow drag.

Proposed shape (decide in phase b, before mass writing): a central reference
store (e.g. `src/globals/references.ts`, or a second content collection) keyed
by id, holding the full citation objects once. Articles then list only ids, in
citation order — one array, no objects:
`references: ["state-of-the-science", "ninds-pots"]`. `Sup`,
`ReferencesSection`, `sortReferences`, and `reference-sources.astro` all read
from the store. Impacts: `content.config.js` schema, every article with
references, `Sup.astro`, `MarkdownLayout.astro`, `serverUtilities.ts`,
`ReferencesSection.astro`, `reference-sources.astro`. High leverage: this
migration gets more expensive with every article written.

Related smaller issue: the schema allows `referenceOrder` without `references`,
in which case `Sup`'s client script throws in the browser (it looks for the
toggle button that only renders when `references` is non-empty). The redesign
eliminates the case; if the redesign is rejected, add a schema `refine` tying
the two fields together.

### 1.4 Articles-in-`src/pages` dual role — the phase-b architecture decision — Urgency 3 · Scope 5

> **✅ IMPLEMENTED 2026-07-19.** Articles moved to `src/content/articles/`;
> `src/pages/articles/[...slug].astro` added (`getStaticPaths` + `render`,
> passing the entry and `headings` to `MarkdownLayout` as props). `layout`
> field removed from schema and all 25 articles (closes 1.5). `PageNavigation`
> and `TableOfContents` now take props instead of URL-parsing + `getEntry`.
> `Sup` still URL-parses (it lives inside MDX prose, so the layout cannot pass
> it props) — revisit during 1.3. Verified: built article HTML byte-identical
> to pre-migration baseline except head asset ordering and slot whitespace.

`src/pages/articles/` is simultaneously a file-based route directory and the
base of a content collection (`glob` loader in `content.config.js`). This works
but fights Astro's grain, and several existing bugs trace back to it:

- Every article must carry a `layout` frontmatter field (pure boilerplate;
  see 1.5).
- Components can't be handed their article, so `Sup`, `PageNavigation`, and
  `TableOfContents` each re-derive the article id by parsing
  `Astro.url.pathname` — the source of the trailing-slash build bug already
  fixed once in `Sup.astro`, and each does its own `getEntry` lookup.

The conventional shape: move articles to `src/content/articles/` (or similar,
outside `src/pages`), add one dynamic route
`src/pages/articles/[...slug].astro` that calls `getCollection` +
`render(entry)`, and pass the entry down as a prop through the layout to every
component that needs it. The `layout` field disappears; URL-parsing disappears;
per-component `getEntry` calls disappear.

Scope 5 but mostly mechanical; urgency 3 because doing it after 25 articles
exist means touching all of them again. Decide this **before** phase c.
Impacts: every article file, `content.config.js`, both layouts, `Sup`,
`PageNavigation`, `TableOfContents`, `MainNav` (link building unaffected),
`search.json.ts` (unaffected — already uses `getCollection`).

### 1.5 `layout` frontmatter field is per-article boilerplate — Urgency 2 · Scope 2

> **✅ IMPLEMENTED 2026-07-19** — subsumed by 1.4; field deleted from schema
> and every article.

Identical in all 25 articles and required by the schema (`z.string()` — any
typo in the path is a valid schema value but a broken page). Subsumed by 1.4;
if 1.4 is rejected, at least narrow the type to
`z.literal('/src/layouts/MarkdownLayout.astro')` so a wrong path fails loudly.

### 1.6 No `description` field in the schema; no meta description on pages — Urgency 3 · Scope 2

> **✅ IMPLEMENTED 2026-07-19** — required `description` field added to the
> schema (all 25 articles carry an obvious placeholder to replace while
> writing); `BaseLayout` takes an optional `description` prop and emits
> `<meta name="description">` + `og:title`/`og:description`. Canonical URLs,
> `og:url`/`og:image`, and the `<title>` site-name template remain with 5.1
> (blocked on site name + domain).

`BaseLayout.astro` emits no `<meta name="description">`, no Open Graph or
Twitter card tags, and no canonical URL. The schema has no summary field to
feed one. For a resource site whose purpose is being found and shared, this is
a real gap — and adding the field **after** articles are written is a
25-article migration, versus one schema line now.

Fix direction: add `description: z.string()` to the schema, pass it
`article → MarkdownLayout → BaseLayout` as a prop, emit description + OG tags
in the head. Consider `title` template `"{pageTitle} — {site name}"` while
in there (browser tabs currently just say "What is POTS?"). Ties into the
site-name decision (5.3) and `site` config (5.1). Impacts: `content.config.js`,
all articles (one new line each — cheap now), both layouts.

### 1.7 `pubDate` is required but never displayed — Urgency 2 · Scope 2

> **✅ IMPLEMENTED 2026-07-19** — optional `updatedDate` added to the schema;
> article header shows "Last updated: <date>" (`updatedDate ?? pubDate`) in a
> `<time>` element, formatted in UTC to avoid the off-by-one-day class of bug.

Every article carries `pubDate` yet no template renders it. For health content,
a visible "last updated" date is a standard credibility signal readers look
for. Decide: display it (and probably add an `updatedDate` field — a schema
change, so decide before mass writing), or drop the field. Impacts:
`content.config.js`, `MarkdownLayout.astro`, articles.

### 1.8 Article heading-level convention is implicit and unenforced — Urgency 2 · Scope 3

> **✅ IMPLEMENTED 2026-07-19** — option 1: the subheader is now a styled
> `<p class="subheader">`, prose starts at `##` (all 25 articles' headings
> shifted up one level), `MarkdownLayout` styles prose `h2`–`h4`, and the TOC
> filters to depths 2–4. Convention documented in CLAUDE.md. Note the outline
> items that remain elsewhere: 1.9 (References `<h1>`) and 2.4 (nav headings).

The template takes `h1` (header) and `h2` (subheader), so body prose must start
at `###`. Nothing documents or enforces this. Consequences of a writer using
`##`: it collides with the subheader level in the document outline, appears in
the TOC with no styling (`TableOfContents.astro` styles only `.depth3`–
`.depth5`, though it filters `depth <= 5`, letting depth 1–2 through), and
`MarkdownLayout` styles only `h3`–`h5`.

Options, roughly in order of preference:
1. Demote the subheader from `h2` to a styled `<p>` (it is a subtitle, not a
   section heading), let body prose start at `##`, shift TOC/layout styles
   accordingly. Most natural for writers; corrects the outline.
2. Keep the convention, but document it in CLAUDE.md, filter the TOC to depth
   3–5, and optionally lint headings at build time (a remark plugin can check).

Impacts: `MarkdownLayout.astro`, `TableOfContents.astro`, existing article
heading levels, CLAUDE.md. Decide before mass writing — renumbering headings
across 25 articles later is miserable.

### 1.9 `ReferencesSection` renders an `<h1>` — Urgency 3 · Scope 2

> **✅ IMPLEMENTED 2026-07-19** — heading is now `h2` by default via a
> `headingLevel` prop; `reference-sources.astro` passes `h1` since it's that
> page's only heading. Article pages now have exactly one template h1 (the
> remaining extra h1 is the nav popup's "Categories" — item 2.4).

`ReferencesSection.astro:18` puts the section heading in `<h1>`. Article pages
already have an `h1` (the article header), and the narrow-nav popup adds
another (see 2.4) — screen-reader users get up to three h1s per page, and
"References" outranks every actual content section in the outline. Should be
`h2` (with font styles adjusted). Note: on `reference-sources.astro` this
component currently provides the page's *only* heading, so that page needs its
own real `h1` added when this changes. Impacts: `ReferencesSection.astro`,
`reference-sources.astro`, heading styles.

### 1.10 Reference-highlight click handler floods browser history — Urgency 3 · Scope 2

> **✅ IMPLEMENTED 2026-07-19** — resolved by deletion: the 1.3 redesign
> removed the toggle, both `window.location.href` handlers, and the dual
> `#original:`/`#stylized:` anchor scheme (now a single `#ref-<id>`).

`ReferencesSection.astro:129–135` ("Remove highlight if user clicks away"):
every click anywhere on an article page that isn't a link or the toggle sets
`window.location.href = <url>#none`. Assigning `location.href` with a changed
hash **pushes a history entry**, so after reading an article the Back button
must be clicked once per stray page click before it actually leaves. The
handler also runs even when no hash is present.

Fix direction: only act when `window.location.hash` is non-empty, and clear it
with `history.replaceState(null, "", location.pathname + location.search)` —
replaceState rewrites the current entry instead of pushing. Same file, related:
the toggle's hash swap (lines 119–124) does `currentRef.replace("original",
"stylized")` on the **whole URL**, which would corrupt the path of any future
article whose slug contains those words — manipulate only the hash fragment.
Impacts: `ReferencesSection.astro`; behavior interacts with `Sup.astro`'s
`#original:`/`#stylized:` anchor scheme.

### 1.11 Share button does nothing; copy button has duplicate ids and silent feedback — Urgency 3 · Scope 2

> **✅ IMPLEMENTED 2026-07-19** — share button wired to `navigator.share`
> (hidden via the `hidden` attribute on browsers without it) with an
> aria-label; `id="copyLinkButton"` → class; copy feedback is a visible
> "Copied!" in a `role="status"` live region (announced by screen readers).

`LinkShareButtons.astro` (rendered twice per article, header and footer):

- The share (arrow) button has **no handler and no accessible name** — a
  prominent dead button on every article. Wire `navigator.share` with a
  clipboard fallback, or remove it until implemented.
- `id="copyLinkButton"` appears twice per page (invalid duplicate id). The
  script already works around this with `getAllByQuery("#copyLinkButton")`;
  switching to a class removes both the invalid HTML and the workaround.
- Copy feedback only swaps `aria-label`. Screen readers do not announce a
  label change on its own (an `aria-live` region would announce), and sighted
  users get no feedback at all. A brief visible "Copied!" state serves both.

Impacts: `LinkShareButtons.astro` only.

### 1.12 TOC list items share one id — Urgency 2 · Scope 2

> **✅ IMPLEMENTED 2026-07-19** — `id` → `class` on the TOC `<li>`s;
> `MarkdownLayout`'s drawer-close handler uses
> `target.closest("li.bottomTocLinks")`.

`TableOfContents.astro:26` gives **every** `<li>` in the list
`id="bottomTocLinks"` (or `sideTocLinks`) — duplicate ids in a loop.
`MarkdownLayout.astro:110` depends on it (`target.parentElement?.id ===
"bottomTocLinks"` to close the drawer on link click). Works today by accident
of how the check reads the attribute. Switch to a class and
`target.closest("li.bottomTocLinks")` (or just check for any `A` inside the
drawer). Impacts: `TableOfContents.astro` + `MarkdownLayout.astro` script.

### 1.13 Small article-template items — Urgency 1–2 · Scope 1 each

- ~~**Dead else-branch / untyped `sortedList`**~~ — **✅ fixed 2026-07-19** as
  part of the 1.4 rewrite of `MarkdownLayout`'s frontmatter handling
  (`astro check` hints dropped from 4 to 3).
- ~~**Planning comments ship to production**~~ — **✅ fixed 2026-07-19**: deleted.
- ~~**`display: auto` is not a valid CSS value**~~ — **✅ fixed 2026-07-19**:
  the entire `data-show` toggle CSS was deleted in the 1.3 redesign.
- ~~**Dead `display: flex`**~~ — **✅ fixed 2026-07-19**: removed, with a
  comment pointing at the media query that sets the real value.
- ~~**TOC label is a `<p>`**~~ — **✅ fixed 2026-07-19**: `aria-label="Table
  of contents"` on the `<nav>`; the visual `<p>` is `aria-hidden`.
- ~~**Hover-only tooltips**~~ — **✅ fixed 2026-07-19**:
  `:is(:hover, :focus-visible)` reveals them for keyboard users (touch users
  still don't get tooltips, which is normal for tooltips).
- ~~**Relative link to reference sources**~~ — **✅ fixed 2026-07-19**: now
  root-absolute `/reference-sources/` in the rewritten `ReferencesSection`.
- ~~**Hash ids contain `:`**~~ — **✅ resolved 2026-07-19**: the anchor scheme
  is now `#ref-<id>` (no colons) after the 1.3 redesign.

### 1.14 No image system for articles yet — Urgency 2 · Scope 3

> **✅ IMPLEMENTED 2026-07-19** — `Figure.astro` in `inlineContent/`, injected
> via the `components` prop like `Cite`. Authored as `<Figure src="file.png"
> alt="..." caption="..." width="full|partial" />`; images live in
> `src/images/articles/` and are resolved by filename via `import.meta.glob`
> (unknown filename fails the build listing available files); rendered with
> `astro:assets` `<Image>` for build-time optimization. `placeholder.jpg`
> moved into that folder and demoed in `what-is-pots`. No hero-image
> schema field yet — add only if a design need appears.

The planning comments name "Full width images / Partial width images";
`src/images/placeholder.jpg` is unused; there is no figure/caption component
and no decision on `astro:assets` (`<Image>`, responsive sizes, alt-text
conventions). If articles will include diagrams, this is a missing piece of
"article-writing system 100% done" — deciding it later means retrofitting
image markup across written articles. Impacts: new component(s),
`inlineContent/` barrel, possibly schema (hero images), writing conventions.

### 1.15 Planned inline-content additions — partially done (added 2026-07-19)

Status: **the fundamental article-system fixes (1.1–1.14) are all
implemented.** The user wants the following before moving on to other areas
of the site (all authored in prose and injected via the `components` prop in
`articles/[...slug].astro`, like `Cite` and `Figure`):

- ~~**Anecdote callout** — a styled block marking paragraphs that are personal
  anecdotes rather than sourced information.~~ **✅ IMPLEMENTED 2026-08-16** as
  one variant of a general callout system (see below).
- ~~**Collapsible toggle list** — expandable/collapsible content sections.~~
  **✅ IMPLEMENTED 2026-08-16** as the `<Toggle>` component (see below).
- **Footnote system** — needs a design discussion first: footnote markers
  must coexist with the numbered citation superscripts without producing two
  competing number schemes in the same prose.
- **External vs internal link styling** — visually distinguish links that
  leave the site from links to other articles.

> **✅ Callout system — IMPLEMENTED 2026-08-16.** Rather than a one-off anecdote
> block, built a general `<Callout>` admonition with four starter variants
> (`note`, `tip`, `warning`, `anecdote`), injected via the `components` prop
> like `Cite`/`Figure`. Architecture: a single registry
> (`src/components/inlineContent/callout-variants.ts`) holds each variant's
> label, accent color, and inline-SVG icon — **adding a variant is one entry
> there**, with no CSS or type edits (the `type` prop's allowed values derive
> from the registry via `keyof typeof`, so a typo fails the build). Shared
> styling lives once in `Callout.astro`; the per-variant accent flows into that
> one base rule through a `--callout-accent` CSS custom property, driving the
> border, icon, label, and a `color-mix()` background tint together. Optional
> `title` prop overrides a variant's label. Accessibility: `<aside>`, decorative
> icon `aria-hidden`, label is a styled `<p>` (kept out of the outline/TOC).
> Demoed in `what-is-pots.mdx`; verified via full `npm run build`. See CLAUDE.md
> "Content and articles" for authoring.
>
> Remaining 1.15 items still pending: footnote system (design discussion first)
> and external vs internal link styling.

> **✅ Collapsible toggle list — IMPLEMENTED 2026-08-16.** Built `<Toggle>`
> (`src/components/inlineContent/Toggle.astro`), injected via the `components`
> prop like the others. Authored as `<Toggle summary="...">body</Toggle>`; stack
> several for a "toggle list," or give a shared `group` to make an accordion.
> Design:
> - **Native `<details>`/`<summary>`** foundation — keyboard-operable and works
>   with no JS; no client script ships. The disclosure triangle is replaced by a
>   CSS-rotated chevron.
> - **Accordion via the native `name` attribute** (the `group` prop) — sharing a
>   name makes toggles mutually exclusive, again with zero JS.
> - **Rich summary via `slot="summary"`** — the plain-text `summary` prop can't
>   hold components, so a named slot (with a `<slot name="summary">{summary}</slot>`
>   fallback) lets the label carry a `<Cite>`, bold, or a link. A guard requires
>   at least one of prop/slot.
> - Accessibility: visible `:focus-visible` ring, chevron `aria-hidden`.
>
> **MDX gotcha found and documented:** a `slot="summary"` element must be a
> DIRECT child of `<Toggle>`, but MDX merges an inline element into the adjacent
> body paragraph unless a blank line separates them — which silently routes the
> label to the default slot and empties the summary. Fix: keep the slot element
> on its own line with a blank line before the body. Baked into the component's
> doc comment and its guard's error message.
>
> Also demoed: a `<Cite>` inside a toggle body and inside a summary slot, both
> numbered correctly by the remark plugin (its tree walk is recursive, so nesting
> doesn't matter). Verified via full `npm run build`. See CLAUDE.md "Content and
> articles" for authoring.

---

## 2. Navigation (MainNav, main-nav-menu.ts, NavHome)

### 2.1 Element ids contain spaces and are duplicated across the two popups — Urgency 3 · Scope 2

`MainNav.astro` builds ids from collection names: `containerForAbout POTS`,
`linkToAbout POTS`, `buttonForAbout POTS` (spaces are invalid in `id`), and
`id={`containerFor${collection}`}` is rendered **twice** — once in `#widePopup`
(line 64) and once in the narrow popup (line 138). `main-nav-menu.ts:70`
resolves it with `getElementById`, which returns the first match — the wide
popup, by DOM-order luck. Same pattern: `class={`collectionContainer
${collection}`}` splits "About POTS" into two meaningless classes (`About`,
`POTS`); only `.Resources` happens to work as a styling hook.

Fix direction: introduce slugs (see 2.2) or `data-collection` attributes and
scope queries to the popup container instead of global ids. Impacts:
`MainNav.astro`, `main-nav-menu.ts`. Also applies to
`[collection].astro:27` (`id="typetitleDeep Dives"`).

### 2.2 Collection URLs contain spaces — Urgency 2 · Scope 2

`getStaticPaths` in `[collection].astro:9` uses `collection.toLowerCase()` as
the route param, producing `/collections/about pots/` (browser-encoded to
`about%20pots`). **[verified in dist]** — the build emits a directory with a
space. Works, but ugly in the address bar and fragile with tooling.

Fix direction: one slug helper (e.g. in `collectionList.ts`: a map of
`name → slug` like `"About POTS" → "about-pots"`), used by `getStaticPaths`,
`MainNav` links (2 places), and the `PageNavigation` breadcrumb. Four call
sites, one source of truth. Impacts: `[collection].astro`, `MainNav.astro`,
`PageNavigation.astro`, `collectionList.ts`; changes public URLs (fine
pre-launch, needs redirects after).

### 2.3 Narrow-screen menu cannot be opened by keyboard — Urgency 3 · Scope 2

The mobile nav uses the CSS checkbox hack: `<input type="checkbox"
id="narrowMenuToggle" style="display:none">` toggled by `<label>` elements.
`display: none` removes the checkbox from the tab order and labels are not
focusable, so there is **no keyboard path to the entire mobile navigation**.
The wide nav is fine (its arrow `<button>`s are focusable), though those
buttons are icon-only with no `aria-label`/`aria-expanded` (fold into this
fix). Fix direction: either make the checkbox visually-hidden-but-focusable
(`clip` pattern, `:focus-visible` ring on the label via `:has`) or replace with
a real `<button>` + small script, matching the JS-driven wide nav. Impacts:
`MainNav.astro`, possibly `main-nav-menu.ts`.

### 2.4 Invalid `<menu>` content and stray headings on every page — Urgency 2 · Scope 2

The narrow popup's `<menu>` has an `<h1>Categories</h1>` child (`menu` permits
only `li`), which is also an extra h1 on **every page of the site**. The type
headings (`<h2>OVERVIEWS</h2>`) inside both popups likewise inject h2s into
every page's outline. Use styled non-heading elements (or `aria-label` on
groups) inside navigation. Impacts: `MainNav.astro`; interacts with the
heading-outline items 1.8/1.9.

### 2.5 Settings icon is dead UI — Urgency 2 · Scope 1

`SettingsIcon` renders in both navs with no click handler anywhere in the
codebase. Decision needed: what settings are planned? (The reference-style
toggle in 1.10 is a natural candidate to live there.) Until something exists,
remove or hide it — a control that does nothing erodes trust in the rest of the
UI. Impacts: `MainNav.astro`.

### 2.6 NavHome placeholder and site naming — Urgency 2 · Scope 1

`NavHome.astro` renders the literal text "Name & Logo". Meanwhile
`MedicalDisclaimer.astro` refers to the site as "Awareness for POTSies". Naming
is the user's decision; flagging that it is currently inconsistent and that the
home link, `<title>` template (1.6), favicon (5.3), and disclaimer should all
draw from one constant once decided.

### 2.7 Small nav items — Urgency 1 · Scope 1 each

- **`--js-accsssible-nav-height` typo** (three s's) — `MainNav.astro:179` and
  `main-nav-menu.ts:131`. Works (both sides misspell it identically); rename in
  both files: `--js-accessible-nav-height`.
- **`position: sticky` with no inset** — `.popupHeader`
  (`MainNav.astro:454`) — inert without `top: 0`. Intent was probably a sticky
  header while the popup scrolls; add `top: 0` or delete.
- **Unclosed comment banner** — `MainNav.astro:423`
  `/* --- POPUP MENU FOR NARROW SCREENS ---` never closes; it accidentally
  swallows the next comment and the code only works because that next comment
  supplies a `*/`. Exact edit: append `*/` to the banner line.
- **Leftover debug comment** — `main-nav-menu.ts:138`
  `// console.log(isWideNavVisible);` references a variable that no longer
  exists. Delete.

---

## 3. Search

### 3.1 `igmoreDiacritics` typo silently disables the option — Urgency 2 · Scope 1

`search.ts:16` — Fuse ignores unknown option keys, so the typo means
diacritic-insensitivity is simply off, with no error. Exact edit:
`ignoreDiacritics: true`. Related and worth deciding together:
`validateSearch` (`browserUtilities.ts:48`) strips every character outside
`a-z0-9\s` from the query — including accents and hyphens. For medical
vocabulary ("Sjögren", "Ehlers-Danlos") the query is mangled before Fuse sees
it, degrading matches the titles would otherwise make. The sanitization exists
for display/URL safety, but the term only reaches the DOM via `textContent`
and URLs via `searchParams.set` — both already safe. Consider relaxing it to
trimming + length-capping. Impacts: `search.ts`, `browserUtilities.ts`,
`SearchWidget.astro` (same validate call).

### 3.2 Hand-rolled Fuse types are wrong in ways that will bite — Urgency 2 · Scope 2

`search.ts:90–103` `fuseSearchResult`: the field is spelled `indicies` but Fuse
returns `indices`; the tuple uses boxed `Number` instead of primitive `number`
(TypeScript distinction: `Number` is the wrapper-object interface — almost
never what you want in annotations); and `SEARCH_DATA`/`FUSE_INSTANCE` are
`any`, so none of this is checked. Harmless today only because `matches` is
unused — but the `.search-highlight` CSS and the mocked-up result card in
`search.astro` show match highlighting is planned, and this type will
mislead that work. Fix direction: define a `SearchItem` interface, use Fuse's
own generics (`Fuse<SearchItem>`, `FuseResult<SearchItem>`), delete the
hand-rolled type. Impacts: `search.ts`; unblocks 3.4.

### 3.3 Stray `<li>` ships on the search page — Urgency 2 · Scope 1

**[verified in dist]** `search.astro:26–31` — an `<li>` containing only the
commented-out result-card mockup is real DOM until the first search replaces
`innerHTML`; it renders as an empty list item. Exact edit: delete the `<li>`,
keep the mockup comment outside the `<ul>`.

### 3.4 Result rendering: planned card design not implemented — Urgency 2 · Scope 3

Current results are bare `<a>` links via string-built `innerHTML`
(`search.ts:105–112`). Already-present artifacts point at the intended design:
the commented card mockup (title + description) in `search.astro`, the
`.search-highlight` yellow style in `_classes.scss`, `includeMatches: true`
in the Fuse options, and the unused `subheader` destructure (`astro check`
hint). Implementing: build result nodes with `document.createElement` +
`textContent` (per the CLAUDE.md search-safety note — highlighting spans from
match indices is exactly where string-built HTML becomes dangerous), render
subheader, wrap matched ranges using `indices`. Impacts: `search.ts`,
`search.astro`, `_classes.scss`.

### 3.5 Search index covers only titles and subheaders — Urgency 2 · Scope 3

`search.json.ts` exports `title`/`subheader`/`id` — article body text is not
searchable, which on an article site surprises users. Phase-d decision:
include body (or headings) in the index with a low weight, watch payload size
as articles grow (`body` is available on collection entries), or accept
title-only search deliberately. Impacts: `search.json.ts`, `search.ts`
weights/keys, payload size.

### 3.6 Clickable SVGs instead of buttons — Urgency 3 · Scope 2

Three components attach click handlers to raw `<svg>` elements: the clear icon
in `SearchWidget.astro`, the clear icon in `search.astro`
(`searchPageClearIcon`), and the entire `SearchIconWidget.astro`. SVGs are not
focusable and have no role or name — these controls are invisible to keyboard
and assistive tech. Wrap each in `<button type="button" aria-label="…">`.
Also: `SearchWidget`'s input has no label (`placeholder` is not a label —
it disappears on input and is not reliably announced); add `aria-label`
(the search *page* input has a proper `<label>` already). Impacts:
`SearchWidget.astro`, `SearchIconWidget.astro`, `search.astro`,
`_classes.scss` (button reset styles).

### 3.7 Small search items — Urgency 1 · Scope 1 each

- **`console.log("click")`** — `search.ts:141`. Delete.
- **Empty `?s=` param written on every page load** — `search.ts:51–55` always
  sets the param; when the term is empty, delete it instead
  (`url.searchParams.delete("s")`) for clean URLs.
- **`SearchBar.astro`** — self-described archive of the first search attempt;
  still exported from `general/index.ts`, so it compiles into the bundle.
  Remove from the barrel (and optionally delete the file — git history keeps
  it). Its empty `<script>` was already removed this session.

---

## 4. Collection Pages ([collection].astro)

### 4.1 Invalid list structure — Urgency 2 · Scope 1

`<ul class="outerContainer">` has `<div class="innerContainer">` children
(`ul` permits only `li`). The outer element isn't semantically a list at all —
make it a `<div>` (the inner per-type `<ul class="list">`s are the real lists).

### 4.2 Empty `<h1>` placeholders as layout spacers — Urgency 2 · Scope 2

Line 26: the first column gets the real `<h1>`; every other column gets
`<h1 class="h1Placeholder" aria-hidden="true"></h1>` purely to push content
down. `aria-hidden` keeps them out of the accessibility tree, but empty
headings as spacing is markup solving a CSS problem, and the real h1's column
depends on type iteration order. Fix direction: lift the `<h1>` out of the
column loop entirely, or use CSS grid with a shared header row. Interacts with
1.8/2.4 heading-outline cleanup.

---

## 5. Site Shell, SEO, and Assets

### 5.1 No SEO layer — Urgency 3 · Scope 2

Bundled because they land together in `BaseLayout.astro` + `astro.config.mjs`:

- No `site` in `astro.config.mjs` (prerequisite for sitemap and canonical
  URLs).
- No sitemap (`@astrojs/sitemap` is a one-line integration once `site` is set).
- No `robots.txt` in `public/`.
- No meta description / OG / canonical tags (schema side covered in 1.6).
- `<title>` has no site-name template.

Do after the site has a name and domain (2.6). Impacts: `astro.config.mjs`,
`BaseLayout.astro`, `public/`, `package.json`.

### 5.2 No 404 page — Urgency 2 · Scope 1

No `src/pages/404.astro`. Hosts serve their own default. One small page using
`BaseLayout` with links home/to collections.

### 5.3 Default Astro favicon — Urgency 1 · Scope 1

`public/favicon.svg` is the Astro rocket logo. Blocked on the naming/logo
decision (2.6).

### 5.4 Fonts: empty folder, CDN dependency — Urgency 2 · Scope 2

`public/fonts/` exists but is **empty**; both families (Jost, Koh Santepheap)
load from Google Fonts `<link>`s in `BaseLayout.astro`. The empty folder
suggests self-hosting was started and abandoned. Decision: self-host (removes
third-party requests — privacy-friendlier, faster, works offline) or delete
the empty folder and accept the CDN. Note `display=optional` means a
first-time visitor on slow connections may permanently get fallback fonts for
that page view — acceptable, but worth knowing it's a choice. Impacts:
`BaseLayout.astro`, `public/fonts/`, font CSS.

---

## 6. Global Styles

### 6.1 Universal selector forces color/font on every element — Urgency 2 · Scope 3

`_globals.scss:1–9`: `* { color: $primary-text-color; font-family: "Jost" }`.
Setting inherited properties on `*` (rather than on `html`/`body` and letting
inheritance work) means no element can inherit a container's color — every
themed region must re-override every descendant, and it silently neutralizes
the reset's `a:not([class]) { color: currentColor }`. Change to declarations on
`html`, then fix the fallout (components currently relying on the forced
reset). Do this **before** the phase-e styling pass, not during — it changes
the baseline everything else is judged against. Impacts: `_globals.scss`,
visual audit of every component.

### 6.2 Reset vs. globals overlap — Urgency 2 · Scope 2

`_reset.scss` (wired in this session) and `_globals.scss` disagree on
strategy: the reset does targeted `margin-block-end: 0` on specific elements;
globals nukes `margin`/`padding` on `*`, making half the reset moot (and its
`ul[role='list']` opt-in pointless since `*` already stripped list padding —
though `list-style` still applies). Consolidate into one intentional baseline
file. Pairs naturally with 6.1.

### 6.3 Placeholder palette values — Urgency 1 · Scope 1

`_variables.scss`: `$secondary-text-color` and `$secondary-background-color`
are both `#ff0000` and **unused** (verified by grep). Delete, or define the
real palette when the design pass happens. Also: hex literals are scattered
through components (`#4569EB`, `#494949`, `#747474`, `#535353`…) rather than
drawn from variables — worth consolidating during phase e, not before.

### 6.4 Z-index magic numbers — Urgency 1 · Scope 2

`100000` (bottom TOC), `1001` (narrow popup), `1000` (nav), `50`, `100`, `10`,
`5`, `3` are scattered across components. A `$z-*` scale in `_variables.scss`
makes stacking intent visible and collisions debuggable. Low urgency; high
annoyance the day two layers fight.

---

## 7. Dead Code and Hygiene Sweep

All Urgency 1 · Scope 1; exact edits, safe to batch in one commit. The first
three are `astro check` hints.

| Where | What |
| --- | --- |
| ~~`browserUtilities.ts:1`~~ | ~~Delete `import { string } from "astro:schema";`~~ **✅ done 2026-07-19** |
| `index.astro:3` | Delete unused `import * as G from "@/components/general";` |
| `search.ts:107` | Remove `subheader` from the destructure (or use it — see 3.4) |
| `search.ts:141` | Delete `console.log("click")` |
| `main-nav-menu.ts:138` | Delete stale `// console.log(isWideNavVisible);` |
| ~~`src/images/placeholder.jpg`~~ | **✅ resolved 2026-07-19** — moved to `src/images/articles/` and used by the 1.14 figure system |
| `general/index.ts` | Remove `SearchBar` export (see 3.7) |
| `content.config.js` | Rename to `.ts` — the only non-TS source file; Astro supports either |
| `tsconfig.json` | `"ignoreDeprecations": "6.0"` — investigate why it was added; remove if the underlying deprecation is gone, or leave a comment explaining it |

---

## Reviewed and deliberately not flagged

So a future pass doesn't re-litigate: `boolToString`/`stringToBool` and the
typed DOM getters in `browserUtilities.ts` are more verbose than strictly
necessary but correct and consistently used — no change proposed. Same for
`export async function GET({})`'s empty destructure in `search.json.ts`, the
inline `style=""` attributes in `MarkdownLayout.astro` (works; a phase-e
styling-pass concern at most), `BaseLayout`'s `<style>` placement after
`</body>` (Astro hoists it), and the `@/` alias inside SCSS `url()` in
`MainNav.astro` (**[verified in dist]** — compiles to an inlined data URI
correctly). The wide-nav hover/timer logic in `main-nav-menu.ts` is intricate
but sound.

## Suggested sequencing

1. Batch the section 7 sweep and the exact-edit items in 1.13, 2.7, 3.7
   (one sitting, low risk).
2. Fix the confirmed output bugs: 1.1 (dates), 1.10 (history flood), 3.3
   (stray li).
3. Make the two big decisions — 1.4 (content collection move) and 1.3
   (reference store) — before writing more articles; they set the shape of
   everything in section 1.
4. Schema additions that are cheap now, expensive later: 1.6 (description),
   1.7 (pubDate/updatedDate), 1.8 (heading convention).
5. Everything else follows the phase plan (nav/search in phase d, styles/a11y
   sweep in phase e — except the a11y items marked urgency 3, which are
   cheaper done when their component is already open).

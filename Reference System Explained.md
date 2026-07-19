# The Reference System, Explained

A companion document to the July 2026 article-system overhaul. Two changes
landed: articles moved into a proper content collection, and the reference
system was rebuilt around Zotero. This explains every concept involved, in
pipeline order. (This file is documentation for *you* — it lives outside the
site's build and can be moved into an Obsidian vault or deleted freely.)

---

## Part 1: The big picture

```
Zotero collection
      │  (Better BibTeX auto-export, "Better CSL JSON" + Keep updated)
      ▼
src/globals/references.json          ← CSL-JSON, committed to git
      │  (typed adapter, runs at build)
      ▼
src/globals/references.ts            ← REFERENCES: Record<string, Reference>
      │
      ├──► src/globals/formatCitation.ts  → citation "runs" (plain/italic)
      │         └──► ReferencesSection.astro → the numbered list, #ref-<id> anchors
      │
      └──► MarkdownLayout.astro  ← citedIds (validated against the store)
                    ▲
                    │  remarkPluginFrontmatter.citedIds
src/plugins/remark-citations.mjs  ← reads <Cite ids="..."> tags, assigns numbers
                    │
                    ▼
Cite.astro  ← receives nums/firstId as props, renders [2,3] superscript
```

The design principle throughout: **every piece of information exists in
exactly one place, and everything else is computed from it.** Bibliographic
facts live only in Zotero. Citation order lives only in the prose. Everything
that used to be hand-maintained (citation strings, `referenceOrder`, numbers)
is now derived — and a thing that is derived cannot drift out of sync.

---

## Part 2: Articles as a content collection (the earlier change)

Astro has two ways to turn a file into a page:

- **File-based routing**: any file in `src/pages/` automatically becomes a
  route. `src/pages/about.astro` → `/about`. Simple, but the page is on its
  own — nothing hands it context.
- **Content collections**: files live *outside* `src/pages/` (ours:
  `src/content/articles/`) and are registered in `src/content.config.js` with
  a **loader** (ours: `glob`, which collects every `.mdx` file in a folder)
  and a **Zod schema** that validates each file's frontmatter at build time.
  The collection is a queryable database: `getCollection("articles")` returns
  every entry, `getEntry("articles", id)` returns one.

A collection has no routes by itself. Pages come from one **dynamic route**
file, `src/pages/articles/[...slug].astro`. The bracket syntax makes the
filename a URL parameter; the `...` makes it a "rest" parameter that could
match nested paths (`a/b/c`), though our ids are flat.

A dynamic route must tell Astro, at build time, every concrete page to emit.
That is `getStaticPaths`:

```astro
export async function getStaticPaths() {
    const articles = await getCollection("articles");
    return articles.map((article) => ({
        params: { slug: article.id },   // fills [...slug] → the URL
        props: { article },             // handed to the page render
    }));
}
```

Each returned object becomes one page. `params` decides the URL; `props`
decides what data the page receives. This is the key improvement over the old
setup: **the article entry travels down as a prop.** Previously every
component (`Sup`, `PageNavigation`, `TableOfContents`) had to reverse-engineer
which article it was in by parsing `Astro.url.pathname` — the source of the
trailing-slash build bug. Now the route does one lookup and passes the entry
(and its `headings`) down through `MarkdownLayout` to everything that needs it.

`render(article)` compiles the MDX and returns three things we use:

- `Content` — a component you place where the body should go
- `headings` — the extracted heading list (feeds the table of contents,
  which no longer needs its own `getEntry` + re-render)
- `remarkPluginFrontmatter` — data that build plugins attached to the file
  (Part 6)

---

## Part 3: The data layer — CSL-JSON and Zotero

**CSL-JSON** is the standard machine-readable format for bibliographic data
(CSL = Citation Style Language, the same ecosystem Zotero uses internally to
format bibliographies). Each entry is an object with conventional field names:
`type` (`article-journal`, `webpage`, `book`, ...), `author` (an array of
`{family, given}` objects, or `{literal}` for institutional authors like
"Johns Hopkins Medicine"), `container-title` (the journal or website the work
appeared in), `issued` (a date as `{"date-parts": [[year, month, day]]}`),
`DOI`, `URL`, `volume`, `issue`, `page`.

**Better BibTeX** adds two things Zotero lacks natively:

- **Stable citation keys** — short unique ids like
  `rajDiagnosisManagementPostural2022`. These are the site's reference ids:
  the string in `<Cite ids="..." />`, the key in the store, the `#ref-...`
  anchor. *Pinning* a key writes it permanently into the item so it can never
  be silently recomputed — which matters because a changed key would break
  every article citing it.
- **Automatic export** — the "Keep updated" checkbox registers the export, so
  editing the collection rewrites `references.json` while Zotero is open.

The JSON is **committed to git** deliberately. Builds read the file, never
Zotero — so deploys, CI, and other machines work with Zotero closed.

---

## Part 4: The adapter (`references.ts`) — and most of the TypeScript

The adapter's job: convert loosely-shaped CSL entries into the site's own
`Reference` shape once, at build time, refusing loudly to guess. It is also
the densest TypeScript in the project, so here is every construct in it.

### `interface`

```ts
interface CslName {
    family?: string;
    given?: string;
    literal?: string;
}
```

An **interface** declares the shape of an object — which properties exist and
what types they hold. It exists only at compile time; it produces no
JavaScript. The `?` after a name marks the property **optional**: it may be
absent, and its type becomes `string | undefined`, which forces every reader
to handle the missing case (this is what `strictNullChecks` enforces).

`interface` vs `type`: for object shapes they are nearly interchangeable.
`type` is more general (it can alias *any* type, including unions), while
`interface` only describes objects. House style here: `interface` for object
shapes, `type` for everything else.

### Union types and literal types

```ts
export type ReferenceKind = "journal" | "webpage" | "book";
```

The `|` builds a **union**: a value of this type is one of the listed options.
The options here are **string literal types** — not "any string" but exactly
the string `"journal"`, etc. Two payoffs: assigning `"jornal"` is a compile
error, and a `switch` over a union is checked for completeness — in
`formatCitation`, TypeScript knows the three `case`s cover every possibility,
so there is no unreachable "default" case to write.

### `Record<string, Reference>`

`Record<K, V>` is a built-in **generic** utility type meaning "an object whose
keys are type K and whose values are type V." Generics are types
parameterized by other types — the angle brackets fill in the blanks. So the
store is: an object mapping citation-key strings to `Reference` objects.
Looking up `REFERENCES[id]` gives a `Reference`.

### The `as` cast on the JSON import

```ts
export const REFERENCES = buildStore(rawReferences as CslItem[]);
```

When TypeScript imports a JSON file, it infers an exact, literal type from the
file's current contents — over-specific and shaped by whatever Better BibTeX
happened to export. `as` is a **type assertion**: "treat this value as this
type." It performs no conversion and no checking at runtime; it only changes
what the compiler believes. That makes `as` a small act of trust — which is
exactly why the adapter re-validates everything at runtime with real `throw`s.
Assertion for the compiler, validation for reality.

### `never`

```ts
function fail(citekey: string, problem: string): never { throw new Error(...); }
```

`never` is the return type of a function that cannot return — it always throws
(or loops forever). Declaring it lets the compiler reason correctly: after a
call to `fail(...)`, execution cannot continue, so code paths that call it
don't need to produce a value.

### `??` and `?.`

- `a ?? b` (**nullish coalescing**): `a`, unless `a` is `null`/`undefined`,
  then `b`. Unlike `||`, it does not treat `""` or `0` as missing.
- `a?.b` (**optional chaining**): if `a` is `null`/`undefined`, the whole
  expression is `undefined` instead of crashing. Chains:
  `item.issued?.["date-parts"]?.[0]` walks three levels where any might be
  absent.

### Why the original plan's `satisfies` isn't here

The first design had you hand-typing the store as a big object literal, where

```ts
export const REFERENCES = { ... } satisfies Record<string, Reference>;
```

would make the compiler check the literal against the shape *without* widening
its type (so autocomplete on specific keys survives — that's the difference
from a plain `: Record<...>` annotation). Once Zotero became the data source,
the store stopped being a literal you type and became a value computed from
JSON — so runtime validation in `adapt()` took over the job `satisfies` would
have done at compile time. Worth keeping in your toolbox for any future
hand-authored typed data file.

### What the adapter actually validates

Every failure calls `fail(citekey, ...)`, which throws during the build —
so a bad entry stops a deploy and names itself:

| Problem | Consequence |
| --- | --- |
| duplicate citation key | build fails |
| entry with no authors / no title | build fails |
| author with neither `family` nor `literal` | build fails |
| journal article with no journal name | build fails |
| no DOI and no URL | build fails |
| CSL type with no formatter branch and no override | build fails, message says to add an override |

`OVERRIDES` is the escape hatch: a per-id `Partial<Reference>` merged over the
mapped data. `Partial<T>` is another utility type — same shape as `T` but with
every property optional, i.e. "any subset of Reference's fields." Use it for
corrections that don't belong in Zotero, and `citationOverride` (a full
hand-written citation with `*italics*` marked) for source types the formatter
can't build, like book chapters.

---

## Part 5: The formatter and the two bugs it retired

### Runs instead of strings

`formatCitation` returns `{ text: string; italic?: boolean }[]` — a list of
**runs** — rather than an HTML string. `ReferencesSection` maps runs to text
nodes and `<i>` elements. Two reasons this shape is right:

1. **No HTML assembly, no injection risk.** Text stays text all the way to the
   template; there is no string-built markup that could ever need escaping.
   (Same philosophy as the search-rendering note in CLAUDE.md: safety by
   construction beats safety by convention.)
2. **Rendering stays flexible.** The deleted "Stylized" card view — or any
   future view — can be rebuilt from the same runs/fields without touching the
   data.

The italics position depends on the source kind, which is why `kind` exists:
journal citations italicize the *journal name*, book citations italicize the
*book title*, webpages italicize nothing.

### The off-by-one date bug, properly understood

The old code did `new Date(reference.date.toString()).toDateString()`. The
chain of events: YAML parses `2021-06-05` as **midnight UTC** (the ISO-date
convention). `toDateString()` then formats in the **build machine's local
timezone** — and in any US timezone, midnight UTC is the previous evening, so
every date rendered one day early. The trap generalizes: *any* round-trip
through a `Date` object mixes UTC storage with local formatting unless you
force a timezone.

The fix removes `Date` from the pipeline entirely: CSL gives dates as parts
(`[[2022, 3, 14]]`), and `formatDateText` builds "March 14, 2022" from those
integers directly. No timezone exists anywhere in the computation, so the bug
is impossible rather than patched. (The adapter also tolerates Better BibTeX
exporting the year as a string — everything goes through `String(year)`.)

### The override parser

The old citation renderer did `split("*")` and assumed exactly three parts —
so a citation with no asterisks got a doubled period, and one with two italic
segments silently lost text. The robust version is three lines:

```ts
citation.split("*")
    .map((segment, index) => ({ text: segment, italic: index % 2 === 1 }))
    .filter((run) => run.text.length > 0);
```

Splitting on `*` alternates outside/inside pairs, so **odd indices were inside
asterisks** — italic. Any number of segments works; nothing is dropped.

---

## Part 6: The remark plugin — where citation numbers come from

### The markdown build pipeline

When Astro builds an `.mdx` file it does not treat it as text. It parses it
into an **AST** (abstract syntax tree): a tree of nodes where every paragraph,
heading, link, and JSX tag is an object with a `type` and `children`. The
pipeline has stages — **remark** operates on the markdown-shaped tree, then
**rehype** on the HTML-shaped tree, then components render. A **remark
plugin** is just a function given each file's tree *before* rendering, free to
read and modify it. Registration is one line in `astro.config.mjs`:
`mdx({ remarkPlugins: [remarkCitations] })`.

MDX extends the tree with JSX nodes: `<Cite ... />` inside a paragraph is an
`mdxJsxTextElement`; on a line of its own it would be an `mdxJsxFlowElement`.
The plugin watches for both, with `name === "Cite"`.

### Why `ids` must be a plain string

The plugin runs at *parse* time — no JavaScript has been evaluated. A plain
attribute (`ids="a b"`) is a string right there in the node. An expression
attribute (`ids={["a","b"]}`) is stored as **unevaluated source code** (an
"estree expression" — raw JS syntax tree) that only gains a value later, when
the component renders. So the space-separated-string convention isn't a
stylistic choice; it is what makes build-time reading possible. Bonus: it's
also less to type.

### The walk

The plugin recursively visits every node top-to-bottom (a ~5-line function —
no library needed). Because the visit order is document order, "first
appearance" numbering falls out for free:

- an id seen for the first time gets the next number (`numberById.size + 1`)
  and is appended to `orderedIds`
- an id seen again just reuses its number — cite the same source five times,
  it is always the same `[2]`
- numbers within one tag sort numerically so a tag never renders `[10,2]`

### The two outputs

**1. Attributes injected onto each tag.** The plugin pushes two new plain
attributes onto the node: `nums` (e.g. `"2,3"`) and `firstId`. Here is the
elegant part: when the component renders, MDX passes a JSX element's
attributes to it **as props** — and it cannot tell which attributes were typed
by the author and which were added by a plugin. So `Cite.astro` simply
declares `nums` and `firstId` in its `Props` and receives computed values as
if the author had typed them. `Cite` needs no lookup, no context, no idea
which article it is in — which is what finally killed the
pathname-parsing hack.

**2. The per-file plugin frontmatter.** The ordered id list is stored at
`file.data.astro.frontmatter.citedIds`. Astro surfaces everything a plugin
puts there as `remarkPluginFrontmatter` on the `render()` result — the bridge
from "inside the markdown pipeline" to "ordinary Astro code." The route reads
it and passes `citedIds` to `MarkdownLayout`, which is how the references
section knows what to list and in what order, without rendering the body
first.

### The renumbering chore, abolished

Under the old system, inserting a new citation into paragraph 2 of a finished
article meant manually splicing the id into `referenceOrder` at the right
position. Under this one you type the tag; every number, the list, and its
order recompute on the next build. There is no state to maintain, so there is
no state to get wrong.

---

## Part 7: The `components` prop — `<Cite>` without imports

Articles never import `Cite`. The dynamic route renders:

```astro
<Content components={{ Cite }} />
```

MDX resolves component names at render time through a lookup chain: names in
the file's own scope (imports) first, then the **components mapping** passed
to `Content`. `{{ Cite }}` is shorthand for `{{ Cite: Cite }}` — "when prose
uses `<Cite>`, render this imported component." Since the route wraps *every*
article, every article gets `Cite` for free.

This replaced a per-article `import * as i from "@/components/inlineContent"`
line (plus the `i.Sup` prefix in prose) — and retired three copies of that
import sitting unused in other articles. Any future prose component (figures,
callouts) should be added to the same mapping rather than imported per
article. The same mapping can also override plain HTML elements (e.g.
`{{ img: Figure }}` to upgrade every markdown image), which is likely how the
future image system will hook in.

One consequence worth remembering: because `Cite` is resolved at render time,
using it in prose looks like ordinary text to every other tool — which is why
drafts written in Obsidian survive copy-paste unchanged.

---

## Part 8: The loud-failure philosophy

A recurring choice in this system: **when something is wrong, stop the build
with a message that names the culprit** — never render a wrong-but-plausible
page. On a site whose entire value proposition is credibility, a silently
wrong citation is strictly worse than a build error.

Where each check lives, and why there:

| Check | Where | Why there |
| --- | --- | --- |
| store entry is unmappable (missing fields, bad type, duplicate key) | `references.ts` at module load | closest to the data; fails any build that touches the store |
| `<Cite>` is malformed (missing/expression `ids`) | remark plugin | the only stage that sees the authored attribute before evaluation |
| cited id doesn't exist in the store | `MarkdownLayout` | it knows both the article name and the id, so the error can say *"Article 'what-is-pots' cites unknown reference id 'typo-key'"* |
| store shape / TypeScript errors | `astro check`, which `npm run build` now runs first | type errors gate deploys instead of hiding in the editor |
| numbering matches prose order | nowhere | derived values can't disagree with their source; the failure mode no longer exists |

The old system's failure modes, for contrast: a `references`/`referenceOrder`
mismatch was a silent wrong number (later a runtime throw), a malformed
citation string silently dropped text, and a date was silently one day off.
Every one of those is now either impossible by construction or a named build
error.

---

## Part 9: Day-to-day operations cheat sheet

**Cite a new source:** save it to the Zotero collection → pin its key
(right-click → Better BibTeX → Pin BibTeX key) → `<Cite ids="thekey" />` in
prose. Commit the updated `references.json` alongside the article.

**Cite an already-stored source:** just the `<Cite>` tag.

**Multiple sources at once:** `<Cite ids="key1 key2" />` → renders `[2,3]`,
linking to the lower-numbered one.

**Fix bad metadata:** fix it in Zotero (the export updates); use `OVERRIDES`
in `references.ts` only for site-specific corrections, `citationOverride` for
formats the formatter can't build.

**Build fails with "unknown reference id":** typo in the article, or the
source isn't in the collection / export hasn't run (is Zotero open?).

**Build fails naming a store entry:** that Zotero item is missing a required
field — the message says which.

**Remember:** the export only refreshes while Zotero is running, and
`references.json` is a committed file like any other source.

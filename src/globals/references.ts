/*
 * CSL = Citation Style Language. CSL-JSON is the standard machine-readable format for bibliographic data
 * 
 * Source of truth: references.json, a CSL-JSON file auto-exported by
 * Zotero + Better BibTeX ("Better CSL JSON" format with "Keep updated").
 * Reference ids used in <Cite ids="..." /> are the Better BibTeX citation
 * keys.
 * 
 * Per-id corrections that shouldn't live in Zotero go in OVERRIDES below.
 * 
 * In Zotero, pin keys to ensure they are never slighly recomputed (such as changing a letter in the title).
 */

import rawReferences from "@/globals/references.json";

// --- Shapes of the CSL-JSON items Better BibTeX exports (only the fields we read) ---

interface CslName {
    family?: string; // ? marks a property as optional. Its type becomes string | undefined
    given?: string;
    literal?: string; // institutional authors ("Johns Hopkins Medicine")
}

interface CslItem {
    id: string;
    type: string;
    title?: string;
    author?: CslName[];
    "container-title"?: string; // journal name / website name / book title (for chapters)
    publisher?: string;
    volume?: string | number;
    issue?: string | number;
    page?: string;
    issued?: { "date-parts"?: number[][] };
    DOI?: string;
    URL?: string;
}

// --- The site's reference shape, consumed by formatCitation.ts ---

export type ReferenceKind = "journal" | "webpage" | "book";

export interface Reference {
    id: string;
    kind: ReferenceKind;
    authors: string; // AMA-style author run: "Raj SR, Fedorowski A, Sheldon RS" / "Vernino S, Bourne KM, Stiles LE, et al"
    title: string;
    source?: string; // journal name (italicized) / website name / publisher
    sourceDetail?: string; // journal issue info: "2022;194(10):E378-E385"
    dateText?: string; // human date for webpages: "March 13, 2026"
    year?: string; // publication year for books
    link: string;
    citationOverride?: string; // full hand-written citation, *italic segments* marked; bypasses the formatter
}

// Per-id corrections merged over the mapped CSL data. Use sparingly — fix
// metadata in Zotero when possible. citationOverride is the escape hatch for
// source types the formatter has no branch for (book chapters, preprints...).
const OVERRIDES: Record<string, Partial<Reference>> = { // Partial<T> = shape T but every property is optional
    "word-parts-foundational": {
        citationOverride:
            "Wisconsin Technical College System. Chapter 1 Foundational Concepts - Identifying Word Parts. In: *Medical Terminology*. NCBI Bookshelf; 2024.",
    },
};

// CSL types we know how to format. Anything else must supply a citationOverride.
const KIND_BY_CSL_TYPE: Record<string, ReferenceKind> = {
    "article-journal": "journal",
    "webpage": "webpage",
    "post-weblog": "webpage",
    "report": "webpage",
    "document": "webpage",
    "book": "book",
};

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

function fail(citekey: string, problem: string): never { // never = function cannot return (throws/loops forever)
    throw new Error(`references.ts: entry "${citekey}" ${problem}`);
}

// "Kate Marie" -> "KM"; already-initialed "KM" stays "KM"; hyphens split too ("Fatema-Zahra" -> "FZ")
function initialsOf(given: string): string {
    return given
        .split(/[\s.\-]+/)
        .filter(Boolean)
        .map((word) => (/^[A-Z]+$/.test(word) ? word : word[0].toUpperCase()))
        .join("");
}

// AMA convention: list all authors up to 6; for 7+, list the first 3 followed by "et al"
function formatAuthors(names: CslName[] | undefined, citekey: string): string {
    if (!names || names.length === 0) fail(citekey, "has no authors");

    const formatted = names.map((name) => {
        if (name.literal) return name.literal;
        if (!name.family) fail(citekey, "has an author with neither 'family' nor 'literal'");
        const initials = initialsOf(name.given ?? "");
        return initials ? `${name.family} ${initials}` : name.family;
    });

    if (formatted.length > 6) return `${formatted.slice(0, 3).join(", ")}, et al`;
    return formatted.join(", ");
}

// Date parts come as [year, month?, day?]. Build display text from the parts
// directly — never through a Date object, whose local-timezone formatting is
// what caused the old off-by-one-day citation bug.
function datePartsOf(item: CslItem): number[] | undefined {
    return item.issued?.["date-parts"]?.[0];
}

function formatDateText(parts: number[] | undefined): string | undefined {
    if (!parts || parts.length === 0) return undefined;
    const [year, month, day] = parts;
    if (month === undefined) return String(year);
    const monthName = MONTH_NAMES[month - 1];
    if (day === undefined) return `${monthName} ${year}`;
    return `${monthName} ${day}, ${year}`;
}

function linkOf(item: CslItem): string {
    if (item.DOI) return `https://doi.org/${item.DOI}`;
    if (item.URL) return item.URL;
    fail(item.id, "has neither a DOI nor a URL");
}

// "2022;194(10):E378-E385" — year;volume(issue):pages, skipping missing pieces
function journalDetailOf(item: CslItem, year: number | undefined): string | undefined {
    if (year === undefined) return undefined;
    let detail = String(year);
    if (item.volume !== undefined) detail += `;${item.volume}`;
    if (item.issue !== undefined) detail += `(${item.issue})`;
    if (item.page !== undefined) detail += `:${item.page}`;
    return detail;
}

function adapt(item: CslItem): Reference {
    const override = OVERRIDES[item.id] ?? {};

    const kind = KIND_BY_CSL_TYPE[item.type];
    if (kind === undefined && !override.citationOverride) {
        fail(item.id, `has CSL type "${item.type}", which the formatter can't handle — add a citationOverride in OVERRIDES`);
    }
    if (!item.title) fail(item.id, "has no title");

    const dateParts = datePartsOf(item);
    const year = dateParts?.[0];

    if (kind === "journal" && !item["container-title"]) {
        fail(item.id, "is a journal article with no container-title (journal name)");
    }

    const reference: Reference = {
        id: item.id,
        kind: kind ?? "webpage", // unused when citationOverride is set
        authors: formatAuthors(item.author, item.id),
        title: item.title,
        source: kind === "book" ? item.publisher : item["container-title"],
        sourceDetail: kind === "journal" ? journalDetailOf(item, year) : undefined,
        dateText: kind === "webpage" ? formatDateText(dateParts) : undefined,
        year: year !== undefined ? String(year) : undefined,
        link: linkOf(item),
    };

    return { ...reference, ...override };
}

function buildStore(items: CslItem[]): Record<string, Reference> {
    const store: Record<string, Reference> = {};
    for (const item of items) {
        if (!item.id) throw new Error("references.ts: found an entry with no id (citation key)");
        if (store[item.id]) fail(item.id, "appears more than once in references.json");
        store[item.id] = adapt(item);
    }
    return store;
}

export const REFERENCES: Record<string, Reference> = buildStore(rawReferences as CslItem[]);

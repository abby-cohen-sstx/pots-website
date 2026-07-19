/*
 * Renders a Reference into AMA-ish citation text.
 *
 * Output is a list of "runs" — plain segments and italic segments — because
 * the italics position depends on the reference kind (journal *name* vs book
 * *title*). ReferencesSection maps the runs to text nodes and <i> elements.
 */

import type { Reference } from "@/globals/references";

export interface CitationRun {
    text: string;
    italic?: boolean;
}

export function formatCitation(reference: Reference): CitationRun[] {
    // Escape hatch: a hand-written citation with *italic segments* marked.
    if (reference.citationOverride) return parseOverride(reference.citationOverride);

    switch (reference.kind) {
        // Raj SR, Fedorowski A, Sheldon RS. Diagnosis and management of
        // postural orthostatic tachycardia syndrome. *CMAJ*. 2022;194(10):E378-E385.
        case "journal": {
            const runs: CitationRun[] = [{ text: `${reference.authors}. ${reference.title}. ` }];
            if (reference.source) runs.push({ text: reference.source, italic: true });
            runs.push({ text: reference.sourceDetail ? `. ${reference.sourceDetail}.` : "." });
            return runs;
        }

        // National Institute of Neurological Disorders and Stroke. Postural
        // Tachycardia Syndrome (POTS). National Institutes of Health. Updated March 13, 2026.
        case "webpage": {
            let text = `${reference.authors}. ${reference.title}.`;
            if (reference.source) text += ` ${reference.source}.`;
            if (reference.dateText) text += ` Updated ${reference.dateText}.`;
            return [{ text }];
        }

        // Betts JG, Desaix P, Johnson E, et al. *Medical Terminology*. NCBI Bookshelf; 2024.
        case "book": {
            const runs: CitationRun[] = [
                { text: `${reference.authors}. ` },
                { text: reference.title, italic: true },
            ];
            const tail = reference.source
                ? `. ${reference.source}${reference.year ? `; ${reference.year}` : ""}.`
                : ".";
            runs.push({ text: tail });
            return runs;
        }
    }
}

// Split on "*": segments at odd indices were inside asterisks, so they are
// italic. Handles any number of italic segments (or none) without data loss.
function parseOverride(citation: string): CitationRun[] {
    return citation
        .split("*")
        .map((segment, index) => ({ text: segment, italic: index % 2 === 1 }))
        .filter((run) => run.text.length > 0);
}

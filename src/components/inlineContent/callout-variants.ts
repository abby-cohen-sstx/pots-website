/*
 * The callout variant registry: the single source of truth for every callout
 * type. To add a new variant, add one entry here — nothing else needs editing.
 * The <Callout> component reads its label, accent color, and icon from this map.
 *
 * Each entry:
 *   label  — the text shown in the callout header (also the accessible name;
 *            the icon is decorative/aria-hidden).
 *   accent — the accent color. Drives the left border, the icon, the header
 *            text, and a faint background tint, all from this one value.
 *   icon   — inline SVG markup, rendered as-is. Use stroke="currentColor" (or
 *            fill="currentColor") and NO width/height attributes: the component
 *            colors and sizes the icon in CSS, so it inherits the accent
 *            automatically. Icons below are 24x24 line icons (Lucide style).
 *
 * These four are a starting set — rename, recolor, reorder, or add freely.
 */

export const CALLOUT_VARIANTS = {
    note: {
        label: "Note",
        accent: "#4569EB",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    },
    tip: {
        label: "Tip",
        accent: "#2E9E5B",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>`,
    },
    warning: {
        label: "Warning",
        accent: "#D98A00",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    },
    anecdote: {
        label: "My experience",
        accent: "#8A5CF6",
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    },
} as const;

// The union of valid variant keys ("note" | "tip" | "warning" | "anecdote"),
// derived from the registry so it updates itself when you add an entry.
// keyof gives the union of an object type's keys; typeof turns the value above
// into a type to take keyof of.
export type CalloutType = keyof typeof CALLOUT_VARIANTS;

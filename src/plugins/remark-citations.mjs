/*
 * remark-citations: assigns citation numbers to <Cite ids="..." /> tags.
 *
 * A remark plugin runs at build time on each markdown/MDX file's syntax tree
 * (an AST — every paragraph, heading, and JSX tag is a node), before the file
 * is rendered to HTML. This one:
 *
 *   1. Walks the article in document order looking for <Cite> tags.
 *   2. Gives each distinct reference id a number by ORDER OF FIRST APPEARANCE
 *      in the prose (citing the same id again reuses its number).
 *   3. Writes the results onto each tag as two extra string attributes, which
 *      Cite.astro receives as ordinary props:
 *        nums    — the display numbers, e.g. "2,3"
 *        firstId — the id of the lowest-numbered reference (the link target)
 *   4. Stores the ordered list of cited ids in the file's "plugin frontmatter"
 *      (file.data.astro.frontmatter.citedIds). Astro exposes that to
 *      [...slug].astro via render(entry).remarkPluginFrontmatter, which is how
 *      the references list at the bottom of the page knows what to show, in
 *      what order.
 *
 * Authoring contract (enforced below, build fails otherwise):
 *   - ids must be a plain string of space-separated reference ids:
 *       <Cite ids="diagnosis-management-cmaj hrs-consensus" />
 *   - JSX expressions like ids={["a","b"]} are NOT supported — the plugin
 *     runs before any JavaScript is evaluated, so it can only read strings.
 *
 * This plugin does not check that ids exist in the reference store — that
 * check lives in MarkdownLayout.astro, which fails the build with the article
 * name and the offending id.
 */

// Recursively visit every node in the tree, top to bottom. Document order of
// visits is what makes "first appearance" numbering correct.
function walk(node, visitor) {
    visitor(node);
    if (node.children) {
        for (const child of node.children) walk(child, visitor);
    }
}

export function remarkCitations() {
    return (tree, file) => {
        // id -> assigned number (1-based), in order of first appearance
        const numberById = new Map();
        // the same ids as an array, index = number - 1
        const orderedIds = [];

        walk(tree, (node) => {
            // <Cite> inside a paragraph is a "text element"; on its own line
            // it's a "flow element". Both count.
            const isJsxNode = node.type === "mdxJsxTextElement" || node.type === "mdxJsxFlowElement";
            if (!isJsxNode || node.name !== "Cite") return;

            const idsAttribute = node.attributes?.find(
                (attribute) => attribute.type === "mdxJsxAttribute" && attribute.name === "ids"
            );

            if (!idsAttribute || typeof idsAttribute.value !== "string" || idsAttribute.value.trim() === "") {
                throw new Error(
                    `remark-citations: a <Cite> tag in ${file.path} is missing its ids attribute. ` +
                    `Write it as a plain space-separated string: <Cite ids="key1 key2" />`
                );
            }

            // Space-separated string -> unique id list (duplicates in one tag collapse)
            const ids = [...new Set(idsAttribute.value.trim().split(/\s+/))];

            const nums = ids
                .map((id) => {
                    if (!numberById.has(id)) {
                        numberById.set(id, numberById.size + 1);
                        orderedIds.push(id);
                    }
                    return numberById.get(id);
                })
                .sort((a, b) => a - b); // numeric sort so [2,10] doesn't render as [10,2]

            node.attributes.push(
                { type: "mdxJsxAttribute", name: "nums", value: nums.join(",") },
                { type: "mdxJsxAttribute", name: "firstId", value: orderedIds[nums[0] - 1] }
            );
        });

        // Expose the ordered cited-id list to render(entry).remarkPluginFrontmatter
        file.data.astro ??= {};
        file.data.astro.frontmatter ??= {};
        file.data.astro.frontmatter.citedIds = orderedIds;
    };
}

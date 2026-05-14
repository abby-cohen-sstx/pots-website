import * as u from "@/globals/browserUtilities";
import Fuse from 'fuse.js';
// https://www.fusejs.io/

export default function Search() {
    const input = u.getByID("searchPageInput",HTMLInputElement);
    const searchName = u.getByID("searchName",HTMLParagraphElement);
    const resultsList = u.getByID("searchResults",HTMLUListElement);
    const clearButton = u.getByID("searchPageClearIcon", SVGElement)

    
    let SEARCH_DATA: any;
    let FUSE_INSTANCE: any;

    const FUSE_OPTIONS = {
        ignoreDiacritics: true, // Ignore accents
        includeScore: true, // Return score in results set
        includeMatches: true, // Include indices of matched characters in results set
        findAllMatches: true, // Continue matching even if a perfect match has already been found
        threshold: .4, // Closer to 0 = less fuzzy, closer to 1 = more fuzzy
        // distance: 100, // 100 = default; adjust if needed to tune fuzzy results
        ignoreLocation: true,
        useExtendedSearch: false, // Could add advanced commands (see https://www.fusejs.io/examples.html#extended-search)
        useTokenSearch: true,

        keys: [
            {
                name: "title",
                weight: 0.6,
            },
            {
                name: "subheader",
                weight: .2,
            },
        ],

    }

    // --- FUNCTIONS ---

    function updateDocumentTitle(search: string = "") {
        document.title = search
            ? `Search results for "${search}"`
            : "Search All Articles";
    }

    function updateSearchName(search: string = "") {
        searchName.textContent = search
            ? `Displaying results for "${search}"`
            : "";
    }

    function updateURL(search: string = "") {
        const url = new URL(window.location.href);
        url.searchParams.set("s", search);
        window.history.replaceState(null, "", url);
    }

    async function fetchSearchData(search: string) {
        if (!SEARCH_DATA && search.length != 0) { // Only need to fetch SEARCH_DATA once
            try {
                resultsList.innerHTML = "Loading...";
                const result = await fetch("/search.json");
                if(!result.ok) {
                    throw new Error("fetchSearchData error: could not fetch search.json.ts");
                }

                const data = await result.json();
                SEARCH_DATA = data;

            } catch (error) {
                console.error(error);
            }
        }
        getSearchResults(search);
    }

    function getSearchResults(search: string) {
        if(!SEARCH_DATA) return;
        if(!FUSE_INSTANCE) { // Only need to create a new FUSE_INSTANCE once (unless config changes)
            FUSE_INSTANCE = new Fuse(SEARCH_DATA, FUSE_OPTIONS);
        }

        const searchResult = FUSE_INSTANCE.search(search);

        
        resultsList.innerHTML = searchResult.length > 0
            ? displaySearchResults(searchResult)
            : "No results found";
    }

    /* New start */

    // Shouldn't be necessary, since I already limit to characters only
    function escapeHTML(text: string) {
        return text
        /*
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
        */
    }

    function mergeIndices(indices: Array<[number, number]>) {
        return indices
            .slice()
            .sort((a, b) => a[0] - b[0])
            .reduce<Array<[number, number]>>((merged, current) => {
                if (!merged.length || current[0] > merged[merged.length - 1][1] + 1) {
                    merged.push(current.slice() as [number, number]);
                } else {
                    merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], current[1]);
                }
                return merged;
            }, []);
    }

    function highlightMatches(text: string, matches: Array<fuseMatch>, key: string) {
        const keyMatches = matches
            .filter((match) => match.key === key)
            .flatMap((match) => match.indices);

        if (!keyMatches.length) {
            console.log(text);
            return escapeHTML(text);
        }

        const ranges = mergeIndices(keyMatches);
        let lastIndex = 0;
        const highlightedParts: string[] = [];

        for (const [start, end] of ranges) {
            if (start > lastIndex) {
                highlightedParts.push(escapeHTML(text.slice(lastIndex, start)));
            }
            highlightedParts.push(
                `<span class="search-highlight">${escapeHTML(text.slice(start, end + 1))}</span>`
            );
            lastIndex = end + 1;
        }

        if (lastIndex < text.length) {
            highlightedParts.push(escapeHTML(text.slice(lastIndex)));
        }

        return highlightedParts.join("");
    }

    /* New end */

    type fuseMatch = {
        indices: Array<[number, number]>;
        key: string;
        value: string;
    }

    type fuseSearchResult = {
        item: {
            title: string,
            subheader: string,
            id: string,
        },
        matches: Array<fuseMatch>;
        refIndex: number,
        score: number
    }

    function displaySearchResults(results: Array<fuseSearchResult>) {
        return results.map((result) => {
            const {title, subheader, id } = result.item;
            const highlightedTitle = highlightMatches(title, result.matches, "title");
            const highlightedSubheader = subheader
                ? highlightMatches(subheader, result.matches, "subheader")
                : "";
            const url = new URL(`/articles/${id}`, window.location.origin);

            return `
                <li class="test">
                    <a href="${url.href}">${highlightedTitle}</a>
                    ${highlightedSubheader ? `<p class="search-subheader">${highlightedSubheader}</p>` : ""}
                </li>`;
        }).join("");
    }

    function updateSearch(searchTerm: string) {
        fetchSearchData(searchTerm);
        updateDocumentTitle(searchTerm);
        updateSearchName(searchTerm);
        updateURL(searchTerm);
    }

    // --- EVENT LISTENERS ---

    // load existing search query if available
    window.addEventListener("DOMContentLoaded", () => {
        const searchTerm = u.validateSearch(
            new URLSearchParams(window.location.search).get("s") || ""
        );
        input.value = searchTerm || "";
        input.focus();

        updateSearch(searchTerm);
    });

    // update when input value is changed
    input.addEventListener("input", () => {
        const searchTerm = u.validateSearch(input.value || "");
        updateSearch(searchTerm);
    })

    clearButton.addEventListener("click", () => {
        console.log("click");
        input.value = "";
        updateSearch("");
    })
}
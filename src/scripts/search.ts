import * as u from "@/globals/utilities";
import DOMPurify from "dompurify";
import Fuse from 'fuse.js';

export default function Search() {
    const input = u.getByQuery("#searchPageInput",HTMLInputElement);
    const searchName = u.getByQuery("#searchName",HTMLParagraphElement);
    const resultsList = u.getByQuery("#searchResults",HTMLUListElement);

    let SEARCH_DATA: any;
    let FUSE_INSTANCE: any;

    const FUSE_OPTIONS = {
        includeScore: true,

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
        const url = new URL(window.location.href)
        url.searchParams.set("s", search);;
        window.history.replaceState(null, "", url)
    }

    async function fetchSearchData(search: string) {
        if (!SEARCH_DATA && search.length != 0) {
            try {
                resultsList.innerHTML = "Loading...";
                const result = await fetch("/search.json");
                if(!result.ok) {
                    throw new Error("fetchSearchData error: could not fetch search.json.ts");
                }

                const data = await result.json();
                SEARCH_DATA = data;
                getSearchResults(search)

            } catch (error) {
                console.error(error);
            }
        }
    }

    function getSearchResults(search: string) {
        if(!SEARCH_DATA) return;
        if(!FUSE_INSTANCE) {
            FUSE_INSTANCE = new Fuse(SEARCH_DATA, FUSE_OPTIONS);
        }

        const searchResult = FUSE_INSTANCE.search(search);
        console.log(searchResult);
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
        const searchTerm = DOMPurify.sanitize(
            new URLSearchParams(window.location.search).get("s") || ""
        );
        input.value = searchTerm || "";
        input.focus();

        updateSearch(searchTerm);
    });

    // update when input value is changed
    input.addEventListener("input", () => {
        const searchTerm = DOMPurify.sanitize(input.value || "");
        updateSearch(searchTerm);
    })
}
import { getByID } from "@/globals/utilities";

const wrapper = getByID("searchWrapper", HTMLFormElement);
const searchBox = getByID("navSearch", HTMLInputElement);
const searchIcon = getByID("searchIcon", SVGElement);
const clearIcon = getByID("clearIcon", SVGElement);

export function openSearch() {
    
}

/*
export default function initSearchBar() {
    const styles = window.getComputedStyle(document.documentElement);
    const defaultWidth = styles.getPropertyValue('--default-width').trim();
    const searchHeight = styles.getPropertyValue('--search-height').trim();



    function openSearch() {
        wrapper.style.minWidth = defaultWidth;
        // clearIcon.style.display = "block";
        searchBox.style.paddingInline = searchHeight;
        searchBox.placeholder = "Search...";
    }

    function closeSearch() {
        wrapper.style.minWidth = "0";
        wrapper.style.width = searchHeight;
        // clearIcon.style.display = "none";
        searchBox.style.padding = "0";
        searchBox.value = "";
        searchBox.placeholder = "";
    }

    document.addEventListener("DOMContentLoaded", () => {
        searchBox.focus();
    });


}
    */
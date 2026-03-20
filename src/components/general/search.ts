import { getByID } from "@/globals/utilities";

export default function initSearchBar() {
    

    const styles = window.getComputedStyle(document.documentElement);
    const defaultWidth = styles.getPropertyValue('--default-width').trim();
    const searchHeight = styles.getPropertyValue('--search-height').trim();

    const searchBox = document.getElementById("navSearch");
    const searchIcon = document.getElementById("searchIcon");
    const clearIcon = document.getElementById("clearIcon")

    const wrapper = getByID("searchWrapper", HTMLElement);


}
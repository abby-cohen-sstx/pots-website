import * as u from "@/globals/browserUtilities";

export default function initMainNav() {
    const outerContainer = u.getByID("outerNavContainer", HTMLElement); // Contains the entire nav (except narrowPopup)
    const wideNavLinks = u.getByID("wideNavLinks", HTMLElement);
    const widePopup = u.getByID("widePopup", HTMLElement);

    const popupButtons = wideNavLinks.querySelectorAll<HTMLButtonElement>("button"); // Arrow buttons next to each cateogry
    const allContainers = widePopup.getElementsByClassName("collectionContainer"); // Containers for each collection represented in widePopup

    const MENU_CLOSE_DELAY = 200; // ms
    let closeTimer = 0;
    let toggleTimer = 0;
    let canToggle = true;

    let currentCollection: string | null = null;

    // Functions for wide nav popup
    function hidePopup() {
        widePopup.style.display = "none";
        popupButtons.forEach(button => { button.style.transform = "rotate(90deg)"; });
    }

    function showPopup() {
        cancelCloseTimer();
        widePopup.style.display = "flex";
    }

    function startCloseTimer() {
        cancelCloseTimer();
        closeTimer = window.setTimeout(() => {
            hidePopup();
            closeTimer = 0;
        }, MENU_CLOSE_DELAY);
    }

    function cancelCloseTimer() {
        if (closeTimer) {
            clearTimeout(closeTimer);
        }
        closeTimer = 0;
    }

    wideNavLinks.addEventListener("mouseenter", cancelCloseTimer);
    wideNavLinks.addEventListener("mouseleave", startCloseTimer);

    widePopup.addEventListener("mouseenter", cancelCloseTimer);
    widePopup.addEventListener("mouseleave", startCloseTimer);


    // Handles discrepancies in "mouseenter" triggers between mouse and touchscreen devices for arrow buttons
    function startToggleTimer() {
        cancelToggleTimer();
        canToggle = false;
        toggleTimer = window.setTimeout(() => {
            canToggle = true;
        }, 1);
    }

    function cancelToggleTimer() {
        if (toggleTimer) {
            clearTimeout(toggleTimer);
        }
        toggleTimer = 0;
        canToggle = true;
    }

    // Displays a collection's info in wide nav popup and adjusts arrow positions accordingly
    function loadCollection(collection: string) {
        const collectionContainer = document.getElementById(`containerFor${collection}`);
        if (!(collectionContainer instanceof HTMLElement)) return;

        for (const container of allContainers) {
            if (container instanceof HTMLElement && container !== collectionContainer) {
                container.style.display = "none";
            }
        }

        collectionContainer.style.display = "flex";
        currentCollection = collection;

        popupButtons.forEach(button => {
            const buttonCollection = button.id.replace(/^buttonFor/, "");
            button.style.transform = buttonCollection === collection ? "rotate(180deg)" : "rotate(90deg)";
        });
    }

    // Open popup on hover
    wideNavLinks.querySelectorAll("li").forEach(link => {
        link.addEventListener("mouseenter", () => {
            const span = link.querySelector("span");
            if (!span) return;

            showPopup();
            const collection = span.id.replace(/^linkTo/, "");
            loadCollection(collection);
            startToggleTimer();
        });
    });

    // Toggle popup on button click
    popupButtons.forEach(button => {
        button.addEventListener("click", () => {
            const collection = button.id.replace(/^buttonFor/, "");

            if (currentCollection === collection && canToggle) {
                hidePopup();
                currentCollection = null;
                cancelToggleTimer();
                return;
            }

            loadCollection(collection);
            showPopup();
            cancelToggleTimer();
        });
    });

    // Close popup if the user clicks anywhere outside of the nav bar
    document.body.addEventListener("click", event => {
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (!wideNavLinks.contains(target) && !widePopup.contains(target)) {
            hidePopup();
        }
    });

    // Hide nav bar when scrolling down; display when scrolling up
    let lastY = window.scrollY;

    const height = getComputedStyle(document.documentElement).getPropertyValue('--js-accsssible-nav-height');
    const showTransform = "translateY(0)";
    const hideTransform = `translateY(-${height})`

    window.addEventListener("scroll", () => {
        const currentY = window.scrollY;
        
        // console.log(isWideNavVisible);
        if ((currentY > lastY) && (outerContainer.style.transform != hideTransform)) { // Scrolling down
            outerContainer.style.transform = hideTransform;
            hidePopup();
        } else if ((currentY < lastY) && (outerContainer.style.transform != showTransform)) { // Scrolling up
            outerContainer.style.transform = showTransform;
        }

        lastY = currentY;
    });


}

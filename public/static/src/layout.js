// This file contains JavaScript code to manage the drawer functionality, header opacity, and section click events.
function initializeDrawer() {
    const openBtn = document.querySelector("[data-drawer-open]");
    const closeBtn = document.querySelector("[data-drawer-close]");
    const viewport = document.getElementById("content");
    const shadeElement = document.querySelector("nav>.shade");
    const MOBILE_BREAKPOINT = 1024; // Adjust this value as needed
    let isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    let wasLastMobile = isMobile;


    // Load state from localStorage
    function loadState() {
        if (!isMobile) {
            const storedState = localStorage.getItem("drawerState");
            if (storedState === "true") {
                openDrawer();
            } else {
                closeDrawer();
            }
        } else {
            closeDrawer(); // Close the drawer on mobile by default
        }
    }

    // Save state to localStorage
    function saveState(isActive) {
        if (isMobile) return; // Don't save state on mobile
        localStorage.setItem("drawerState", isActive);
    }

    function openDrawer(skipAnimation = true) {
        if (skipAnimation) {
            viewport.dataset.skipTransition = "true";
            setTimeout(() => {
                delete viewport.dataset.skipTransition;
            }, 150);
        }
        viewport.dataset.drawerActive = "true";
        saveState(true);
    }

    function closeDrawer(skipAnimation = true) {
        if (skipAnimation) {
            viewport.dataset.skipTransition = "true";
            setTimeout(() => {
                delete viewport.dataset.skipTransition;
            }, 150);
        }
        viewport.dataset.drawerActive = "false";
        saveState(false);
    }

    openBtn.addEventListener("click", () => openDrawer(false));
    closeBtn.addEventListener("click", () => closeDrawer(false));
    shadeElement.addEventListener("click", () => closeDrawer(false));

    let ticking = false;
    window.addEventListener("resize", () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                const isNowMobile = window.innerWidth < MOBILE_BREAKPOINT;
                if (isNowMobile !== wasLastMobile) {
                    wasLastMobile = isNowMobile;
                    isMobile = isNowMobile;
                    loadState();
                }
                ticking = false;
            });
            ticking = true;
        }
    });

    // Load the previous state on page load
    loadState();
}

function initializeHeaderObserver() {
    const header = document.querySelector(".header-background");

    // Create the sentinel element
    const sentinel = document.querySelector(".header-sentinel");

    const observer = new IntersectionObserver(
        ([entry]) => {
            const opacity = 1 - entry.intersectionRatio;
            header.style.opacity = opacity;
        },
        { threshold: Array.from({ length: 11 }, (_, i) => i * 0.1) } // Smooth transitions
    );

    observer.observe(sentinel);
}

function initializeSectionClick() {
    document.querySelector(".recruitment-list").addEventListener("click", function (event) {
        const header = event.target.closest(".section-header");
        if (!header) return;

        const section = header.parentElement;
        const content = section.querySelector(".section-content");

        // Function to set max-height dynamically based on content height
        const updateContentHeight = () => {
            const scrollHeight = content.scrollHeight;
            // Set the max-height dynamically to the scrollHeight
            content.style.maxHeight = `${scrollHeight}px`;
        };

        const isOpen = section.getAttribute("data-section-open") === "true";

        if (isOpen) {
            section.setAttribute("data-section-open", "false");
            
        } else {
            section.setAttribute("data-section-open", "true");
        
        }
    });
}

initializeDrawer();
initializeHeaderObserver();
initializeSectionClick();
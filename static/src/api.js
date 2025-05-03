const API_BASE_URL = "http://127.0.0.1:8000/api";
// Removed global activeToasts to use toastSystem.activeToasts consistently

export async function fetchAllTags() {
    const response = await fetch(`${API_BASE_URL}/tags`);
    if (!response.ok) {
        throw new Error(`Failed to fetch tags: ${response.status}`);
    }
    return response.json();
}

export async function fetchRecruitableOperators(tags = []) {
    const url = tags.length 
        ? `${API_BASE_URL}/filter?${tags.map(tag => `tag_ids=${tag}`).join('&')}` 
        : `${API_BASE_URL}/operators`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch operators: ${response.status}`);
        }
        return await response.json();
    }
    catch (error) {
        const message = error.name === 'TypeError'
            ? "Network error. Server Offline for the moment, try again later."
            : `Error: ${error.message}`;
        toastNotification(message, { autoDismiss: 3000, key: 12});
        throw error;
    }
}

let toastSystem = null;

function startTimer(toast, data) {
    data.startTime = Date.now();
    data.timeoutId = setTimeout(() => {
        toast.classList.add('exit');
        toast.addEventListener('animationend', () => cleanupToast(toast), { once: true });
    }, data.remaining);
}

function cleanupToast(toast) {
    if (!toast) return;
    const data = toastSystem.activeToasts.get(toast);
    if (data?.timeoutId) {
        clearTimeout(data.timeoutId);
        data.timeoutId = null;
    }
    toastSystem.activeToasts.delete(toast);  
    toastSystem.intersectionObserver.unobserve(toast);
    toast.remove();
}

function updateToast(message, options = {}) {
    let existingToastEntry = null;
    for (const [toast, data] of toastSystem.activeToasts.entries()) {
        if (data.key === options.key) {
            existingToastEntry = [toast, data];
            break;
        }
    }
    if (!existingToastEntry) return null; // No existing toast found with the same key
    // Update existing toast
    const [toast, data] = existingToastEntry;
    const { autoDismiss, clickToDismiss, hoverToPause } = options;

    toast.classList.add('update');
    toast.textContent = message;

    if (autoDismiss) {
        clearTimeout(data.timeoutId);
        data.remaining = autoDismiss;
        startTimer(toast, data);
    }

    if (clickToDismiss) {
        toast.dataset.dismissible = '';
    } else {
        delete toast.dataset.dismissible;
    }

    if (hoverToPause && autoDismiss) {
        toast.dataset.pausable = '';
    } else {
        delete toast.dataset.pausable;
    }

    // Optional: remove 'update' class after the animation
    toast.addEventListener('animationend', (event) => {
        if (event.animationName === 'toast-update') {
            toast.classList.remove('update');
        }
    }, { once: true });

    return [toast, data];
}

function toastNotification(message, {
    autoDismiss = 5000,
    clickToDismiss = false,
    hoverToPause = true,
    position = 'top', // top-left, top-right, bottom-left, bottom-right
    type = 'info', // info, success, warning, error
    key = null,
    repeat = true,
} = {}) {
    // Ensure toast system is initialized
    const system = initToasts();
    
    // Validate position
    position = position === 'bottom' ? 'bottom' : 'top';

    const toastContainer = system.container.querySelector(`.toast-container[data-toast-position="${position}"]`);
    // Check if a toast with the same key already exists to update it instead of creating a new one
    if (key && !repeat) {
        const updatedToast = updateToast(message, { autoDismiss, clickToDismiss, hoverToPause });
        if (updatedToast) return;
    }

    // Create new Toast
    const toastMessage = document.createElement("output");
    toastMessage.className = 'toast-message';
    toastMessage.dataset.type = type;
    toastMessage.dataset.toastPosition = position;

    // Set attributes
    if (key) toastMessage.dataset.key = key;
    if (clickToDismiss) toastMessage.dataset.dismissible = '';
    if (hoverToPause && autoDismiss) toastMessage.dataset.pausable = '';
    toastMessage.setAttribute("aria-live", "assertive");
    toastMessage.setAttribute("role", "status");
    toastMessage.textContent = message;

    // Set translate-y CSS variable for vertical animations
    toastMessage.style.setProperty('--translate-y', position === 'top' ? '-100%' : '100%');

    const data = {
        key,
        position,
        type,
        remaining: autoDismiss,
        startTime: Date.now(),
        timeoutId: null,
    };

    toastContainer.appendChild(toastMessage);

    if (autoDismiss) startTimer(toastMessage, data);
    toastSystem.activeToasts.set(toastMessage, data);
    return;
}

function setupToastContainer() {
    if (toastSystem?.cleanup) {
        toastSystem.cleanup();
    }
    const container = document.querySelector(".toast-notifications") || createToastContainer();

    const intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting && entry.target.classList.contains('exit')) {
                cleanupToast(entry.target);
            }
        });
    }, { threshold: 0 });

    const mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.classList?.contains('toast-message')) {
                    intersectionObserver.observe(node);
                }
            });
        });
    });

    const handleMouseover = (e) => {
        const toastMessage = e.target.closest('.toast-message[data-pausable]');
        if (toastMessage && toastSystem.activeToasts.has(toastMessage)) {
            const data = toastSystem.activeToasts.get(toastMessage);
            clearTimeout(data.timeoutId);
            const elapsed = Date.now() - data.startTime;
            data.remaining = Math.max(0, data.remaining - elapsed);
        }
    };

    const handleMouseout = (e) => {
        const toastMessage = e.target.closest('.toast-message[data-pausable]');
        if (toastMessage && toastSystem.activeToasts.has(toastMessage)) {
            const data = toastSystem.activeToasts.get(toastMessage);
            startTimer(toastMessage, data);
        }
    };

    const handleClick = (e) => {
        const toast = e.target.closest('.toast-message[data-dismissible]');
        if (toast) {
            toast.classList.add('exit');
            toast.addEventListener('animationend', (event) => {
                if (event.animationName === 'toast-exit') {
                    cleanupToast(toast);
                }
            }, { once: true });
        }
    };

    // Add event listeners using delegation
    container.addEventListener('mouseover', handleMouseover);
    container.addEventListener('mouseout', handleMouseout);
    container.addEventListener('click', handleClick);

    mutationObserver.observe(container, { childList: true });

    // Store system state
    toastSystem = {
        container: container,
        activeToasts: new WeakMap(),
        intersectionObserver,
        mutationObserver,
        handleMouseover,
        handleMouseout,
        handleClick,
        cleanup() {
            this.mutationObserver.disconnect();
            this.intersectionObserver.disconnect();
            container.removeEventListener('mouseover', this.handleMouseover);
            container.removeEventListener('mouseout', this.handleMouseout);
            container.removeEventListener('click', this.handleClick);

            // Clean up all active toasts
            for (const [toast] of this.activeToasts.entries()) {
                cleanupToast(toast);
            }
            this.activeToasts.clear();
        }
    };

    return toastSystem;
}

function createToastContainer() {
    const container = document.createElement('section');
    container.className = 'toast-notifications';
    document.body.appendChild(container);
    return container;
}

// Replace direct call with initialization function
export function initToasts() {
    if (!toastSystem) {
        console.log("Initializing toast system...");
        setupToastContainer();
    }
    return toastSystem;
}

// Add cleanup function
export function cleanupToasts() {
    if (toastSystem) {
        toastSystem.cleanup();
        toastSystem = null;
    }
}

// Initialize toasts when module loads
initToasts();
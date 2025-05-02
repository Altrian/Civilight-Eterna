const API_BASE_URL = "http://127.0.0.1:8000/api";
const activeToasts = new Map();

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

function startTimer(data, toastMessage) {
        
    data.startTime = Date.now();
    data.timeoutId = setTimeout(() => {
        toastMessage.classList.add('exit');
        toastMessage.addEventListener('animationend', () => toastMessage.remove(), { once: true });
        activeToasts.delete(toastMessage);
    }, data.remaining);
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

    let toastContainer = system.container.querySelector(`.toast-container[data-toast-position="${position}"]`);
    // Check if a toast with the same key already exists to update it instead of creating a new one
    if (key && !repeat) {
        const existingToast = Array.from(activeToasts.entries())
            .find(([toast, data]) => data.key == key);
        if (existingToast) {
            const [toast, data] = existingToast;
            toast.classList.add('update');
            toast.textContent = message;
            if (autoDismiss) {
                clearTimeout(data.timeoutId);
                data.remaining = autoDismiss;
                startTimer(data, toast);
            }

            if (clickToDismiss) toast.dataset.dismissible = '';
            if (hoverToPause && autoDismiss) toastMessage.dataset.pausable = '';
            return existingToast;
        }
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

    if (autoDismiss) startTimer(data, toastMessage);
    activeToasts.set(toastMessage, data);
}

let toastSystem = null;

function setupToastContainer() {
    if (toastSystem?.cleanup) {
        toastSystem.cleanup();
    }
    const toast = document.querySelector(".toast-notifications") || createToastContainer();

    const intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting && entry.target.classList.contains('exit')) {
                entry.target.remove();
                activeToasts.delete(entry.target);
                intersectionObserver.unobserve(entry.target);
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
            mutation.removedNodes.forEach(node => {
                if (node.classList?.contains('toast-message')) {
                    intersectionObserver.unobserve(node);
                }
            });
        });
    });

    const handleMouseover = (e) => {
        const toastMessage = e.target.closest('.toast-message[data-pausable]');
        if (toastMessage && activeToasts.has(toastMessage)) {
            const data = activeToasts.get(toastMessage);
            clearTimeout(data.timeoutId);
            const elapsed = Date.now() - data.startTime;
            data.remaining = Math.max(0, data.remaining - elapsed);
        }
    };

    const handleMouseout = (e) => {
        const toastMessage = e.target.closest('.toast-message[data-pausable]');
        if (toastMessage && activeToasts.has(toastMessage)) {
            const data = activeToasts.get(toastMessage);
            startTimer(data, toastMessage);
        }
    };

    const handleClick = (e) => {
        const toast = e.target.closest('.toast-message[data-dismissible]');
        if (toast) {
            toast.classList.add('exit');
            toast.addEventListener('animationend', (event) => {
                if (event.animationName === 'toast-exit') {
                    toast.remove();
                    activeToasts.delete(toast);
                    intersectionObserver.unobserve(toast);
                }
            }, { once: true });
        }
    };

    // Add event listeners using delegation
    toast.addEventListener('mouseover', handleMouseover);
    toast.addEventListener('mouseout', handleMouseout);
    toast.addEventListener('click', handleClick);

    mutationObserver.observe(toast, { childList: true, subtree: true });

    // Store system state
    toastSystem = {
        container: toast,
        intersectionObserver,
        mutationObserver,
        handleMouseover,
        handleMouseout,
        handleClick,
        cleanup() {
            this.mutationObserver.disconnect();
            this.intersectionObserver.disconnect();
            this.container.removeEventListener('mouseover', this.handleMouseover);
            this.container.removeEventListener('mouseout', this.handleMouseout);
            this.container.removeEventListener('click', this.handleClick);
            activeToasts.clear();
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
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
        toastNotification(message, { autoDismiss: null, key: 12});
        throw error;
    }
}

function toastNotification(message, {
    autoDismiss = 5000,
    clickToDismiss = true,
    hoverToPause = true,
    position = 'bottom-left', // top-left, top-right, bottom-left, bottom-right
    type = 'info', // info, success, warning, error
    key = null,
    repeat = false,
} = {}) {
    


    let options = { message };
    // Create or find the toast container
    let toast = document.querySelector(".toast-notifications");
    let toastContainer = toast ? toast.firstChild : null;
    if (!toast) {
        toast = document.createElement("section");
        toast.className = "toast-notifications";
        toastContainer = document.createElement("div");
        toastContainer.className = "toast-container";
        toast.appendChild(toastContainer);
        document.body.appendChild(toast);

        toastContainer.addEventListener('mouseover', (e) => {
            const toastMessage = e.target.closest('.toast-message.hover-to-pause');
            if (toastMessage && activeToasts.has(toastMessage)) {
                const data = activeToasts.get(toastMessage);
                clearTimeout(data.timeoutId);
                const elapsed = Date.now() - data.startTime;
                data.remaining -= elapsed;
            }
        });
        toastContainer.addEventListener('mouseout', (e) => {
            const toastMessage = e.target.closest('.toast-message.hover-to-pause');
            if (toastMessage && activeToasts.has(toastMessage)) {
                const data = activeToasts.get(toastMessage);
                startTimer(data, toastMessage);
            }
        });
        toastContainer.addEventListener('click', (e) => {
            const toastMessage = e.target.closest('.toast-message.clickable');
            if (toastMessage && activeToasts.has(toastMessage)) {
                toastMessage.classList.add('exit');
                toastMessage.addEventListener('animationend', () => toastMessage.remove(), { once: true });
                activeToasts.delete(toastMessage);
            }
        });
    }
    // Check if a toast with the same key already exists to update it instead of creating a new one
    if (key !== null && repeat) {
        for (let [el, data] of activeToasts.entries()) {
            if (data.key === key) {
                clearTimeout(data.timeoutId);
                data.remaining = autoDismiss; // Reset remaining time
                data.startTime = Date.now(); // Reset start time
                el.textContent = message + " (Updated)"; // Update message
                if(autoDismiss) startTimer(data, el); // Restart the timer
                return;
            }
        }
    }
    const toastMessage = document.createElement("output");
    toastMessage.className = `toast-message ${type} ${position}`;
    if (clickToDismiss) toastMessage.classList.add('clickable');
    if (hoverToPause) toastMessage.classList.add('hover-to-pause');
    toastMessage.setAttribute("aria-live", "assertive");
    toastMessage.setAttribute("role", "status");
    toastMessage.textContent = options.message;
    toastContainer.appendChild(toastMessage);

    const data = {
        key: key,
        remaining: autoDismiss,
        startTime: Date.now(),
        timeoutId: null,
    };

    function startTimer(data, toastMessage) {
        data.startTime = Date.now();
        data.timeoutId = setTimeout(() => {
            toastMessage.classList.add('exit');
            toastMessage.addEventListener('animationend', () => toastMessage.remove(), { once: true });
            activeToasts.delete(toastMessage);
        }, data.remaining);
    }

    if(autoDismiss) startTimer(data, toastMessage);
    activeToasts.set(toastMessage, data);
}
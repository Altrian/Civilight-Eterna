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
        console.error("Error fetching operators:", error);
        const message = error.name === 'TypeError'
            ? "Network error. Server Offline for the moment, try again later."
            : `Error: ${error.message}`;
        toastNotification(message, { delay: 3000 });
        throw error;
    }
}

function toastNotification(message, {delay = 5000} = {}) {
    
    let options = { message };
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
            const toastMessage = e.target.closest('.toast-message');
            if (toastMessage && activeToasts.has(toastMessage)) {
                const data = activeToasts.get(toastMessage);
                clearTimeout(data.timeoutId);
                const elapsed = Date.now() - data.startTime;
                data.remaining -= elapsed;
            }
        });
        toastContainer.addEventListener('mouseout', (e) => {
            const toastMessage = e.target.closest('.toast-message');
            if (toastMessage && activeToasts.has(toastMessage)) {
                const data = activeToasts.get(toastMessage);
                data.startTime = Date.now();
                data.timeoutId = setTimeout(() => {
                    toastMessage.classList.add('exit');
                    toastMessage.addEventListener('animationend', () => toastMessage.remove(), { once: true });
                    activeToasts.delete(toastMessage);
                }, data.remaining);
            }
        });
        toastContainer.addEventListener('click', (e) => {
            const toastMessage = e.target.closest('.toast-message');
            if (toastMessage && activeToasts.has(toastMessage)) {
                toastMessage.classList.add('exit');
                toastMessage.addEventListener('animationend', () => toastMessage.remove(), { once: true });
                activeToasts.delete(toastMessage);
            }
        });
    }

    const toastMessage = document.createElement("output");
    toastMessage.className = "toast-message";
    toastMessage.textContent = options.message;
    toastMessage.setAttribute("role", "status");
    toastContainer.appendChild(toastMessage);

    const data = {
        remaining: delay,
        startTime: Date.now(),
        timeoutId: null,
    };

    function startTimer() {
        data.startTime = Date.now();
        data.timeoutId = setTimeout(() => {
            toastMessage.classList.add('exit');
            toastMessage.addEventListener('animationend', () => toastMessage.remove(), { once: true });
            activeToasts.delete(toastMessage);
        }, data.remaining);
    }

    startTimer();
    activeToasts.set(toastMessage, data);
}
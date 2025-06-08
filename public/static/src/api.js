import { toastNotification } from "./toast.js";

const API_BASE_URL = "/api/arknights";


export async function fetchAllTags() {
    const response = await fetch(`${API_BASE_URL}/recruitment-tags`);
    if (!response.ok) {
        throw new Error(`Failed to fetch tags: ${response.status}`);
    }
    return response.json();
}

export async function fetchRecruitmentData() {
    const response = await fetch(`/static/arknights/recruitment.json`);
    if (!response.ok) {
        throw new Error(`Failed to fetch recruitment data: ${response.status}`);
    }
    return response.json();
}

export async function fetchRecruitableOperators(tags = []) {
    // Constructs the URL based on the presence of tags
    // If tags are provided, the URL will include a query string with tag IDs
    // If no tags are provided, it will fetch all operators
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
        toastNotification(message, { autoDismiss: 3000, key: 12, repeat: false });
        throw error;
    }
}
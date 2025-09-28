import { toastNotification } from "./toast.js";

const API_BASE_URL = "https://raw.githubusercontent.com/Altrian/Preservator/refs/heads/main/json";


export async function fetchRecruitmentData() {
    const response = await fetch(`${API_BASE_URL}/recruitment.json`, {
        headers: {'Accept': 'application/json', 'Accept-Encoding': 'gzip, br'}});
    return await response.json();

}

export async function fetchOperatorData(lang='en') {
    const response = await fetch(`${API_BASE_URL}/characters_${lang}.json`, {
        headers: {'Accept': 'application/json', 'Accept-Encoding': 'gzip, br'}});
    return await response.json();
}
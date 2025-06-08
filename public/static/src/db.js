const dbName = "arknightsDB";
const dbVersion = 1;
let db;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains("tags")) {
                db.createObjectStore("tags", { keyPath: "id" });
}
            if (!db.objectStoreNames.contains("operators")) {
                store = db.createObjectStore("operators", { keyPath: "id" });
                store.createIndex("tagsIndex", "tags", { multiEntry: true });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

export async function saveToDB(storeName, data) {
    const db = await openDB();
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);

    data.forEach(item => store.put(item));

    return transaction.complete;
}

export async function getFromDB(storeName) {
    const db = await openDB();
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);

    return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

export async function isLocalDataOutdated(storeName, remoteDateStr) {
    const db = await openDB();
    const tx = db.transaction("meta", "readonly");
    const metaStore = tx.objectStore("meta");

    return new Promise((resolve) => {
        const request = metaStore.get(`${storeName}-updatedAt`);
        request.onsuccess = () => {
            const localDateStr = request.result?.value;
            if (!localDateStr) return resolve(true); // No local date means outdated
            resolve(remoteDateStr > localDateStr);  // Compare YYYY-MM-DD strings lexicographically
        };
        request.onerror = () => resolve(true); // On error, assume it's outdated
    });
}
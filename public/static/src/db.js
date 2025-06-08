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
                db.createObjectStore("operators", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("meta")) {
                db.createObjectStore("meta", { keyPath: "key" }); // e.g., key: 'tags-updatedAt'
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

export async function saveToDB(storeName, storeData) {
    const db = await openDB();
    const transaction = db.transaction([storeName, "meta"], "readwrite");
    const store = transaction.objectStore(storeName);
    const metaStore = transaction.objectStore("meta");

    storeData.data.forEach(item => store.put(item));
    metaStore.put({
        key: `${storeName}-updatedAt`,
        value: storeData.updatedAt
    });

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

export async function isLocalDataOutdated(storeName, remoteDateStr, db) {
    const db = db || await openDB();
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
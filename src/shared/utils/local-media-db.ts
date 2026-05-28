const DB_NAME = "smartnotes-local-media";
const DB_VERSION = 1;
const STORE_NAME = "media";

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported or not available on server-side."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      reject(request.error || new Error("Failed to open IndexedDB"));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function storeLocalMedia(id: string, blob: Blob): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(blob, id);
    
    request.onerror = () => {
      reject(request.error || new Error("Failed to store media in IndexedDB"));
    };
    
    request.onsuccess = () => {
      resolve();
    };
  });
}

export async function getLocalMedia(id: string): Promise<Blob | null> {
  if (typeof window === "undefined") return null;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      
      request.onerror = () => {
        reject(request.error || new Error("Failed to get media from IndexedDB"));
      };
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
    });
  } catch (error) {
    console.error("IndexedDB error retrieving local media:", error);
    return null;
  }
}

export async function deleteLocalMedia(id: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      
      request.onerror = () => {
        reject(request.error || new Error("Failed to delete media from IndexedDB"));
      };
      
      request.onsuccess = () => {
        resolve();
      };
    });
  } catch (error) {
    console.error("IndexedDB error deleting local media:", error);
  }
}

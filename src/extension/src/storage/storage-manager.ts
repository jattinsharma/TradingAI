// Storage manager for handling data persistence
export class StorageManager {
  // Set data in local storage (device-specific)
  async set<T = any>(key: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const obj: Record<string, T> = {};
      obj[key] = value;
      chrome.storage.local.set(obj, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  // Get data from local storage
  async get<T = any>(key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[key] as T | undefined);
        }
      });
    });
  }

  // Remove data from local storage
  async remove(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(key, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  // Clear all local storage
  async clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  // Set data in local storage (alias for set)
  async setLocal<T = any>(key: string, value: T): Promise<void> {
    return this.set(key, value);
  }

  // Get data from local storage (alias for get)
  async getLocal<T = any>(key: string): Promise<T | undefined> {
    return this.get<T>(key);
  }

  // Remove data from local storage (alias for remove)
  async removeLocal(key: string): Promise<void> {
    return this.remove(key);
  }

  // Clear all local storage (alias for clear)
  async clearLocal(): Promise<void> {
    return this.clear();
  }

  // Set data in sync storage (syncs across devices)
  async setSync<T = any>(key: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const obj: Record<string, T> = {};
      obj[key] = value;
      chrome.storage.sync.set(obj, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  // Get data from sync storage
  async getSync<T = any>(key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[key] as T | undefined);
        }
      });
    });
  }

  // Remove data from sync storage
  async removeSync(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.remove(key, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  // Clear all sync storage
  async clearSync(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.clear(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
}
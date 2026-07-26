// Storage manager for handling data persistence
export class StorageManager {
  constructor() {}

  // Set data in local storage (device-specific)
  async set(key: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const obj: { [key: string]: any } = {};
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
  async get(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[key]);
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
  async setLocal(key: string, value: any): Promise<void> {
    return this.set(key, value);
  }

  // Get data from local storage (alias for get)
  async getLocal(key: string): Promise<any> {
    return this.get(key);
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
  async setSync(key: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const obj: { [key: string]: any } = {};
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
  async getSync(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result[key]);
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
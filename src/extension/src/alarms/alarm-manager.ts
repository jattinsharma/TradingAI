/**
 * Alarm manager for scheduling periodic tasks.
 * Uses chrome.alarms API with proper typing from chrome-alarms.d.ts.
 */
export class AlarmManager {
  private listenerId: number = 0;
  private listeners: Map<number, (alarm: chrome.alarms.Alarm) => void> = new Map();

  constructor() {
    // Register the single chrome.alarms.onAlarm listener that dispatches to registered callbacks
    chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
      this.listeners.forEach((callback) => {
        callback(alarm);
      });
    });
  }

  /** Create a repeating alarm. */
  createAlarm(name: string, periodInMinutes: number): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.alarms.create(name, { periodInMinutes }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  /** Create a one-time alarm. */
  createOneTimeAlarm(name: string, delayInMinutes: number): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.alarms.create(name, { delayInMinutes }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  /** Clear a specific alarm. */
  clearAlarm(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.alarms.clear(name, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  /** Clear all alarms. */
  clearAll(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.alarms.clearAll(() => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  /** Get all registered alarms. */
  getAll(): Promise<chrome.alarms.Alarm[]> {
    return new Promise((resolve, reject) => {
      chrome.alarms.getAll((alarms) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(alarms || []);
        }
      });
    });
  }

  /** Get a specific alarm by name. */
  get(name: string): Promise<chrome.alarms.Alarm | null> {
    return new Promise((resolve, reject) => {
      chrome.alarms.get(name, (alarm) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(alarm || null);
        }
      });
    });
  }

  /** Register a callback for all alarm events. Returns a listener ID for removal. */
  onAlarm(callback: (alarm: chrome.alarms.Alarm) => void): number {
    this.listenerId++;
    this.listeners.set(this.listenerId, callback);
    return this.listenerId;
  }

  /** Remove a previously registered listener by ID. */
  removeListener(listenerId: number): void {
    this.listeners.delete(listenerId);
  }
}

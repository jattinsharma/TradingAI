// Alarm manager for scheduling periodic tasks
export class AlarmManager {
  constructor() {}

  // Create a repeating alarm
  createAlarm(name: string, periodInMinutes: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // @ts-ignore: Ignore type checking for chrome.alarms.create
      (chrome.alarms.create as any)(name, { periodInMinutes: periodInMinutes }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  // Create a one-time alarm
  createOneTimeAlarm(name: string, delayInMinutes: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // @ts-ignore: Ignore type checking for chrome.alarms.create
      (chrome.alarms.create as any)(name, { delayInMinutes: delayInMinutes }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  // Clear an alarm
  clearAlarm(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // @ts-ignore: Ignore type checking for chrome.alarms.clear
      (chrome.alarms.clear as any)(name, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  // Clear all alarms
  clearAll(): Promise<void> {
    return new Promise((resolve, reject) => {
      // @ts-ignore: Ignore type checking for chrome.alarms.clearAll
      (chrome.alarms.clearAll as any)(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  // Get all alarms
  getAll(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // @ts-ignore: Ignore type checking for chrome.alarms.getAll
      (chrome.alarms.getAll as any)((alarms) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(alarms);
        }
      });
    });
  }

  // Get a specific alarm
  get(name: string): Promise<any | null> {
    return new Promise((resolve, reject) => {
      // @ts-ignore: Ignore type checking for chrome.alarms.get
      (chrome.alarms.get as any)(name, (alarm) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(alarm || null);
        }
      });
    });
  }

  // Add listener for alarm events
  onAlarm(callback: (alarm: any) => void): number {
    // @ts-ignore: Ignore type checking for chrome.alarms.onAlarm
    const listener = (chrome.alarms.onAlarm as any).addListener(callback);
    // Return a listener ID that can be used to remove the listener
    return Date.now() + Math.random(); // Simple ID generation
  }

  // Remove alarm listener (simplified - in practice you'd need to track listeners)
  removeListener(listenerId: number): void {
    // Note: Chrome alarms don't provide a direct way to remove specific listeners
    // This is a simplified implementation
  }
}
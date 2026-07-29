/**
 * Type declarations for chrome.alarms API (Manifest V3).
 *
 * These are needed because the installed @types/chrome may not
 * include the alarms API or may have incomplete signatures.
 *
 * Chrome.alarms API reference:
 * https://developer.chrome.com/docs/extensions/reference/api/alarms
 */
declare namespace chrome {
  namespace alarms {
    interface AlarmCreateInfo {
      when?: number;
      delayInMinutes?: number;
      periodInMinutes?: number;
    }

    interface Alarm {
      name: string;
      scheduledTime: number;
      periodInMinutes?: number;
    }

    function create(name: string, alarmInfo: AlarmCreateInfo, callback?: () => void): void;
    function get(name: string, callback: (alarm: Alarm | undefined) => void): void;
    function getAll(callback: (alarms: Alarm[]) => void): void;
    function clear(name: string, callback?: (wasCleared: boolean) => void): void;
    function clearAll(callback?: (wasCleared: boolean) => void): void;

    const onAlarm: {
      addListener(callback: (alarm: Alarm) => void): void;
      removeListener(callback: (alarm: Alarm) => void): void;
      hasListener(callback: (alarm: Alarm) => void): boolean;
    };
  }
}

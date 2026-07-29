/**
 * Messaging utilities for extension communication.
 *
 * All messages flow through chrome.runtime.sendMessage to the background service worker.
 *
 * ── sendMessageToBackend  – send message to background (content script ↔ background)
 * ── sendMessageToTab      – send message to a specific tab (background ↔ content script)
 * ── onMessage             – register a listener for incoming messages
 */

export interface MessagePayload {
  type: string;
  payload?: unknown;
  [key: string]: unknown;
}

export function sendMessageToBackend<T = any>(message: MessagePayload): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: T) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

export function sendMessageToTab<T = any>(tabId: number, message: MessagePayload): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response: T) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Register a listener for messages from background/popup.
 * Returns the listener for later removal (cleanup on SPA navigation).
 */
export function onMessage(
  callback: (
    message: MessagePayload,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void,
  ) => boolean | void,
): (
  message: MessagePayload,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => void {
  chrome.runtime.onMessage.addListener(callback as Parameters<typeof chrome.runtime.onMessage.addListener>[0]);
  return callback;
}
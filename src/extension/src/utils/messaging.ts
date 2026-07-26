// Messaging utilities for extension communication
export function sendMessageToBackend(message: any) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

export function sendMessageToTab(tabId: number, message: any) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

export function sendMessageToPopup(message: any) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

export function broadcastMessage(message: any) {
  chrome.runtime.sendMessage(message);
}

// Listen for messages from background
export function onMessage(callback: (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response: any) => void) => boolean | void) {
  return chrome.runtime.onMessage.addListener(callback);
}
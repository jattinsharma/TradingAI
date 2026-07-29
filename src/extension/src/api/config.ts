/**
 * Centralized backend URL configuration for the AI Trading Copilot extension.
 *
 * ── Environment Strategy ──
 * Chrome extensions don't have build-time environment variables with the current
 * webpack setup. Instead, we use a runtime strategy:
 *
 * 1. Load saved URL from chrome.storage (user may configure via Options page)
 * 2. Fall back to PRODUCTION_BACKEND_URL if nothing is stored
 * 3. Allow runtime override via setBackendUrl() for dynamic reconfiguration
 *
 * ── Local Development ──
 * To use a local backend during development:
 * a) Open the extension's Options page (right-click extension icon → Settings)
 * b) Go to the "Connection" tab
 * c) Change the Backend URL to: http://localhost:3000
 * d) Click "Connect"
 *
 * Or set it programmatically:
 *   import { setBackendUrl } from './config';
 *   setBackendUrl('http://localhost:3000');
 */

export const PRODUCTION_BACKEND_URL = 'https://tradingai-4dq2.onrender.com';
export const LOCAL_BACKEND_URL = 'http://localhost:3000';

const STORAGE_KEY = 'backendUrl';

let cachedUrl: string | null = null;

/**
 * Promisify chrome.storage.local.get() for compatibility with older @types/chrome
 * that may only define the callback-based API.
 */
function storageGet(key: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get(key, (items: Record<string, unknown>) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(items);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Returns the current backend URL.
 * - If cached, returns cached value.
 * - If chrome.storage is available, reads from storage.
 * - Falls back to PRODUCTION_BACKEND_URL.
 */
export async function getBackendUrl(): Promise<string> {
  if (cachedUrl) return cachedUrl;

  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await storageGet(STORAGE_KEY);
      const stored = result[STORAGE_KEY];
      if (stored && typeof stored === 'string' && stored.trim().length > 0) {
        cachedUrl = stored.trim().replace(/\/+$/, '');
        return cachedUrl;
      }
    }
  } catch {
    // chrome.storage not available (e.g. running outside extension context)
  }

  cachedUrl = PRODUCTION_BACKEND_URL;
  return cachedUrl;
}

/**
 * Override the backend URL at runtime.
 * This is called when the user configures a custom URL via the Options page.
 */
export function setBackendUrl(url: string): void {
  cachedUrl = url.trim().replace(/\/+$/, '');
}

/**
 * Save the backend URL to chrome.storage for persistence across sessions.
 */
export async function saveBackendUrl(url: string): Promise<void> {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  cachedUrl = cleanUrl;
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ [STORAGE_KEY]: cleanUrl }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    }
  } catch {
    // chrome.storage not available
  }
}

/**
 * Reset the backend URL to the production default.
 */
export async function resetBackendUrl(): Promise<void> {
  cachedUrl = null;
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await new Promise<void>((resolve, reject) => {
        chrome.storage.local.remove(STORAGE_KEY, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    }
  } catch {
    // chrome.storage not available
  }
}



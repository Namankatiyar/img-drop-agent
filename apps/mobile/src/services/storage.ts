import type { PairingCredentials } from '@imgdrop/shared';

/**
 * Storage driver interface for pluggable storage implementations (e.g. AsyncStorage, mocks)
 */
export interface StorageDriver {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

interface SecureStoreLike {
  isAvailableAsync(): Promise<boolean>;
  setItemAsync(key: string, value: string): Promise<void>;
  getItemAsync(key: string): Promise<string | null>;
  deleteItemAsync(key: string): Promise<void>;
}

export const STORAGE_KEY_CREDENTIALS = 'imgdrop_pairing_credentials';

// Fallback in-memory store for test and web/mock environments
const inMemoryStore = new Map<string, string>();
let customDriver: StorageDriver | null = null;

let secureStoreChecked = false;
let activeSecureStore: SecureStoreLike | null = null;

/**
 * Resolve expo-secure-store if available and supported in current runtime
 */
async function resolveSecureStore(): Promise<SecureStoreLike | null> {
  if (secureStoreChecked) {
    return activeSecureStore;
  }
  try {
    // Dynamic import to prevent crash when native module is missing (e.g. Bun unit tests, Web)
    // @ts-ignore dynamic import for optional native dependency
    const mod = await import('expo-secure-store').catch(() => null);
    if (mod && typeof mod.isAvailableAsync === 'function') {
      const isAvailable = await mod.isAvailableAsync().catch(() => false);
      if (isAvailable) {
        activeSecureStore = mod as SecureStoreLike;
      }
    }
  } catch {
    activeSecureStore = null;
  } finally {
    secureStoreChecked = true;
  }
  return activeSecureStore;
}

/**
 * Configure an explicit storage driver (useful for tests or custom persistence)
 */
export function setStorageDriver(driver: StorageDriver | null): void {
  customDriver = driver;
}

/**
 * Reset all storage drivers and in-memory caches (for test isolation)
 */
export function resetStorageForTesting(): void {
  inMemoryStore.clear();
  customDriver = null;
  secureStoreChecked = false;
  activeSecureStore = null;
}

/**
 * Securely save PairingCredentials
 */
export async function saveCredentials(credentials: PairingCredentials): Promise<void> {
  if (
    !credentials ||
    typeof credentials.serverId !== 'string' ||
    !credentials.serverId.trim() ||
    typeof credentials.token !== 'string' ||
    !credentials.token.trim()
  ) {
    throw new Error('Invalid PairingCredentials: serverId and token are required.');
  }

  const payload: PairingCredentials = {
    serverId: credentials.serverId.trim(),
    token: credentials.token.trim(),
    port: Number(credentials.port) || 8000,
    host: credentials.host ? credentials.host.trim() : undefined,
  };

  const serialized = JSON.stringify(payload);

  if (customDriver) {
    await customDriver.setItem(STORAGE_KEY_CREDENTIALS, serialized);
    return;
  }

  const secureStore = await resolveSecureStore();
  if (secureStore) {
    try {
      await secureStore.setItemAsync(STORAGE_KEY_CREDENTIALS, serialized);
      return;
    } catch {
      // Fallback to inMemoryStore if native write fails
    }
  }

  inMemoryStore.set(STORAGE_KEY_CREDENTIALS, serialized);
}

/**
 * Retrieve securely stored PairingCredentials, or null if none found or invalid
 */
export async function getCredentials(): Promise<PairingCredentials | null> {
  let raw: string | null = null;

  if (customDriver) {
    raw = await customDriver.getItem(STORAGE_KEY_CREDENTIALS);
  } else {
    const secureStore = await resolveSecureStore();
    if (secureStore) {
      try {
        raw = await secureStore.getItemAsync(STORAGE_KEY_CREDENTIALS);
      } catch {
        raw = null;
      }
    }
    if (!raw) {
      raw = inMemoryStore.get(STORAGE_KEY_CREDENTIALS) ?? null;
    }
  }

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed.serverId !== 'string' ||
      !parsed.serverId.trim() ||
      typeof parsed.token !== 'string' ||
      !parsed.token.trim()
    ) {
      return null;
    }

    return {
      serverId: parsed.serverId.trim(),
      token: parsed.token.trim(),
      port: Number(parsed.port) || 8000,
      host: parsed.host ? String(parsed.host).trim() : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Clear stored PairingCredentials
 */
export async function clearCredentials(): Promise<void> {
  if (customDriver) {
    await customDriver.deleteItem(STORAGE_KEY_CREDENTIALS);
  }

  const secureStore = await resolveSecureStore();
  if (secureStore) {
    try {
      await secureStore.deleteItemAsync(STORAGE_KEY_CREDENTIALS);
    } catch {
      // Ignore native deletion error
    }
  }

  inMemoryStore.delete(STORAGE_KEY_CREDENTIALS);
}

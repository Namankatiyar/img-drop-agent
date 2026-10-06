import { create } from 'zustand';
import {
  MAX_FILES,
  MAX_NOTE_LENGTH,
  DEFAULT_PORT,
  type PairingCredentials,
  type CreateGroupResponse,
} from '@imgdrop/shared';
import {
  saveCredentials,
  getCredentials,
  clearCredentials,
} from '../services/storage';
import { processImage } from '../services/imageProcessor';
import { discoverServer } from '../services/discovery';
import {
  uploadGroup,
  generateIdempotencyKey,
  checkHealth,
  ApiUploadError,
} from '../services/api';

export type ConnectionStatus = 'connected' | 'discovering' | 'disconnected';

export interface SelectedImage {
  id: string;
  uri: string;
  name: string;
  size: number;
  width?: number;
  height?: number;
  position: number; // 1-based (1..20)
}

export interface AppState {
  // Pairing & Connection
  serverId: string | null;
  token: string | null;
  host: string | null;
  port: number;
  isPaired: boolean;
  connectionStatus: ConnectionStatus;

  // Selected Images & Note
  selectedImages: SelectedImage[];
  note: string;

  // Upload State
  isUploading: boolean;
  uploadProgress: number; // 0.0 to 1.0
  lastError: string | null;
  lastCreatedGroup: CreateGroupResponse | null;
  currentIdempotencyKey: string | null;

  // Actions
  initialize: () => Promise<void>;
  setPairing: (creds: PairingCredentials) => Promise<void>;
  unpair: () => Promise<void>;
  startDiscovery: () => Promise<boolean>;
  pingServer: () => Promise<boolean>;
  pickImages: () => Promise<void>;
  captureImage: () => Promise<void>;
  addImage: (image: Omit<SelectedImage, 'position' | 'id'>) => void;
  removeImage: (idOrIndex: string | number) => void;
  clearSelectedImages: () => void;
  setNote: (note: string) => void;
  submitGroup: () => Promise<CreateGroupResponse | null>;
  retrySubmit: () => Promise<CreateGroupResponse | null>;
  clearLastError: () => void;
  clearLastCreatedGroup: () => void;
}

/**
 * Resolves expo-image-picker dynamically to avoid breaking headless test environments
 */
async function resolveImagePicker(): Promise<typeof import('expo-image-picker') | null> {
  try {
    const mod = await import('expo-image-picker');
    return mod;
  } catch {
    return null;
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial Pairing state
  serverId: null,
  token: null,
  host: null,
  port: DEFAULT_PORT,
  isPaired: false,
  connectionStatus: 'disconnected',

  // Initial Form state
  selectedImages: [],
  note: '',

  // Initial Upload state
  isUploading: false,
  uploadProgress: 0,
  lastError: null,
  lastCreatedGroup: null,
  currentIdempotencyKey: null,

  /**
   * Load stored pairing credentials on app boot and verify discovery/connectivity
   */
  initialize: async () => {
    try {
      const stored = await getCredentials();
      if (stored && stored.serverId && stored.token) {
        set({
          serverId: stored.serverId,
          token: stored.token,
          host: stored.host || null,
          port: stored.port || DEFAULT_PORT,
          isPaired: true,
          connectionStatus: 'discovering',
        });

        // Trigger discovery in background
        get().startDiscovery();
      }
    } catch {
      // Storage read failed; remain unverified
    }
  },

  /**
   * Set and persist server pairing credentials
   */
  setPairing: async (creds: PairingCredentials) => {
    const port = creds.port || DEFAULT_PORT;
    const host = creds.host || null;

    await saveCredentials({
      serverId: creds.serverId,
      token: creds.token,
      port,
      host: host || undefined,
    });

    set({
      serverId: creds.serverId,
      token: creds.token,
      host,
      port,
      isPaired: true,
      connectionStatus: host ? 'connected' : 'disconnected',
      lastError: null,
    });
  },

  /**
   * Clear pairing credentials and reset connectivity state
   */
  unpair: async () => {
    await clearCredentials();
    set({
      serverId: null,
      token: null,
      host: null,
      port: DEFAULT_PORT,
      isPaired: false,
      connectionStatus: 'disconnected',
      lastError: null,
    });
  },

  /**
   * Run 3-tier discovery to detect or verify desktop server IP
   */
  startDiscovery: async () => {
    const { serverId, host, port } = get();
    if (!serverId) {
      set({ connectionStatus: 'disconnected' });
      return false;
    }

    set({ connectionStatus: 'discovering' });

    try {
      const discovered = await discoverServer(
        serverId,
        host || undefined,
        port || DEFAULT_PORT
      );

      if (discovered) {
        const updatedHost = discovered.host;
        const updatedPort = discovered.port;

        // Persist discovered host IP
        const token = get().token;
        if (token) {
          await saveCredentials({
            serverId,
            token,
            port: updatedPort,
            host: updatedHost,
          });
        }

        set({
          host: updatedHost,
          port: updatedPort,
          connectionStatus: 'connected',
          lastError: null,
        });
        return true;
      } else {
        set({ connectionStatus: 'disconnected' });
        return false;
      }
    } catch {
      set({ connectionStatus: 'disconnected' });
      return false;
    }
  },

  /**
   * Ping server health endpoint directly
   */
  pingServer: async () => {
    const { host, port, serverId } = get();
    if (!host) {
      return false;
    }

    try {
      const health = await checkHealth(host, port, 2000);
      if (health.status === 'ok' && (!serverId || health.server_id === serverId)) {
        set({ connectionStatus: 'connected', lastError: null });
        return true;
      }
      set({ connectionStatus: 'disconnected' });
      return false;
    } catch {
      set({ connectionStatus: 'disconnected' });
      return false;
    }
  },

  /**
   * Launch system photo picker (allows multiple selection up to remaining MAX_FILES)
   */
  pickImages: async () => {
    const currentImages = get().selectedImages;
    const remainingSlots = MAX_FILES - currentImages.length;
    if (remainingSlots <= 0) {
      set({ lastError: `Cannot select more than ${MAX_FILES} images.` });
      return;
    }

    try {
      const ImagePicker = await resolveImagePicker();
      if (!ImagePicker) {
        set({ lastError: 'Image picker is unavailable in this environment.' });
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        set({ lastError: 'Permission to access gallery was denied.' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const newItems: SelectedImage[] = [];
      let basePosition = currentImages.length + 1;

      for (const asset of result.assets) {
        if (newItems.length >= remainingSlots) break;

        // Process image: resize long edge <= 1568px, strip metadata, WebP/JPEG
        const processed = await processImage(asset.uri, {
          width: asset.width,
          height: asset.height,
        });

        newItems.push({
          id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          uri: processed.uri,
          name: processed.fileName || asset.fileName || `photo_${basePosition}.webp`,
          size: asset.fileSize || 0,
          width: processed.width,
          height: processed.height,
          position: basePosition++,
        });
      }

      set({
        selectedImages: [...currentImages, ...newItems],
        lastError: null,
      });
    } catch (err: any) {
      set({ lastError: err?.message || 'Failed to pick images from gallery.' });
    }
  },

  /**
   * Launch camera capture
   */
  captureImage: async () => {
    const currentImages = get().selectedImages;
    if (currentImages.length >= MAX_FILES) {
      set({ lastError: `Cannot select more than ${MAX_FILES} images.` });
      return;
    }

    try {
      const ImagePicker = await resolveImagePicker();
      if (!ImagePicker) {
        set({ lastError: 'Camera is unavailable in this environment.' });
        return;
      }

      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        set({ lastError: 'Permission to access camera was denied.' });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const processed = await processImage(asset.uri, {
        width: asset.width,
        height: asset.height,
      });

      const nextPosition = currentImages.length + 1;
      const newItem: SelectedImage = {
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        uri: processed.uri,
        name: processed.fileName || `photo_${nextPosition}.webp`,
        size: asset.fileSize || 0,
        width: processed.width,
        height: processed.height,
        position: nextPosition,
      };

      set({
        selectedImages: [...currentImages, newItem],
        lastError: null,
      });
    } catch (err: any) {
      set({ lastError: err?.message || 'Failed to capture photo.' });
    }
  },

  /**
   * Programmatic helper to add an already processed image
   */
  addImage: (image) => {
    const current = get().selectedImages;
    if (current.length >= MAX_FILES) return;

    const nextPosition = current.length + 1;
    const newItem: SelectedImage = {
      ...image,
      id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      position: nextPosition,
    };
    set({ selectedImages: [...current, newItem] });
  },

  /**
   * Remove image and re-index position badges 1..N
   */
  removeImage: (idOrIndex) => {
    const current = get().selectedImages;
    const filtered =
      typeof idOrIndex === 'number'
        ? current.filter((_, idx) => idx !== idOrIndex)
        : current.filter((img) => img.id !== idOrIndex);

    const reindexed = filtered.map((img, idx) => ({
      ...img,
      position: idx + 1,
    }));

    set({ selectedImages: reindexed });
  },

  /**
   * Clear all selected images
   */
  clearSelectedImages: () => {
    set({ selectedImages: [] });
  },

  /**
   * Set user note, clamped to MAX_NOTE_LENGTH
   */
  setNote: (note: string) => {
    const clamped = note.slice(0, MAX_NOTE_LENGTH);
    set({ note: clamped });
  },

  /**
   * Submit selected images and note as a new group to desktop server
   */
  submitGroup: async () => {
    const { isPaired, host, port, token, selectedImages, note } = get();

    if (!isPaired || !token) {
      set({ lastError: 'Device is not paired with a desktop server.' });
      return null;
    }

    if (!host) {
      set({ lastError: 'Desktop server host address is unknown. Run discovery.' });
      return null;
    }

    if (selectedImages.length === 0) {
      set({ lastError: 'Please select at least 1 image to upload.' });
      return null;
    }

    // Generate fresh idempotency key for this submission attempt
    const idempotencyKey = generateIdempotencyKey();

    set({
      isUploading: true,
      uploadProgress: 0,
      lastError: null,
      currentIdempotencyKey: idempotencyKey,
    });

    try {
      const result = await uploadGroup({
        host,
        port,
        token,
        images: selectedImages.map((img) => ({
          uri: img.uri,
          name: img.name,
        })),
        note: note.trim() || undefined,
        idempotencyKey,
        onProgress: (progress) => {
          set({ uploadProgress: progress });
        },
      });

      // Upload successful! Reset form and retain created group metadata
      set({
        isUploading: false,
        uploadProgress: 1.0,
        selectedImages: [],
        note: '',
        lastCreatedGroup: result.data,
        currentIdempotencyKey: null,
        lastError: null,
        connectionStatus: 'connected',
      });

      return result.data;
    } catch (err: any) {
      const message =
        err instanceof ApiUploadError
          ? `Upload failed: ${err.message}`
          : err?.message || 'Upload failed due to network error.';

      set({
        isUploading: false,
        lastError: message,
        // Retain currentIdempotencyKey for retrySubmit!
      });
      return null;
    }
  },

  /**
   * Retry upload retaining the exact same Idempotency-Key
   */
  retrySubmit: async () => {
    const {
      isPaired,
      host,
      port,
      token,
      selectedImages,
      note,
      currentIdempotencyKey,
    } = get();

    if (!isPaired || !token || !host) {
      set({ lastError: 'Cannot retry: Server is not paired or host is missing.' });
      return null;
    }

    if (selectedImages.length === 0) {
      set({ lastError: 'No images available to retry upload.' });
      return null;
    }

    // Reuse existing key if available, else generate
    const keyToUse = currentIdempotencyKey || generateIdempotencyKey();

    set({
      isUploading: true,
      uploadProgress: 0,
      lastError: null,
      currentIdempotencyKey: keyToUse,
    });

    try {
      const result = await uploadGroup({
        host,
        port,
        token,
        images: selectedImages.map((img) => ({
          uri: img.uri,
          name: img.name,
        })),
        note: note.trim() || undefined,
        idempotencyKey: keyToUse,
        onProgress: (progress) => {
          set({ uploadProgress: progress });
        },
      });

      set({
        isUploading: false,
        uploadProgress: 1.0,
        selectedImages: [],
        note: '',
        lastCreatedGroup: result.data,
        currentIdempotencyKey: null,
        lastError: null,
        connectionStatus: 'connected',
      });

      return result.data;
    } catch (err: any) {
      const message =
        err instanceof ApiUploadError
          ? `Retry failed: ${err.message}`
          : err?.message || 'Retry failed due to network error.';

      set({
        isUploading: false,
        lastError: message,
      });
      return null;
    }
  },

  clearLastError: () => set({ lastError: null }),
  clearLastCreatedGroup: () => set({ lastCreatedGroup: null }),
}));

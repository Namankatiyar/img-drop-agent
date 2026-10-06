import { describe, expect, it, beforeEach } from 'bun:test';
import { MAX_FILES, MAX_NOTE_LENGTH } from '@imgdrop/shared';
import { useAppStore } from '../src/store/useAppStore';
import { resetStorageForTesting } from '../src/services/storage';
import { setApiTransportDriver } from '../src/services/api';

describe('useAppStore Zustand Store Test Suite', () => {
  beforeEach(() => {
    resetStorageForTesting();
    setApiTransportDriver(null);

    // Reset store state
    useAppStore.setState({
      serverId: null,
      token: null,
      host: null,
      port: 8000,
      isPaired: false,
      connectionStatus: 'disconnected',
      selectedImages: [],
      note: '',
      isUploading: false,
      uploadProgress: 0,
      lastError: null,
      lastCreatedGroup: null,
      currentIdempotencyKey: null,
    });
  });

  describe('Initial State', () => {
    it('initializes with default disconnected and empty state', () => {
      const state = useAppStore.getState();
      expect(state.isPaired).toBe(false);
      expect(state.connectionStatus).toBe('disconnected');
      expect(state.selectedImages).toEqual([]);
      expect(state.note).toBe('');
      expect(state.isUploading).toBe(false);
      expect(state.uploadProgress).toBe(0);
      expect(state.lastError).toBeNull();
      expect(state.lastCreatedGroup).toBeNull();
    });
  });

  describe('Selected Images Management', () => {
    it('adds images and assigns 1-based position badges sequentially', () => {
      const { addImage } = useAppStore.getState();

      addImage({
        uri: 'file:///photo1.webp',
        name: 'photo1.webp',
        size: 1024,
      });

      addImage({
        uri: 'file:///photo2.webp',
        name: 'photo2.webp',
        size: 2048,
      });

      const images = useAppStore.getState().selectedImages;
      expect(images.length).toBe(2);
      expect(images[0].position).toBe(1);
      expect(images[0].name).toBe('photo1.webp');
      expect(images[1].position).toBe(2);
      expect(images[1].name).toBe('photo2.webp');
    });

    it('removes image and re-indexes remaining positions 1..N', () => {
      const { addImage, removeImage } = useAppStore.getState();

      addImage({ uri: 'file:///1.webp', name: '1.webp', size: 100 });
      addImage({ uri: 'file:///2.webp', name: '2.webp', size: 200 });
      addImage({ uri: 'file:///3.webp', name: '3.webp', size: 300 });

      let images = useAppStore.getState().selectedImages;
      expect(images.length).toBe(3);

      // Remove the middle image (id of second image)
      const secondId = images[1].id;
      removeImage(secondId);

      images = useAppStore.getState().selectedImages;
      expect(images.length).toBe(2);
      expect(images[0].name).toBe('1.webp');
      expect(images[0].position).toBe(1);
      expect(images[1].name).toBe('3.webp');
      expect(images[1].position).toBe(2); // re-indexed from 3 to 2
    });

    it('enforces MAX_FILES limit (20)', () => {
      const { addImage } = useAppStore.getState();

      for (let i = 1; i <= 25; i++) {
        addImage({ uri: `file:///${i}.webp`, name: `${i}.webp`, size: 100 });
      }

      const images = useAppStore.getState().selectedImages;
      expect(images.length).toBe(MAX_FILES);
      expect(images[MAX_FILES - 1].position).toBe(MAX_FILES);
    });

    it('clears all selected images', () => {
      const { addImage, clearSelectedImages } = useAppStore.getState();

      addImage({ uri: 'file:///1.webp', name: '1.webp', size: 100 });
      addImage({ uri: 'file:///2.webp', name: '2.webp', size: 200 });
      expect(useAppStore.getState().selectedImages.length).toBe(2);

      clearSelectedImages();
      expect(useAppStore.getState().selectedImages.length).toBe(0);
    });
  });

  describe('Note Handling', () => {
    it('sets note within length limit', () => {
      const { setNote } = useAppStore.getState();
      setNote('Test drop note context');
      expect(useAppStore.getState().note).toBe('Test drop note context');
    });

    it('clamps note text strictly to MAX_NOTE_LENGTH (2000 chars)', () => {
      const { setNote } = useAppStore.getState();
      const longNote = 'a'.repeat(2500);
      setNote(longNote);
      expect(useAppStore.getState().note.length).toBe(MAX_NOTE_LENGTH);
    });
  });

  describe('Pairing & Discovery Lifecycle', () => {
    it('sets pairing credentials and updates pairing state', async () => {
      const { setPairing } = useAppStore.getState();

      await setPairing({
        serverId: 'desk_srv_test1',
        token: 'secret_token_123',
        port: 8000,
        host: '192.168.43.50',
      });

      const state = useAppStore.getState();
      expect(state.isPaired).toBe(true);
      expect(state.serverId).toBe('desk_srv_test1');
      expect(state.token).toBe('secret_token_123');
      expect(state.host).toBe('192.168.43.50');
      expect(state.port).toBe(8000);
    });

    it('unpairs server and clears all pairing credentials', async () => {
      const { setPairing, unpair } = useAppStore.getState();

      await setPairing({
        serverId: 'desk_srv_test1',
        token: 'secret_token_123',
        port: 8000,
        host: '192.168.43.50',
      });

      expect(useAppStore.getState().isPaired).toBe(true);

      await unpair();

      const state = useAppStore.getState();
      expect(state.isPaired).toBe(false);
      expect(state.serverId).toBeNull();
      expect(state.token).toBeNull();
      expect(state.host).toBeNull();
      expect(state.connectionStatus).toBe('disconnected');
    });
  });

  describe('Upload Submissions & Idempotency Key Handling', () => {
    it('blocks submitGroup when not paired or no images selected', async () => {
      const { submitGroup } = useAppStore.getState();

      // Not paired
      const result1 = await submitGroup();
      expect(result1).toBeNull();
      expect(useAppStore.getState().lastError).toContain('not paired');

      // Paired but no images
      useAppStore.setState({
        isPaired: true,
        serverId: 'srv_1',
        token: 'token_1',
        host: '192.168.43.10',
        lastError: null,
      });

      const result2 = await submitGroup();
      expect(result2).toBeNull();
      expect(useAppStore.getState().lastError).toContain('at least 1 image');
    });

    it('submits successfully with mock transport and clears selected images', async () => {
      const { addImage, submitGroup, setNote } = useAppStore.getState();

      useAppStore.setState({
        isPaired: true,
        serverId: 'srv_1',
        token: 'token_1',
        host: '192.168.43.10',
      });

      addImage({ uri: 'file:///photo.webp', name: 'photo.webp', size: 100 });
      setNote('Important drop');

      const mockGroup = {
        id: '01HQTESTULID1234567890ABCDEF',
        created_at: new Date().toISOString(),
        status: 'ready' as const,
        claimed_at: null,
        note: 'Important drop',
        image_count: 1,
        images: [
          {
            id: '01HQIMG123',
            group_id: '01HQTESTULID1234567890ABCDEF',
            position: 1,
            file_name: 'photo.webp',
            mime: 'image/webp',
            size_bytes: 100,
          },
        ],
      };

      setApiTransportDriver({
        upload: async (_url, _formData, headers) => {
          expect(headers['Idempotency-Key']).toBeDefined();
          return {
            status: 201,
            text: JSON.stringify(mockGroup),
          };
        },
      });

      const response = await submitGroup();
      expect(response).not.toBeNull();
      expect(response?.id).toBe(mockGroup.id);

      const state = useAppStore.getState();
      expect(state.selectedImages).toEqual([]);
      expect(state.note).toBe('');
      expect(state.lastCreatedGroup?.id).toBe(mockGroup.id);
      expect(state.isUploading).toBe(false);
      expect(state.uploadProgress).toBe(1.0);
      expect(state.currentIdempotencyKey).toBeNull();
    });

    it('retains currentIdempotencyKey on failure for retrySubmit', async () => {
      const { addImage, submitGroup, retrySubmit } = useAppStore.getState();

      useAppStore.setState({
        isPaired: true,
        serverId: 'srv_1',
        token: 'token_1',
        host: '192.168.43.10',
      });

      addImage({ uri: 'file:///photo.webp', name: 'photo.webp', size: 100 });

      let capturedKey1 = '';
      let capturedKey2 = '';
      let attempts = 0;

      setApiTransportDriver({
        upload: async (_url, _formData, headers) => {
          attempts++;
          if (attempts === 1) {
            capturedKey1 = headers['Idempotency-Key'];
            return {
              status: 500,
              text: JSON.stringify({ error: 'Internal Server Error' }),
            };
          } else {
            capturedKey2 = headers['Idempotency-Key'];
            return {
              status: 201,
              text: JSON.stringify({
                id: '01HQRETRYSUCCESS',
                created_at: new Date().toISOString(),
                status: 'ready',
                claimed_at: null,
                note: null,
                image_count: 1,
                images: [],
              }),
            };
          }
        },
      });

      // 1. Initial submit fails
      const failRes = await submitGroup();
      expect(failRes).toBeNull();
      expect(useAppStore.getState().lastError).toContain('Upload failed');
      const savedKey = useAppStore.getState().currentIdempotencyKey;
      expect(savedKey).toBeTruthy();
      expect(savedKey).toBe(capturedKey1);

      // 2. Retry submit reuses the exact same key!
      const retryRes = await retrySubmit();
      expect(retryRes).not.toBeNull();
      expect(retryRes?.id).toBe('01HQRETRYSUCCESS');
      expect(capturedKey2).toBe(capturedKey1);
      expect(useAppStore.getState().currentIdempotencyKey).toBeNull();
    });
  });
});

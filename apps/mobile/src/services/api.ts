import {
  MAX_FILES,
  MAX_NOTE_LENGTH,
  type CreateGroupResponse,
  type HealthResponse,
} from '@imgdrop/shared';

/**
 * Custom error thrown when group upload fails, preserving the Idempotency-Key
 * so the caller can retry with the identical key as required by spec Section 10.
 */
export class ApiUploadError extends Error {
  public readonly idempotencyKey: string;
  public readonly statusCode?: number;
  public readonly responseBody?: unknown;

  constructor(
    message: string,
    idempotencyKey: string,
    statusCode?: number,
    responseBody?: unknown
  ) {
    super(message);
    this.name = 'ApiUploadError';
    this.idempotencyKey = idempotencyKey;
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

/**
 * Generate a cryptographically secure or pseudo-random RFC4122 v4 UUID
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Standard RFC4122 v4 UUID fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validates note length against MAX_NOTE_LENGTH (2000 chars)
 */
export function validateNote(note?: string): void {
  if (note !== undefined && note !== null) {
    if (note.length > MAX_NOTE_LENGTH) {
      throw new Error(
        `Note exceeds maximum permitted length of ${MAX_NOTE_LENGTH} characters (received ${note.length}).`
      );
    }
  }
}

export interface UploadFileItem {
  uri: string;
  name?: string;
  mime?: string;
}

export interface UploadGroupOptions {
  host: string;
  port: number;
  token: string;
  images: UploadFileItem[];
  note?: string;
  idempotencyKey?: string;
  onProgress?: (progress: number) => void; // 0.0 to 1.0
  timeoutMs?: number;
}

export interface UploadGroupResult {
  idempotencyKey: string;
  data: CreateGroupResponse;
}

/**
 * Optional custom transport driver for testing or alternate HTTP engines
 */
export interface ApiTransportDriver {
  upload(
    url: string,
    formData: FormData,
    headers: Record<string, string>,
    options: { onProgress?: (p: number) => void; timeoutMs?: number }
  ): Promise<{ status: number; text: string }>;
}

let customTransportDriver: ApiTransportDriver | null = null;

export function setApiTransportDriver(driver: ApiTransportDriver | null): void {
  customTransportDriver = driver;
}

/**
 * Performs a health check against GET http://${host}:${port}/health
 */
export async function checkHealth(
  host: string,
  port: number,
  timeoutMs: number = 1000
): Promise<HealthResponse> {
  const url = `http://${host}:${port}/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Health check returned non-200 status: ${res.status}`);
    }
    const data = await res.json();
    return data as HealthResponse;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Uploads a group of images via multipart POST /groups
 * - Appends images array (1 to 20 files)
 * - Appends optional note (validated <= 2000 characters)
 * - Generates or retains UUIDv4 Idempotency-Key
 * - On failure, attaches the Idempotency-Key to ApiUploadError for retries
 * - Tracks upload progress
 */
export async function uploadGroup(
  options: UploadGroupOptions
): Promise<UploadGroupResult> {
  const { host, port, token, images, note, onProgress, timeoutMs = 60000 } = options;

  // 1. Validate images count
  if (!images || images.length === 0) {
    throw new Error('Upload requires at least 1 image.');
  }
  if (images.length > MAX_FILES) {
    throw new Error(`Exceeded maximum allowed files per group (${MAX_FILES}). Received ${images.length}.`);
  }

  // 2. Validate note length
  validateNote(note);

  // 3. Resolve or generate Idempotency-Key
  const idempotencyKey = options.idempotencyKey || generateIdempotencyKey();

  const url = `http://${host}:${port}/groups`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Idempotency-Key': idempotencyKey,
  };

  // 4. Construct multipart FormData
  const formData = new FormData();
  images.forEach((img, idx) => {
    const fileName = img.name || `photo_${idx + 1}.webp`;
    const mime = img.mime || 'image/webp';

    // React Native multipart file representation
    formData.append('images', {
      uri: img.uri,
      name: fileName,
      type: mime,
    } as any);
  });

  if (note && note.trim().length > 0) {
    formData.append('note', note.trim());
  }

  // 5. If Custom Driver is registered (for testing/mocking)
  if (customTransportDriver) {
    try {
      const res = await customTransportDriver.upload(url, formData, headers, {
        onProgress,
        timeoutMs,
      });
      if (res.status >= 200 && res.status < 300) {
        const data = JSON.parse(res.text) as CreateGroupResponse;
        return { idempotencyKey, data };
      }
      let errBody: unknown;
      try {
        errBody = JSON.parse(res.text);
      } catch {
        errBody = res.text;
      }
      throw new ApiUploadError(
        `Upload failed with HTTP status ${res.status}`,
        idempotencyKey,
        res.status,
        errBody
      );
    } catch (err) {
      if (err instanceof ApiUploadError) throw err;
      throw new ApiUploadError(
        err instanceof Error ? err.message : String(err),
        idempotencyKey
      );
    }
  }

  // 6. Native / Browser XMLHttpRequest for real upload progress
  if (typeof XMLHttpRequest !== 'undefined') {
    return new Promise<UploadGroupResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        xhr.abort();
        reject(
          new ApiUploadError(
            `Upload timed out after ${timeoutMs}ms`,
            idempotencyKey
          )
        );
      }, timeoutMs);

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            onProgress(event.loaded / event.total);
          }
        };
      }

      xhr.onload = () => {
        clearTimeout(timer);
        if (timedOut) return;

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText) as CreateGroupResponse;
            if (onProgress) onProgress(1.0);
            resolve({ idempotencyKey, data });
          } catch (e) {
            reject(
              new ApiUploadError(
                'Failed to parse server response as JSON',
                idempotencyKey,
                xhr.status,
                xhr.responseText
              )
            );
          }
        } else {
          let errBody: unknown;
          try {
            errBody = JSON.parse(xhr.responseText);
          } catch {
            errBody = xhr.responseText;
          }
          reject(
            new ApiUploadError(
              `Upload failed with status ${xhr.status}`,
              idempotencyKey,
              xhr.status,
              errBody
            )
          );
        }
      };

      xhr.onerror = () => {
        clearTimeout(timer);
        if (timedOut) return;
        reject(
          new ApiUploadError(
            'Network error during image upload',
            idempotencyKey
          )
        );
      };

      xhr.onabort = () => {
        clearTimeout(timer);
        if (timedOut) return;
        reject(
          new ApiUploadError('Upload was aborted', idempotencyKey)
        );
      };

      xhr.open('POST', url);
      for (const [key, val] of Object.entries(headers)) {
        xhr.setRequestHeader(key, val);
      }
      xhr.send(formData);
    });
  }

  // 7. Fallback to standard fetch
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (onProgress) onProgress(0.1);
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });
    if (onProgress) onProgress(1.0);

    if (!res.ok) {
      let errBody: unknown;
      try {
        errBody = await res.json();
      } catch {
        errBody = await res.text();
      }
      throw new ApiUploadError(
        `Upload failed with HTTP status ${res.status}`,
        idempotencyKey,
        res.status,
        errBody
      );
    }

    const data = (await res.json()) as CreateGroupResponse;
    return { idempotencyKey, data };
  } catch (err) {
    if (err instanceof ApiUploadError) throw err;
    throw new ApiUploadError(
      err instanceof Error ? err.message : String(err),
      idempotencyKey
    );
  } finally {
    clearTimeout(timer);
  }
}

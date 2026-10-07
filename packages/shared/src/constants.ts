/**
 * ImgDrop Shared Constants
 * As defined in ImgDrop Local Image Handoff Spec
 */

/** Default HTTP server port */
export const DEFAULT_PORT = 8000;

/** UDP discovery broadcast port */
export const BEACON_PORT = 41716;

/** UDP discovery broadcast interval in milliseconds */
export const BEACON_INTERVAL_MS = 3000;

/** Maximum number of files per upload group */
export const MAX_FILES = 20;

/** Maximum allowed size in megabytes for an individual file */
export const MAX_FILE_MB = 8;

/** Maximum allowed size in megabytes for a whole request */
export const MAX_REQUEST_MB = 50;

/** Maximum length for the user note attached to a group */
export const MAX_NOTE_LENGTH = 2000;

/** Target maximum size for the long edge of compressed images in pixels */
export const TARGET_LONG_EDGE_PX = 1568;

/** WebP compression quality factor (0.0 - 1.0). Set to 1.0 for maximum quality without loss */
export const WEBP_QUALITY = 1.0;

/** Service identifier used in discovery beacon packets */
export const BEACON_SERVICE = 'imgdrop';

/** Protocol version used in discovery beacon packets */
export const BEACON_VERSION = 1;

/** URI scheme for client pairing */
export const PAIRING_SCHEME = 'imgdrop';

/** Supported image MIME types */
export const ALLOWED_IMAGE_MIMES = [
  'image/webp',
  'image/jpeg',
  'image/png',
] as const;

/** Supported image file extensions */
export const ALLOWED_IMAGE_EXTENSIONS = [
  'webp',
  'jpeg',
  'jpg',
  'png',
] as const;

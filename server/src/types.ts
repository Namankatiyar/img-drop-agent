export type GroupStatus = 'ready' | 'claimed';

export interface GroupRecord {
  id: string;
  created_at: string;
  status: GroupStatus;
  claimed_at: string | null;
  note: string | null;
  client_key: string | null;
  image_count: number;
}

export interface ImageRecord {
  id: string;
  group_id: string;
  position: number;
  file_name: string;
  mime: string;
  size_bytes: number;
}

export interface GroupWithImages extends GroupRecord {
  images: ImageRecord[];
}

export interface Config {
  port: number;
  dataDir: string;
  storageDir: string;
  tmpDir: string;
  configFile: string;
  dbFile: string;
  beaconPort: number;
  beaconIntervalMs: number;
  maxFiles: number;
  maxFileMb: number;
  maxRequestMb: number;
}

export interface AuthCredentials {
  server_id: string;
  token: string;
}

export interface BeaconPayload {
  service: 'imgdrop';
  v: number;
  id: string;
  port: number;
  ts: number;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type {
  Group,
  Image,
  GroupStatus,
  GroupRecord,
  ImageRecord,
  GroupWithImages,
  CreateGroupResponse,
  GroupDetailResponse,
  GroupsListResponse,
  HealthResponse,
  BeaconPayload,
  PairingCredentials,
  ApiError,
  ApiErrorResponse,
} from '@imgdrop/shared';

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

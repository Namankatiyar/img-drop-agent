/**
 * ImgDrop Shared Types & Interfaces
 */

/** Status of an image group */
export type GroupStatus = 'ready' | 'claimed';

/** Group entity representation */
export interface Group {
  id: string;
  created_at: string;
  status: GroupStatus;
  claimed_at: string | null;
  note: string | null;
  client_key?: string | null;
  image_count: number;
}

/** Image entity representation */
export interface Image {
  id: string;
  group_id: string;
  position: number;
  file_name: string;
  mime: string;
  size_bytes: number;
}

/** Complete group model including its list of images */
export interface GroupWithImages extends Group {
  images: Image[];
}

/** Aliases for server database records */
export type GroupRecord = Group;
export type ImageRecord = Image;

/** Response payload for group creation (POST /groups) */
export type CreateGroupResponse = GroupWithImages;

/** Response payload for group details (GET /groups/:id or GET /groups/latest) */
export type GroupDetailResponse = GroupWithImages;

/** Response payload for list of groups (GET /groups) */
export interface GroupsListResponse {
  groups: GroupRecord[];
}

/** Response payload for health check (GET /health) */
export interface HealthResponse {
  status: string;
  server_id: string;
  version: string;
}

/** UDP discovery broadcast payload */
export interface BeaconPayload {
  service: 'imgdrop';
  v: number;
  id: string;
  port: number;
  ts: number;
}

/** Client credentials and connection information for server pairing */
export interface PairingCredentials {
  serverId: string;
  token: string;
  port: number;
  host?: string;
}

/** API standard error payload */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiError;
}

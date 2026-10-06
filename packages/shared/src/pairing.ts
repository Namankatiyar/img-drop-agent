import { PAIRING_SCHEME } from './constants.ts';
import type { PairingCredentials } from './types.ts';

/**
 * Generates an `imgdrop://pair` URI for QR codes or deep links.
 * Format: `imgdrop://pair?id=<serverId>&token=<token>&port=<port>[&host=<host>]`
 */
export function generatePairingUri(creds: PairingCredentials): string {
  if (!creds || typeof creds !== 'object') {
    throw new Error('Pairing credentials are required');
  }

  if (!creds.serverId || typeof creds.serverId !== 'string' || creds.serverId.trim().length === 0) {
    throw new Error('serverId is required and cannot be empty');
  }

  if (!creds.token || typeof creds.token !== 'string' || creds.token.trim().length === 0) {
    throw new Error('token is required and cannot be empty');
  }

  const port = Number(creds.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${creds.port}. Must be an integer between 1 and 65535.`);
  }

  const params = new URLSearchParams();
  params.set('id', creds.serverId.trim());
  params.set('token', creds.token.trim());
  params.set('port', String(port));

  if (creds.host && typeof creds.host === 'string' && creds.host.trim().length > 0) {
    params.set('host', creds.host.trim());
  }

  return `${PAIRING_SCHEME}://pair?${params.toString()}`;
}

/**
 * Parses and validates an `imgdrop://pair` URI into PairingCredentials.
 * Returns null if the URI is malformed, has an invalid scheme/action, or is missing required params.
 */
export function parsePairingUri(uri: string): PairingCredentials | null {
  if (!uri || typeof uri !== 'string') {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return null;
  }

  if (parsed.protocol !== `${PAIRING_SCHEME}:`) {
    return null;
  }

  // Handle formats: imgdrop://pair?... or imgdrop://pair/?... or imgdrop:/pair?...
  const isPairAction =
    (parsed.host === 'pair' && (parsed.pathname === '' || parsed.pathname === '/')) ||
    (parsed.host === '' && (parsed.pathname === '/pair' || parsed.pathname === 'pair'));

  if (!isPairAction) {
    return null;
  }

  const id = parsed.searchParams.get('id');
  const token = parsed.searchParams.get('token');
  const portStr = parsed.searchParams.get('port');
  const host = parsed.searchParams.get('host');

  if (!id || id.trim().length === 0) {
    return null;
  }

  if (!token || token.trim().length === 0) {
    return null;
  }

  if (!portStr || portStr.trim().length === 0) {
    return null;
  }

  const port = Number(portStr);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  const creds: PairingCredentials = {
    serverId: id.trim(),
    token: token.trim(),
    port,
  };

  if (host && host.trim().length > 0) {
    creds.host = host.trim();
  }

  return creds;
}

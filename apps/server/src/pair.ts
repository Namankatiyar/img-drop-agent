import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import qrcode from 'qrcode-terminal';
import { generatePairingUri } from '@imgdrop/shared';
import type { PairingCredentials } from '@imgdrop/shared';
import type { AuthCredentials } from './types.ts';

export function loadOrInitCredentials(configFile: string): AuthCredentials {
  const dir = path.dirname(configFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(configFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
      if (data.server_id && data.token) {
        return {
          server_id: String(data.server_id),
          token: String(data.token),
        };
      }
    } catch (err) {
      console.warn(`[Pair] Failed to parse existing ${configFile}, generating fresh credentials.`, err);
    }
  }

  const credentials: AuthCredentials = {
    server_id: crypto.randomBytes(16).toString('hex'),
    token: crypto.randomBytes(32).toString('hex'),
  };

  fs.writeFileSync(configFile, JSON.stringify(credentials, null, 2), {
    mode: 0o600,
  });

  return credentials;
}

export function buildPairingUri(serverId: string, token: string, port: number, host?: string): string {
  return generatePairingUri({ serverId, token, port, host });
}

export function displayPairingInfo(credentials: AuthCredentials, port: number, host?: string): string {
  const creds: PairingCredentials = {
    serverId: credentials.server_id,
    token: credentials.token,
    port,
    host,
  };
  const uri = generatePairingUri(creds);

  console.log('\n' + '='.repeat(50));
  console.log('              ImgDrop Server Ready');
  console.log('='.repeat(50));
  qrcode.generate(uri, { small: true });
  console.log('='.repeat(50));
  console.log(`Server ID:   ${credentials.server_id}`);
  console.log(`Token:       ${credentials.token}`);
  console.log(`Port:        ${port}`);
  console.log(`Pairing URI: ${uri}`);
  console.log('='.repeat(50) + '\n');

  return uri;
}

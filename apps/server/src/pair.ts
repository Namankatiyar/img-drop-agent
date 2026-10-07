import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
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

export function getLanIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: { name: string; address: string; isVirtual: boolean }[] = [];

  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (!netList) continue;

    for (const net of netList) {
      if (net.family === 'IPv4' && !net.internal) {
        const lower = name.toLowerCase();
        const isVirtual =
          lower.includes('virtual') ||
          lower.includes('vbox') ||
          lower.includes('vmnet') ||
          lower.includes('wsl') ||
          net.address.startsWith('192.168.56.');
        ips.push({ name, address: net.address, isVirtual });
      }
    }
  }

  ips.sort((a, b) => (a.isVirtual === b.isVirtual ? 0 : a.isVirtual ? 1 : -1));
  return ips.map((item) => item.address);
}

export function buildPairingUri(serverId: string, token: string, port: number, host?: string): string {
  const detectedHost = host || getLanIpAddresses()[0];
  return generatePairingUri({ serverId, token, port, host: detectedHost });
}

export function displayPairingInfo(credentials: AuthCredentials, port: number, host?: string): string {
  const detectedHost = host || getLanIpAddresses()[0];
  const creds: PairingCredentials = {
    serverId: credentials.server_id,
    token: credentials.token,
    port,
    host: detectedHost,
  };
  const uri = generatePairingUri(creds);

  console.log('\n' + '='.repeat(50));
  console.log('              ImgDrop Server Ready');
  console.log('='.repeat(50));
  qrcode.generate(uri, { small: true });
  console.log('='.repeat(50));
  console.log(`Server ID:   ${credentials.server_id}`);
  console.log(`Token:       ${credentials.token}`);
  if (detectedHost) {
    console.log(`Host IP:     ${detectedHost}`);
  }
  console.log(`Port:        ${port}`);
  console.log(`Pairing URI: ${uri}`);
  console.log('='.repeat(50) + '\n');

  return uri;
}

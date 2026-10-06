import dgram from 'node:dgram';
import os from 'node:os';
import { BEACON_SERVICE, BEACON_VERSION } from '@imgdrop/shared';
import type { BeaconPayload } from '@imgdrop/shared';
import type { Config, AuthCredentials } from './types.ts';

export function getBroadcastAddresses(): string[] {
  const addresses = new Set<string>(['255.255.255.255']);
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (!netList) continue;

    for (const net of netList) {
      if (net.family === 'IPv4' && !net.internal && net.netmask) {
        try {
          const ipParts = net.address.split('.').map(Number);
          const maskParts = net.netmask.split('.').map(Number);
          if (ipParts.length === 4 && maskParts.length === 4) {
            const bcastParts = ipParts.map((part, i) => part | (~maskParts[i] & 255));
            addresses.add(bcastParts.join('.'));
          }
        } catch {
          // Ignore calculation error on unexpected network adapter
        }
      }
    }
  }

  return Array.from(addresses);
}

export interface BeaconService {
  start(): void;
  stop(): Promise<void>;
  sendOnce(): void;
}

export function createBeaconService(config: Config, credentials: AuthCredentials): BeaconService {
  let timer: ReturnType<typeof setInterval> | null = null;
  let socket: dgram.Socket | null = null;
  let isRunning = false;

  const sendOnce = () => {
    if (!socket || !isRunning) return;

    const payload: BeaconPayload = {
      service: BEACON_SERVICE,
      v: BEACON_VERSION,
      id: credentials.server_id,
      port: config.port,
      ts: Math.floor(Date.now() / 1000),
    };

    const message = Buffer.from(JSON.stringify(payload), 'utf-8');
    const broadcastAddresses = getBroadcastAddresses();

    for (const addr of broadcastAddresses) {
      try {
        socket.send(message, 0, message.length, config.beaconPort, addr, (err) => {
          if (err) {
            // Transient network interface send error, non-fatal
          }
        });
      } catch {
        // Socket closed or transient error
      }
    }
  };

  const start = () => {
    if (isRunning) return;
    isRunning = true;

    socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    socket.on('error', (err) => {
      console.warn('[Beacon] UDP socket error:', err.message);
    });

    socket.bind(0, () => {
      try {
        socket?.setBroadcast(true);
      } catch (err: any) {
        console.warn('[Beacon] Failed to enable broadcast flag:', err.message);
      }
      sendOnce();
      timer = setInterval(sendOnce, config.beaconIntervalMs);
    });
  };

  const stop = (): Promise<void> => {
    isRunning = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    return new Promise((resolve) => {
      if (socket) {
        try {
          socket.close(() => {
            socket = null;
            resolve();
          });
        } catch {
          socket = null;
          resolve();
        }
      } else {
        resolve();
      }
    });
  };

  return {
    start,
    stop,
    sendOnce,
  };
}

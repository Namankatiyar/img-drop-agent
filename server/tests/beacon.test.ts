import { describe, it, expect } from 'bun:test';
import dgram from 'node:dgram';
import { getBroadcastAddresses, createBeaconService } from '../src/beacon.ts';
import { getConfig } from '../src/config.ts';

describe('Beacon Module', () => {
  it('getBroadcastAddresses includes 255.255.255.255 and valid IP addresses', () => {
    const addresses = getBroadcastAddresses();
    expect(addresses).toContain('255.255.255.255');
    for (const addr of addresses) {
      const parts = addr.split('.');
      expect(parts.length).toBe(4);
      for (const p of parts) {
        const num = Number(p);
        expect(num).toBeGreaterThanOrEqual(0);
        expect(num).toBeLessThanOrEqual(255);
      }
    }
  });

  it('broadcasts valid payload without token and can be stopped', async () => {
    const testPort = 41799;
    const testConfig = getConfig({
      port: 8080,
      beaconPort: testPort,
      beaconIntervalMs: 150,
    });
    const testCredentials = {
      server_id: 'test_server_id_123',
      token: 'super_secret_token_never_broadcast',
    };

    const receiver = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    let receivedPayload: any = null;
    const receivePromise = new Promise<void>((resolve) => {
      receiver.on('message', (msg) => {
        try {
          const parsed = JSON.parse(msg.toString('utf-8'));
          if (parsed.service === 'imgdrop' && parsed.id === testCredentials.server_id) {
            receivedPayload = parsed;
            resolve();
          }
        } catch {
          // Ignore unrelated packets
        }
      });
    });

    await new Promise<void>((resolve) => {
      receiver.bind(testPort, '0.0.0.0', () => {
        resolve();
      });
    });

    const beacon = createBeaconService(testConfig, testCredentials);
    beacon.start();

    // Wait up to 1.5 seconds for packet
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Beacon receive timeout')), 1500)
    );

    try {
      await Promise.race([receivePromise, timeoutPromise]);
    } finally {
      await beacon.stop();
      await new Promise<void>((res) => receiver.close(() => res()));
    }

    expect(receivedPayload).not.toBeNull();
    expect(receivedPayload.service).toBe('imgdrop');
    expect(receivedPayload.v).toBe(1);
    expect(receivedPayload.id).toBe('test_server_id_123');
    expect(receivedPayload.port).toBe(8080);
    expect(typeof receivedPayload.ts).toBe('number');
    // Crucial security requirement: token must never be broadcast!
    expect(receivedPayload.token).toBeUndefined();
  });
});

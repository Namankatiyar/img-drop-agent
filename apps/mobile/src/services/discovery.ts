import {
  BEACON_PORT,
  BEACON_SERVICE,
  DEFAULT_PORT,
  type BeaconPayload,
  type HealthResponse,
} from '@imgdrop/shared';

export type DiscoveryTier = 'cached' | 'udp' | 'subnet' | 'manual';

export interface DiscoveredServer {
  host: string;
  port: number;
  serverId: string;
  tier: DiscoveryTier;
}

export interface DiscoveryOptions {
  beaconTimeoutMs?: number;
  cachedTimeoutMs?: number;
  subnetTimeoutMs?: number;
  manualHost?: string;
  manualPort?: number;
  customSubnets?: string[];
}

/**
 * Validates whether a received packet is a valid ImgDrop discovery beacon
 */
export function isValidBeaconPayload(
  data: unknown,
  expectedServerId?: string
): data is BeaconPayload {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const obj = data as Record<string, unknown>;
  if (obj.service !== BEACON_SERVICE) {
    return false;
  }
  if (typeof obj.v !== 'number' || obj.v < 1) {
    return false;
  }
  if (typeof obj.id !== 'string' || !obj.id.trim()) {
    return false;
  }
  if (typeof obj.port !== 'number' || obj.port < 1 || obj.port > 65535) {
    return false;
  }
  if (typeof obj.ts !== 'number' || !Number.isFinite(obj.ts)) {
    return false;
  }
  if (expectedServerId && obj.id !== expectedServerId) {
    return false;
  }
  return true;
}

/**
 * Validates whether a response payload matches the ImgDrop GET /health specification
 */
export function isValidHealthResponse(
  data: unknown,
  expectedServerId?: string
): data is HealthResponse {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const obj = data as Record<string, unknown>;
  if (obj.status !== 'ok') {
    return false;
  }
  if (typeof obj.server_id !== 'string' || !obj.server_id.trim()) {
    return false;
  }
  if (expectedServerId && obj.server_id !== expectedServerId) {
    return false;
  }
  return true;
}

/**
 * Derives a /24 subnet base (e.g. "192.168.43.") from an IPv4 address
 */
export function extractSubnetBase(ip: string): string | null {
  const parts = ip.trim().split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.`;
  }
  return null;
}

/**
 * Tier 1: Probe a cached IP host with GET /health (1-second timeout)
 */
export async function probeCachedHost(
  host: string,
  port: number,
  expectedServerId: string,
  timeoutMs: number = 1000
): Promise<DiscoveredServer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`http://${host}:${port}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    if (isValidHealthResponse(data, expectedServerId)) {
      return {
        host,
        port,
        serverId: data.server_id,
        tier: 'cached',
      };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tier 2: Listen for UDP beacon broadcast on BEACON_PORT (41716)
 */
export async function listenForBeacon(
  expectedServerId: string,
  timeoutMs: number = 5000,
  port: number = BEACON_PORT
): Promise<DiscoveredServer | null> {
  let dgramModule: any = null;
  try {
    // @ts-ignore dynamic import for optional native dependency
    dgramModule = await import('react-native-udp').catch(() => null);
    if (!dgramModule) {
      // @ts-ignore dynamic import for optional node/bun dependency
      dgramModule = await import('dgram').catch(() => null);
    }
  } catch {
    dgramModule = null;
  }

  if (!dgramModule || typeof dgramModule.createSocket !== 'function') {
    return null;
  }

  return new Promise((resolve) => {
    let socket: any = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      if (socket) {
        try {
          socket.close();
        } catch {
          // ignore socket close error
        }
      }
    };

    timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    try {
      socket = dgramModule.createSocket({ type: 'udp4', reuseAddr: true });

      socket.on('error', () => {
        cleanup();
        resolve(null);
      });

      socket.on('message', (msg: any, rinfo: any) => {
        try {
          const raw = typeof msg === 'string' ? msg : msg.toString('utf8');
          const payload = JSON.parse(raw);
          if (isValidBeaconPayload(payload, expectedServerId)) {
            const senderIp = rinfo?.address || '127.0.0.1';
            const serverPort = payload.port || DEFAULT_PORT;
            cleanup();
            resolve({
              host: senderIp,
              port: serverPort,
              serverId: payload.id,
              tier: 'udp',
            });
          }
        } catch {
          // invalid packet, continue listening
        }
      });

      socket.bind(port, () => {
        // socket bound and ready to receive broadcasts
      });
    } catch {
      cleanup();
      resolve(null);
    }
  });
}

/**
 * Tier 3: Fast subnet scan fallback
 * Scans the hotspot subnet (e.g. 192.168.43.0/24) in parallel with short timeout
 */
export async function scanSubnet(
  expectedServerId: string,
  options: {
    targetSubnet?: string;
    port?: number;
    timeoutMs?: number;
    concurrency?: number;
  } = {}
): Promise<DiscoveredServer | null> {
  const port = options.port ?? DEFAULT_PORT;
  const timeoutMs = options.timeoutMs ?? 800;
  const subnet = options.targetSubnet ?? '192.168.43.';
  const concurrency = options.concurrency ?? 25;

  const abortController = new AbortController();

  // Helper to test a single IP address
  const probeIp = async (ip: string): Promise<DiscoveredServer | null> => {
    if (abortController.signal.aborted) return null;
    const innerController = new AbortController();
    const timer = setTimeout(() => innerController.abort(), timeoutMs);

    // Forward abort signal
    const onParentAbort = () => innerController.abort();
    abortController.signal.addEventListener('abort', onParentAbort);

    try {
      const res = await fetch(`http://${ip}:${port}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: innerController.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (isValidHealthResponse(data, expectedServerId)) {
        abortController.abort(); // Stop remaining probes
        return {
          host: ip,
          port,
          serverId: data.server_id,
          tier: 'subnet',
        };
      }
      return null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      abortController.signal.removeEventListener('abort', onParentAbort);
    }
  };

  // Generate 1..254 IP addresses
  const ips: string[] = [];
  for (let i = 1; i <= 254; i++) {
    ips.push(`${subnet}${i}`);
  }

  // Scan in parallel batches
  for (let i = 0; i < ips.length; i += concurrency) {
    if (abortController.signal.aborted) break;
    const batch = ips.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((ip) => probeIp(ip)));
    const found = results.find((r) => r !== null);
    if (found) {
      return found;
    }
  }

  return null;
}

/**
 * Tier 4 / Manual Probe: Test a user-specified host and port
 */
export async function probeManualHost(
  host: string,
  port: number,
  expectedServerId: string,
  timeoutMs: number = 2000
): Promise<DiscoveredServer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`http://${host}:${port}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (isValidHealthResponse(data, expectedServerId)) {
      return {
        host,
        port,
        serverId: data.server_id,
        tier: 'manual',
      };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 3-Tier Discovery Coordinator
 * 1. Cached IP probe (1s timeout)
 * 2. UDP beacon listener (5s timeout)
 * 3. Fast subnet scan fallback (hotspot subnets)
 * 4. Manual host fallback (if provided)
 */
export async function discoverServer(
  expectedServerId: string,
  cachedHost?: string,
  cachedPort?: number,
  options: DiscoveryOptions = {}
): Promise<DiscoveredServer | null> {
  // 1. Tier 1: Cached IP Probe
  if (cachedHost && cachedPort) {
    const cached = await probeCachedHost(
      cachedHost,
      cachedPort,
      expectedServerId,
      options.cachedTimeoutMs ?? 1000
    );
    if (cached) {
      return cached;
    }
  }

  // 2. Tier 2: UDP Beacon Listener
  const beacon = await listenForBeacon(
    expectedServerId,
    options.beaconTimeoutMs ?? 5000,
    BEACON_PORT
  );
  if (beacon) {
    return beacon;
  }

  // 3. Tier 3: Fast Subnet Scan Fallback
  // Try cached subnet first if known, otherwise standard mobile hotspot subnets
  const candidateSubnets = options.customSubnets ?? [];
  if (cachedHost) {
    const base = extractSubnetBase(cachedHost);
    if (base && !candidateSubnets.includes(base)) {
      candidateSubnets.unshift(base);
    }
  }
  // Standard hotspot subnets: Android (192.168.43.), iOS (172.20.10.), Windows (192.168.137.)
  const defaultSubnets = ['192.168.43.', '172.20.10.', '192.168.137.'];
  for (const s of defaultSubnets) {
    if (!candidateSubnets.includes(s)) {
      candidateSubnets.push(s);
    }
  }

  for (const sub of candidateSubnets) {
    const scanned = await scanSubnet(expectedServerId, {
      targetSubnet: sub,
      port: cachedPort ?? DEFAULT_PORT,
      timeoutMs: options.subnetTimeoutMs ?? 800,
    });
    if (scanned) {
      return scanned;
    }
  }

  // 4. Manual Host / Port Fallback (if user provided)
  if (options.manualHost && options.manualPort) {
    const manual = await probeManualHost(
      options.manualHost,
      options.manualPort,
      expectedServerId
    );
    if (manual) {
      return manual;
    }
  }

  return null;
}

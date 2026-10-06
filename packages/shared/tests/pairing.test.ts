import { describe, expect, it } from 'bun:test';
import { generatePairingUri, parsePairingUri } from '../src/pairing.ts';
import type { PairingCredentials } from '../src/types.ts';

describe('Pairing URI utilities', () => {
  describe('parsePairingUri', () => {
    it('successfully parses a valid pairing URI without host', () => {
      const uri = 'imgdrop://pair?id=01JABCDEFGHJKMNPQRSTUVWXY1&token=abcdef1234567890&port=8000';
      const result = parsePairingUri(uri);

      expect(result).not.toBeNull();
      expect(result).toEqual({
        serverId: '01JABCDEFGHJKMNPQRSTUVWXY1',
        token: 'abcdef1234567890',
        port: 8000,
      });
    });

    it('successfully parses a valid pairing URI with host', () => {
      const uri = 'imgdrop://pair?id=server-01&token=secret-token&port=8080&host=192.168.1.150';
      const result = parsePairingUri(uri);

      expect(result).not.toBeNull();
      expect(result).toEqual({
        serverId: 'server-01',
        token: 'secret-token',
        port: 8080,
        host: '192.168.1.150',
      });
    });

    it('handles trailing slash on pair path', () => {
      const uri = 'imgdrop://pair/?id=server-01&token=secret-token&port=8000';
      const result = parsePairingUri(uri);

      expect(result).not.toBeNull();
      expect(result).toEqual({
        serverId: 'server-01',
        token: 'secret-token',
        port: 8000,
      });
    });

    it('handles encoded parameters properly', () => {
      const uri = 'imgdrop://pair?id=srv%20with%20spaces&token=tok%2Bspecial%3D&port=9000';
      const result = parsePairingUri(uri);

      expect(result).not.toBeNull();
      expect(result).toEqual({
        serverId: 'srv with spaces',
        token: 'tok+special=',
        port: 9000,
      });
    });

    it('returns null for empty or non-string input', () => {
      expect(parsePairingUri('')).toBeNull();
      expect(parsePairingUri('   ')).toBeNull();
      expect(parsePairingUri(null as unknown as string)).toBeNull();
      expect(parsePairingUri(undefined as unknown as string)).toBeNull();
    });

    it('returns null for malformed URIs', () => {
      expect(parsePairingUri('not-a-valid-uri')).toBeNull();
      expect(parsePairingUri('://missing-scheme')).toBeNull();
    });

    it('returns null for wrong protocol', () => {
      expect(parsePairingUri('http://pair?id=s1&token=t1&port=8000')).toBeNull();
      expect(parsePairingUri('https://pair?id=s1&token=t1&port=8000')).toBeNull();
      expect(parsePairingUri('custom://pair?id=s1&token=t1&port=8000')).toBeNull();
    });

    it('returns null for wrong action/host', () => {
      expect(parsePairingUri('imgdrop://connect?id=s1&token=t1&port=8000')).toBeNull();
      expect(parsePairingUri('imgdrop://groups?id=s1&token=t1&port=8000')).toBeNull();
    });

    it('returns null when id is missing or empty', () => {
      expect(parsePairingUri('imgdrop://pair?token=t1&port=8000')).toBeNull();
      expect(parsePairingUri('imgdrop://pair?id=&token=t1&port=8000')).toBeNull();
      expect(parsePairingUri('imgdrop://pair?id=%20%20&token=t1&port=8000')).toBeNull();
    });

    it('returns null when token is missing or empty', () => {
      expect(parsePairingUri('imgdrop://pair?id=s1&port=8000')).toBeNull();
      expect(parsePairingUri('imgdrop://pair?id=s1&token=&port=8000')).toBeNull();
      expect(parsePairingUri('imgdrop://pair?id=s1&token=%20&port=8000')).toBeNull();
    });

    it('returns null when port is missing, non-numeric, or out of range', () => {
      expect(parsePairingUri('imgdrop://pair?id=s1&token=t1')).toBeNull();
      expect(parsePairingUri('imgdrop://pair?id=s1&token=t1&port=')).toBeNull();
      expect(parsePairingUri('imgdrop://pair?id=s1&token=t1&port=abc')).toBeNull();
      expect(parsePairingUri('imgdrop://pair?id=s1&token=t1&port=0')).toBeNull();
      expect(parsePairingUri('imgdrop://pair?id=s1&token=t1&port=-50')).toBeNull();
      expect(parsePairingUri('imgdrop://pair?id=s1&token=t1&port=65536')).toBeNull();
      expect(parsePairingUri('imgdrop://pair?id=s1&token=t1&port=8000.5')).toBeNull();
    });
  });

  describe('generatePairingUri', () => {
    it('generates a valid pairing URI without host', () => {
      const creds: PairingCredentials = {
        serverId: '01JABCDEFGHJKMNPQRSTUVWXY1',
        token: 'secret123',
        port: 8000,
      };

      const uri = generatePairingUri(creds);
      expect(uri).toBe('imgdrop://pair?id=01JABCDEFGHJKMNPQRSTUVWXY1&token=secret123&port=8000');
    });

    it('generates a valid pairing URI with host', () => {
      const creds: PairingCredentials = {
        serverId: '01JABCDEFGHJKMNPQRSTUVWXY1',
        token: 'secret123',
        port: 8000,
        host: '192.168.1.50',
      };

      const uri = generatePairingUri(creds);
      expect(uri).toBe('imgdrop://pair?id=01JABCDEFGHJKMNPQRSTUVWXY1&token=secret123&port=8000&host=192.168.1.50');
    });

    it('throws when required fields are missing or invalid', () => {
      expect(() => generatePairingUri({ serverId: '', token: 't1', port: 8000 })).toThrow();
      expect(() => generatePairingUri({ serverId: 's1', token: '', port: 8000 })).toThrow();
      expect(() => generatePairingUri({ serverId: 's1', token: 't1', port: 0 })).toThrow();
      expect(() => generatePairingUri({ serverId: 's1', token: 't1', port: 70000 })).toThrow();
      expect(() => generatePairingUri({ serverId: 's1', token: 't1', port: NaN })).toThrow();
    });
  });

  describe('roundtrip generation and parsing', () => {
    it('roundtrips minimal credentials without host', () => {
      const original: PairingCredentials = {
        serverId: 'hex-128bit-server-id-abcdef',
        token: 'hex-256bit-token-0123456789abcdef0123456789abcdef',
        port: 8000,
      };

      const uri = generatePairingUri(original);
      const parsed = parsePairingUri(uri);

      expect(parsed).toEqual(original);
    });

    it('roundtrips full credentials with host', () => {
      const original: PairingCredentials = {
        serverId: 'hex-128bit-server-id-abcdef',
        token: 'hex-256bit-token-0123456789abcdef0123456789abcdef',
        port: 8080,
        host: '192.168.43.10',
      };

      const uri = generatePairingUri(original);
      const parsed = parsePairingUri(uri);

      expect(parsed).toEqual(original);
    });

    it('roundtrips credentials containing special characters', () => {
      const original: PairingCredentials = {
        serverId: 'server:id/test+1',
        token: 'token=xyz&val=123',
        port: 41716,
        host: 'my-laptop.local',
      };

      const uri = generatePairingUri(original);
      const parsed = parsePairingUri(uri);

      expect(parsed).toEqual(original);
    });
  });
});

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import {
  SegmentedButtons,
  TextInput,
  Button,
  Card,
  Text,
  HelperText,
  Snackbar,
  Surface,
  ActivityIndicator,
  IconButton,
  useTheme,
} from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { parsePairingUri, DEFAULT_PORT } from '@imgdrop/shared';
import { useAppStore } from '../src/store/useAppStore';
import { checkHealth } from '../src/services/api';
import type { AppTheme } from '../src/theme/theme';

export default function PairScreen() {
  const router = useRouter();
  const theme = useTheme<AppTheme>();
  const { setPairing, serverId: currentServerId, host: currentHost, port: currentPort } = useAppStore();

  const [tab, setTab] = useState<'qr' | 'manual'>('qr');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  // Manual inputs
  const [manualHost, setManualHost] = useState(currentHost || '');
  const [manualPort, setManualPort] = useState(String(currentPort || DEFAULT_PORT));
  const [manualServerId, setManualServerId] = useState(currentServerId || '');
  const [manualToken, setManualToken] = useState('');
  const [testingConnection, setTestingConnection] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    const creds = parsePairingUri(data);
    if (!creds) {
      setErrorMessage('Invalid QR code. Must be an imgdrop://pair URI.');
      setTimeout(() => setScanned(false), 2500);
      return;
    }

    try {
      setSnackbarMessage(`Paired with server ${creds.serverId}!`);
      await setPairing(creds);
      setTimeout(() => {
        router.replace('/');
      }, 800);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save pairing.');
      setScanned(false);
    }
  };

  const handleManualPair = async () => {
    setErrorMessage(null);

    const host = manualHost.trim();
    const port = parseInt(manualPort.trim(), 10);
    const serverId = manualServerId.trim();
    const token = manualToken.trim();

    if (!host) {
      setErrorMessage('Server Host/IP is required.');
      return;
    }
    if (isNaN(port) || port < 1 || port > 65535) {
      setErrorMessage('Port must be between 1 and 65535.');
      return;
    }
    if (!serverId) {
      setErrorMessage('Server ID is required.');
      return;
    }
    if (!token) {
      setErrorMessage('Pairing Token is required.');
      return;
    }

    setTestingConnection(true);

    try {
      // Test server connection via health check
      const health = await checkHealth(host, port, 3000);
      if (health.status !== 'ok') {
        throw new Error('Server returned invalid health status.');
      }
      if (health.server_id && health.server_id !== serverId) {
        throw new Error(`Server ID mismatch: expected ${serverId}, server reported ${health.server_id}`);
      }

      await setPairing({
        serverId,
        token,
        port,
        host,
      });

      setSnackbarMessage('Server paired successfully!');
      setTimeout(() => {
        router.replace('/');
      }, 600);
    } catch (err: any) {
      setErrorMessage(`Connection failed: ${err?.message || 'Host unreachable'}`);
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={tab}
          onValueChange={(val) => {
            setTab(val as 'qr' | 'manual');
            setErrorMessage(null);
          }}
          buttons={[
            {
              value: 'qr',
              label: 'Scan QR Code',
              icon: 'qrcode-scan',
            },
            {
              value: 'manual',
              label: 'Manual Setup',
              icon: 'form-textbox',
            },
          ]}
        />
      </View>

      {tab === 'qr' ? (
        <View style={styles.qrContainer}>
          {!permission ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" />
              <Text variant="bodyMedium" style={styles.permText}>
                Checking camera permissions...
              </Text>
            </View>
          ) : !permission.granted ? (
            <View style={styles.centerBox}>
              <IconButton icon="camera-off" size={48} iconColor={theme.colors.error} />
              <Text variant="titleMedium" style={styles.permTitle}>
                Camera Access Needed
              </Text>
              <Text variant="bodyMedium" style={styles.permSub}>
                Camera permission is required to scan the pairing QR code from your desktop terminal.
              </Text>
              <Button
                mode="contained"
                onPress={requestPermission}
                style={styles.permButton}
              >
                Grant Camera Permission
              </Button>
            </View>
          ) : (
            <View style={styles.scannerWrapper}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              />
              <View style={styles.overlay}>
                <View style={styles.scanTarget}>
                  <View style={[styles.corner, styles.topLeft, { borderColor: theme.colors.primary }]} />
                  <View style={[styles.corner, styles.topRight, { borderColor: theme.colors.primary }]} />
                  <View style={[styles.corner, styles.bottomLeft, { borderColor: theme.colors.primary }]} />
                  <View style={[styles.corner, styles.bottomRight, { borderColor: theme.colors.primary }]} />
                </View>
                <Surface style={styles.scanHintCard} elevation={2}>
                  <Text variant="bodySmall" style={styles.scanHintText}>
                    Point camera at the QR code displayed in your desktop terminal.
                  </Text>
                </Surface>
                {scanned && (
                  <Button
                    mode="contained"
                    onPress={() => setScanned(false)}
                    style={styles.rescanButton}
                  >
                    Tap to Scan Again
                  </Button>
                )}
              </View>
            </View>
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.manualScroll}
          keyboardShouldPersistTaps="handled"
        >
          <Surface style={styles.card} elevation={1}>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Manual Connection Settings
            </Text>
            <Text variant="bodySmall" style={styles.cardSubtitle}>
              Enter desktop IP address and pairing token manually if you cannot scan the QR code.
            </Text>

            <TextInput
              label="Server Host / IP"
              value={manualHost}
              onChangeText={setManualHost}
              placeholder="e.g. 192.168.43.1 or 10.0.0.5"
              mode="outlined"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              label="Server Port"
              value={manualPort}
              onChangeText={setManualPort}
              placeholder="8000"
              keyboardType="number-pad"
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="Server ID"
              value={manualServerId}
              onChangeText={setManualServerId}
              placeholder="e.g. srv_01HQ..."
              mode="outlined"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              label="Auth Token"
              value={manualToken}
              onChangeText={setManualToken}
              placeholder="Secret token printed in terminal"
              mode="outlined"
              secureTextEntry
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {errorMessage && (
              <HelperText type="error" visible={!!errorMessage} style={styles.errorText}>
                {errorMessage}
              </HelperText>
            )}

            <Button
              mode="contained"
              icon="check-circle"
              onPress={handleManualPair}
              loading={testingConnection}
              disabled={testingConnection}
              style={styles.submitButton}
            >
              Test & Save Pairing
            </Button>
          </Surface>
        </ScrollView>
      )}

      <Snackbar
        visible={!!snackbarMessage}
        onDismiss={() => setSnackbarMessage(null)}
        duration={2500}
      >
        {snackbarMessage}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  tabContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  qrContainer: {
    flex: 1,
  },
  scannerWrapper: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scanTarget: {
    width: 240,
    height: 240,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanHintCard: {
    marginTop: 32,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    maxWidth: '80%',
  },
  scanHintText: {
    color: '#0F172A',
    textAlign: 'center',
    fontWeight: '500',
  },
  rescanButton: {
    marginTop: 20,
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permTitle: {
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  permSub: {
    textAlign: 'center',
    color: '#64748B',
    marginBottom: 16,
  },
  permButton: {
    borderRadius: 8,
  },
  permText: {
    marginTop: 12,
    color: '#64748B',
  },
  manualScroll: {
    padding: 16,
  },
  card: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  cardTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSubtitle: {
    color: '#64748B',
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    marginBottom: 8,
  },
  submitButton: {
    marginTop: 8,
    borderRadius: 10,
  },
});

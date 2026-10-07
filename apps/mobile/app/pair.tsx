import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Text,
  Platform,
  StatusBar as RNStatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, Snackbar } from 'react-native-paper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { parsePairingUri, DEFAULT_PORT } from '@imgdrop/shared';
import { useAppStore } from '../src/store/useAppStore';
import { checkHealth } from '../src/services/api';
import { useAppTheme } from '../src/theme/theme';

export default function PairScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { setPairing, serverId: currentServerId, host: currentHost, port: currentPort } = useAppStore();

  const [tab, setTab] = useState<'qr' | 'manual'>('manual');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);

  // Manual form inputs
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
      }, 700);
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
        throw new Error('Server returned unhealthy status.');
      }
      if (health.server_id && health.server_id !== serverId) {
        throw new Error(`Server ID mismatch. Target server reported ${health.server_id}.`);
      }

      await setPairing({
        serverId,
        token,
        host,
        port,
      });

      setSnackbarMessage('Paired and connected successfully!');
      setTimeout(() => {
        router.replace('/');
      }, 700);
    } catch (err: any) {
      setErrorMessage(
        `Connection failed: ${err?.message || 'Could not reach server at this IP/port.'}`
      );
    } finally {
      setTestingConnection(false);
    }
  };

  const insets = useSafeAreaInsets();
  const topPadding = insets.top > 0
    ? insets.top + 8
    : Platform.OS === 'android'
    ? (RNStatusBar.currentHeight || 24) + 8
    : 12;
  const bottomPadding = insets.bottom > 0 ? insets.bottom + 20 : 36;

  return (
    <View style={[styles.safeArea, { backgroundColor: theme.colors.appBg }]}>
      {/* Top App Bar with Back Button and safe area padding */}
      <View
        style={[
          styles.topAppBar,
          {
            paddingTop: topPadding,
            backgroundColor: theme.colors.appBg,
            borderBottomColor: theme.colors.appBorder,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityLabel="Go Back"
        >
          <IconButton
            icon="arrow-left"
            size={22}
            iconColor={theme.colors.appText}
            style={styles.zeroMarginIcon}
          />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: theme.colors.appText }]}>
          Pair Desktop Server
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Segmented Switcher per Stitch Minimal Spec */}
        <View
          style={[
            styles.segmentedTabs,
            {
              backgroundColor: theme.colors.appCard,
              borderColor: theme.colors.appBorder,
            },
          ]}
        >
          {/* Tab 1: Scan QR Code */}
          <TouchableOpacity
            onPress={() => setTab('qr')}
            activeOpacity={0.8}
            style={[
              styles.tabButton,
              tab === 'qr' && [
                styles.tabButtonActive,
                {
                  backgroundColor: theme.dark ? '#27272A' : '#FFFFFF',
                  borderColor: theme.dark ? '#3F3F46' : '#E4E4E7',
                },
              ],
            ]}
          >
            <IconButton
              icon="qrcode-scan"
              size={16}
              iconColor={tab === 'qr' ? theme.colors.appText : theme.colors.appMuted}
              style={styles.zeroMarginIcon}
            />
            <Text
              style={[
                styles.tabText,
                {
                  color: tab === 'qr' ? theme.colors.appText : theme.colors.appMuted,
                  fontWeight: tab === 'qr' ? '700' : '500',
                },
              ]}
            >
              Scan QR Code
            </Text>
          </TouchableOpacity>

          {/* Tab 2: Manual Setup */}
          <TouchableOpacity
            onPress={() => setTab('manual')}
            activeOpacity={0.8}
            style={[
              styles.tabButton,
              tab === 'manual' && [
                styles.tabButtonActive,
                {
                  backgroundColor: theme.dark ? '#27272A' : '#FFFFFF',
                  borderColor: theme.dark ? '#3F3F46' : '#E4E4E7',
                },
              ],
            ]}
          >
            <IconButton
              icon="link-variant"
              size={16}
              iconColor={tab === 'manual' ? theme.colors.appText : theme.colors.appMuted}
              style={styles.zeroMarginIcon}
            />
            <Text
              style={[
                styles.tabText,
                {
                  color: tab === 'manual' ? theme.colors.appText : theme.colors.appMuted,
                  fontWeight: tab === 'manual' ? '700' : '500',
                },
              ]}
            >
              Manual Setup
            </Text>
          </TouchableOpacity>
        </View>

        {/* Error Feedback */}
        {errorMessage && (
          <View
            style={[
              styles.errorCard,
              {
                borderColor: theme.colors.appDanger,
                backgroundColor: theme.dark ? '#2A1215' : '#FEE2E2',
              },
            ]}
          >
            <IconButton
              icon="alert-circle-outline"
              size={18}
              iconColor={theme.colors.appDanger}
              style={styles.zeroMarginIcon}
            />
            <Text style={[styles.errorCardText, { color: theme.colors.appDanger }]}>
              {errorMessage}
            </Text>
          </View>
        )}

        {/* TAB 1: QR Scanner */}
        {tab === 'qr' && (
          <View style={styles.qrSection}>
            {!permission?.granted ? (
              <View
                style={[
                  styles.permissionCard,
                  {
                    borderColor: theme.colors.appBorder,
                    backgroundColor: theme.colors.appCard,
                  },
                ]}
              >
                <IconButton
                  icon="camera-off"
                  size={42}
                  iconColor={theme.colors.appDim}
                  style={styles.zeroMarginIcon}
                />
                <Text style={[styles.permissionTitle, { color: theme.colors.appText }]}>
                  Camera Permission Required
                </Text>
                <Text style={[styles.permissionSubtitle, { color: theme.colors.appMuted }]}>
                  ImgDrop needs camera access to scan your desktop pairing QR code.
                </Text>
                <TouchableOpacity
                  onPress={requestPermission}
                  activeOpacity={0.8}
                  style={[
                    styles.primaryFlatButton,
                    { backgroundColor: theme.colors.appAccent },
                  ]}
                >
                  <Text style={styles.primaryFlatButtonText}>Grant Camera Access</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View
                style={[
                  styles.cameraContainer,
                  {
                    borderColor: theme.colors.appBorder,
                    backgroundColor: '#000000',
                  },
                ]}
              >
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  facing="back"
                  enableTorch={torchEnabled}
                  barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                  }}
                  onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                />

                {/* Minimalist Viewfinder Frame */}
                <View style={styles.viewfinderOverlay}>
                  <View
                    style={[
                      styles.viewfinderBox,
                      {
                        borderColor: theme.colors.appAccent,
                      },
                    ]}
                  />
                  <Text style={styles.viewfinderHint}>
                    Align desktop QR code inside frame
                  </Text>
                </View>

                {/* Torch Toggle */}
                <TouchableOpacity
                  onPress={() => setTorchEnabled(!torchEnabled)}
                  style={styles.torchButton}
                  activeOpacity={0.7}
                >
                  <IconButton
                    icon={torchEnabled ? 'flashlight' : 'flashlight-off'}
                    size={20}
                    iconColor="#FFFFFF"
                    style={styles.zeroMarginIcon}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* TAB 2: Manual Setup */}
        {tab === 'manual' && (
          <View style={styles.manualSection}>
            <View style={styles.manualHeader}>
              <Text style={[styles.manualTitle, { color: theme.colors.appText }]}>
                Manual Connection Settings
              </Text>
              <Text style={[styles.manualSubtitle, { color: theme.colors.appMuted }]}>
                Enter desktop IP address and pairing token manually if you cannot scan the QR code.
              </Text>
            </View>

            {/* Field: Server Host */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.appMuted }]}>
                SERVER HOST / IP
              </Text>
              <TextInput
                placeholder="e.g. 192.168.1.100"
                placeholderTextColor={theme.colors.appDim}
                value={manualHost}
                onChangeText={setManualHost}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="numbers-and-punctuation"
                style={[
                  styles.formInput,
                  {
                    color: theme.colors.appText,
                    backgroundColor: theme.colors.appInput,
                    borderColor: theme.colors.appBorder,
                  },
                ]}
              />
            </View>

            {/* Field: Server Port */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.appMuted }]}>
                SERVER PORT
              </Text>
              <TextInput
                placeholder="8000"
                placeholderTextColor={theme.colors.appDim}
                value={manualPort}
                onChangeText={setManualPort}
                keyboardType="number-pad"
                style={[
                  styles.formInput,
                  {
                    color: theme.colors.appText,
                    backgroundColor: theme.colors.appInput,
                    borderColor: theme.colors.appBorder,
                  },
                ]}
              />
            </View>

            {/* Field: Server ID */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.appMuted }]}>
                SERVER ID
              </Text>
              <TextInput
                placeholder="Unique Server ID"
                placeholderTextColor={theme.colors.appDim}
                value={manualServerId}
                onChangeText={setManualServerId}
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.formInput,
                  {
                    color: theme.colors.appText,
                    backgroundColor: theme.colors.appInput,
                    borderColor: theme.colors.appBorder,
                  },
                ]}
              />
            </View>

            {/* Field: Auth Token */}
            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: theme.colors.appMuted }]}>
                AUTH TOKEN
              </Text>
              <TextInput
                placeholder="Auth Token from terminal"
                placeholderTextColor={theme.colors.appDim}
                value={manualToken}
                onChangeText={setManualToken}
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.formInput,
                  {
                    color: theme.colors.appText,
                    backgroundColor: theme.colors.appInput,
                    borderColor: theme.colors.appBorder,
                  },
                ]}
              />
            </View>

            {/* Submit Action: Test & Save Pairing */}
            <TouchableOpacity
              onPress={handleManualPair}
              disabled={testingConnection}
              activeOpacity={0.8}
              style={[
                styles.primaryFlatButton,
                styles.manualSubmitButton,
                { backgroundColor: theme.colors.appAccent },
              ]}
            >
              {testingConnection ? (
                <>
                  <ActivityIndicator size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryFlatButtonText}>Testing Connection...</Text>
                </>
              ) : (
                <>
                  <IconButton
                    icon="check-circle-outline"
                    size={18}
                    iconColor="#FFFFFF"
                    style={styles.zeroMarginIcon}
                  />
                  <Text style={styles.primaryFlatButtonText}>Test &amp; Save Pairing</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Snackbar
        visible={!!snackbarMessage}
        onDismiss={() => setSnackbarMessage(null)}
        duration={3000}
        style={{
          backgroundColor: theme.colors.appCard,
          borderWidth: 1,
          borderColor: theme.colors.appBorder,
          borderRadius: 0,
        }}
      >
        <Text style={{ color: theme.colors.appText }}>{snackbarMessage}</Text>
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topAppBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 2,
    marginRight: 6,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  segmentedTabs: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 0, // Sharp corners
    padding: 3,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
    gap: 6,
  },
  tabButtonActive: {
    borderWidth: 1,
  },
  tabText: {
    fontSize: 13,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: 12,
    borderRadius: 0,
    marginBottom: 16,
  },
  errorCardText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    marginLeft: 8,
  },
  qrSection: {
    width: '100%',
  },
  permissionCard: {
    borderWidth: 1,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  permissionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  permissionSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
    lineHeight: 17,
    maxWidth: 240,
  },
  cameraContainer: {
    height: 380,
    borderWidth: 1,
    borderRadius: 0, // Sharp square edges
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinderBox: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderRadius: 0, // Crisp square viewfinder
    backgroundColor: 'transparent',
  },
  viewfinderHint: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  torchButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 0,
    padding: 4,
  },
  manualSection: {
    width: '100%',
  },
  manualHeader: {
    marginBottom: 20,
  },
  manualTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  manualSubtitle: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  formInput: {
    height: 46,
    borderWidth: 1,
    borderRadius: 0, // Sharp corners
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'SF Mono' : 'monospace',
  },
  manualSubmitButton: {
    marginTop: 10,
    height: 48,
  },
  primaryFlatButton: {
    height: 44,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  primaryFlatButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  zeroMarginIcon: {
    margin: 0,
  },
});

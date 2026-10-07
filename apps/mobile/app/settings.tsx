import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  TextInput,
  Platform,
  StatusBar as RNStatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, Portal, Dialog, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import {
  BEACON_PORT,
  TARGET_LONG_EDGE_PX,
  MAX_FILES,
  WEBP_QUALITY,
} from '@imgdrop/shared';
import { useAppStore } from '../src/store/useAppStore';
import { ConnectionBadge } from '../src/components/ConnectionBadge';
import { useAppTheme } from '../src/theme/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  const {
    serverId,
    token,
    host,
    port,
    isPaired,
    connectionStatus,
    pingServer,
    startDiscovery,
    setHost,
    unpair,
  } = useAppStore();

  const [isPinging, setIsPinging] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [unpairDialogVisible, setUnpairDialogVisible] = useState(false);
  const [editHostDialogVisible, setEditHostDialogVisible] = useState(false);
  const [editHostValue, setEditHostValue] = useState('');
  const [isSavingHost, setIsSavingHost] = useState(false);
  const [editHostError, setEditHostError] = useState<string | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

  const handleOpenEditHost = () => {
    setEditHostValue(host || '');
    setEditHostError(null);
    setEditHostDialogVisible(true);
  };

  const handleSaveHost = async () => {
    setEditHostError(null);
    const target = editHostValue.trim();
    if (!target) {
      setEditHostError('Host IP cannot be empty.');
      return;
    }
    setIsSavingHost(true);
    try {
      const ok = await setHost(target);
      if (ok) {
        setEditHostDialogVisible(false);
        setSnackbarMessage(`Connected to server at ${target}!`);
      } else {
        setEditHostError(`Could not connect to ${target}:${port}. Verify desktop server is running.`);
      }
    } catch (e: any) {
      setEditHostError(`Connection failed: ${e?.message || 'Network error'}`);
    } finally {
      setIsSavingHost(false);
    }
  };

  const handlePing = async () => {
    setIsPinging(true);
    const start = Date.now();
    try {
      const ok = await pingServer();
      const elapsed = Date.now() - start;
      if (ok) {
        setSnackbarMessage(`Ping successful (${elapsed}ms)`);
      } else {
        setSnackbarMessage('Ping failed: Server did not respond.');
      }
    } catch {
      setSnackbarMessage('Ping failed: Network unreachable.');
    } finally {
      setIsPinging(false);
    }
  };

  const handleDiscovery = async () => {
    setIsDiscovering(true);
    setSnackbarMessage('Discovering desktop server on LAN...');
    try {
      const ok = await startDiscovery();
      if (ok) {
        setSnackbarMessage('Desktop server discovered & verified!');
      } else {
        setSnackbarMessage('Server discovery timed out. Try manual IP setup.');
      }
    } catch {
      setSnackbarMessage('Discovery failed. Verify WiFi connection.');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleConfirmUnpair = async () => {
    setUnpairDialogVisible(false);
    await unpair();
    setSnackbarMessage('Server credentials removed.');
    setTimeout(() => {
      router.replace('/');
    }, 400);
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
      {/* Top Bar with Back Arrow and safe area padding */}
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
          accessibilityLabel="Go back"
        >
          <IconButton
            icon="arrow-left"
            size={22}
            iconColor={theme.colors.appText}
            style={styles.zeroMarginIcon}
          />
        </TouchableOpacity>
        <Text style={[styles.screenTitle, { color: theme.colors.appText }]}>
          Settings &amp; Diagnostics
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1: Connection & Server */}
        <View
          style={[
            styles.sectionBlock,
            { borderBottomColor: theme.colors.appBorder },
          ]}
        >
          {/* Header Row */}
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.colors.appText }]}>
                Connection &amp; Server
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.appMuted }]}>
                Current handoff target and LAN status
              </Text>
            </View>
            <ConnectionBadge
              status={connectionStatus}
              isPaired={isPaired}
              compact
            />
          </View>

          {/* Key-Value Details */}
          <View style={styles.detailsList}>
            {/* Host */}
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.appMuted }]}>
                Server Host:
              </Text>
              <TouchableOpacity
                onPress={handleOpenEditHost}
                style={styles.hostValueTouchable}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.detailValue,
                    {
                      color: host ? theme.colors.appText : theme.colors.appMuted,
                      fontFamily: host
                        ? Platform.OS === 'ios'
                          ? 'SF Mono'
                          : 'monospace'
                        : undefined,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {host || 'Not set (Discovery required)'}
                </Text>
                <IconButton
                  icon="pencil-outline"
                  size={14}
                  iconColor={theme.colors.appAccent}
                  style={styles.editIcon}
                />
              </TouchableOpacity>
            </View>

            {/* Port */}
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.appMuted }]}>
                Server Port:
              </Text>
              <Text style={[styles.detailValueMono, { color: theme.colors.appText }]}>
                {port || 8000}
              </Text>
            </View>

            {/* Server ID */}
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.appMuted }]}>
                Server ID:
              </Text>
              <Text
                style={[
                  styles.detailValueMono,
                  styles.breakAllText,
                  { color: theme.colors.appText },
                ]}
                numberOfLines={1}
                selectable
              >
                {serverId || 'None'}
              </Text>
            </View>

            {/* Auth Token */}
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.appMuted }]}>
                Auth Token:
              </Text>
              <Text style={[styles.detailValueMono, { color: theme.colors.appText }]}>
                {token ? `${token.slice(0, 4)}...${token.slice(-4)}` : 'Not configured'}
              </Text>
            </View>
          </View>

          {/* Action Buttons Row */}
          <View style={styles.actionButtonsRow}>
            {/* Ping Server */}
            <TouchableOpacity
              onPress={handlePing}
              disabled={isPinging || !host}
              activeOpacity={0.7}
              style={[
                styles.actionBtn,
                styles.pingBtn,
                {
                  borderColor: theme.colors.appBorder,
                  backgroundColor: theme.colors.appCard,
                  opacity: isPinging || !host ? 0.5 : 1,
                },
              ]}
            >
              {isPinging ? (
                <ActivityIndicator size={12} color={theme.colors.appMuted} />
              ) : (
                <IconButton
                  icon="swap-horizontal"
                  size={16}
                  iconColor={theme.colors.appMuted}
                  style={styles.zeroMarginIcon}
                />
              )}
              <Text style={[styles.pingBtnText, { color: theme.colors.appMuted }]}>
                Ping Server
              </Text>
            </TouchableOpacity>

            {/* Trigger Handoff / Start Discovery */}
            <TouchableOpacity
              onPress={handleDiscovery}
              disabled={isDiscovering || !serverId}
              activeOpacity={0.8}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: theme.colors.appAccent,
                  opacity: isDiscovering || !serverId ? 0.5 : 1,
                },
              ]}
            >
              {isDiscovering ? (
                <ActivityIndicator size={12} color="#FFFFFF" />
              ) : (
                <IconButton
                  icon="radar"
                  size={16}
                  iconColor="#FFFFFF"
                  style={styles.zeroMarginIcon}
                />
              )}
              <Text style={styles.discoveryBtnText}>Trigger Handoff</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 2: Pairing Controls */}
        <View
          style={[
            styles.sectionBlock,
            { borderBottomColor: theme.colors.appBorder },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.appText }]}>
            Pairing Controls
          </Text>
          <Text
            style={[
              styles.sectionSubtitle,
              { color: theme.colors.appMuted, marginBottom: 14 },
            ]}
          >
            Scan new desktop terminal QR code or clear credentials
          </Text>

          <View style={styles.pairingButtonsGroup}>
            {/* Re-Pair Desktop */}
            <TouchableOpacity
              onPress={() => router.push('/pair')}
              activeOpacity={0.7}
              style={[
                styles.pairingBtn,
                styles.repairBtn,
                {
                  borderColor: theme.colors.appAccent,
                  backgroundColor: 'transparent',
                },
              ]}
            >
              <IconButton
                icon="qrcode-scan"
                size={16}
                iconColor={theme.colors.appAccent}
                style={styles.zeroMarginIcon}
              />
              <Text style={[styles.repairBtnText, { color: theme.colors.appAccent }]}>
                Re-Pair Desktop
              </Text>
            </TouchableOpacity>

            {/* Unpair Server */}
            <TouchableOpacity
              onPress={() => setUnpairDialogVisible(true)}
              disabled={!isPaired}
              activeOpacity={0.7}
              style={[
                styles.pairingBtn,
                styles.unpairBtn,
                {
                  borderColor: theme.colors.appBorder,
                  backgroundColor: 'transparent',
                  opacity: !isPaired ? 0.4 : 1,
                },
              ]}
            >
              <IconButton
                icon="link-variant-off"
                size={16}
                iconColor={theme.colors.appDanger}
                style={styles.zeroMarginIcon}
              />
              <Text style={[styles.unpairBtnText, { color: theme.colors.appDanger }]}>
                Unpair Server
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 3: Handoff Specifications */}
        <View style={styles.specsBlock}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.colors.appText, marginBottom: 12 },
            ]}
          >
            Handoff Specifications
          </Text>

          <View style={styles.detailsList}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.appMuted }]}>
                Max Long Edge:
              </Text>
              <Text style={[styles.detailValueMono, { color: theme.colors.appText }]}>
                {TARGET_LONG_EDGE_PX} px
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.appMuted }]}>
                Max Drop Batch:
              </Text>
              <Text style={[styles.detailValueMono, { color: theme.colors.appText }]}>
                {MAX_FILES} images
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.appMuted }]}>
                Compression:
              </Text>
              <Text style={[styles.detailValue, { color: theme.colors.appText }]}>
                WebP / JPEG (quality {WEBP_QUALITY})
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.colors.appMuted }]}>
                Discovery Beacon Port:
              </Text>
              <Text style={[styles.detailValueMono, { color: theme.colors.appText }]}>
                UDP {BEACON_PORT}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Manual Host Edit Dialog */}
      <Portal>
        <Dialog
          visible={editHostDialogVisible}
          onDismiss={() => setEditHostDialogVisible(false)}
          style={[
            styles.dialogContainer,
            {
              backgroundColor: theme.colors.appCard,
              borderColor: theme.colors.appBorder,
            },
          ]}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: theme.colors.appText }]}>
            Edit Server Host IP
          </Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.dialogBody, { color: theme.colors.appMuted }]}>
              Enter desktop LAN IP address (e.g. 192.168.1.100).
            </Text>
            <TextInput
              placeholder="e.g. 192.168.1.100"
              placeholderTextColor={theme.colors.appDim}
              value={editHostValue}
              onChangeText={setEditHostValue}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              style={[
                styles.dialogInput,
                {
                  color: theme.colors.appText,
                  backgroundColor: theme.colors.appInput,
                  borderColor: editHostError
                    ? theme.colors.appDanger
                    : theme.colors.appBorder,
                },
              ]}
            />
            {editHostError && (
              <Text style={[styles.dialogError, { color: theme.colors.appDanger }]}>
                {editHostError}
              </Text>
            )}
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <TouchableOpacity
              onPress={() => setEditHostDialogVisible(false)}
              style={styles.dialogCancelBtn}
            >
              <Text style={[styles.dialogCancelText, { color: theme.colors.appMuted }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveHost}
              disabled={isSavingHost}
              style={[
                styles.dialogSubmitBtn,
                { backgroundColor: theme.colors.appAccent },
              ]}
            >
              {isSavingHost ? (
                <ActivityIndicator size={14} color="#FFFFFF" />
              ) : (
                <Text style={styles.dialogSubmitText}>Save Host</Text>
              )}
            </TouchableOpacity>
          </Dialog.Actions>
        </Dialog>

        {/* Unpair Confirmation Dialog */}
        <Dialog
          visible={unpairDialogVisible}
          onDismiss={() => setUnpairDialogVisible(false)}
          style={[
            styles.dialogContainer,
            {
              backgroundColor: theme.colors.appCard,
              borderColor: theme.colors.appBorder,
            },
          ]}
        >
          <Dialog.Title style={[styles.dialogTitle, { color: theme.colors.appText }]}>
            Unpair Desktop Server?
          </Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.dialogBody, { color: theme.colors.appMuted }]}>
              This will remove pairing credentials from this phone. You will need to scan the QR code again to reconnect.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <TouchableOpacity
              onPress={() => setUnpairDialogVisible(false)}
              style={styles.dialogCancelBtn}
            >
              <Text style={[styles.dialogCancelText, { color: theme.colors.appMuted }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirmUnpair}
              style={[
                styles.dialogSubmitBtn,
                { backgroundColor: theme.colors.appDanger },
              ]}
            >
              <Text style={styles.dialogSubmitText}>Unpair</Text>
            </TouchableOpacity>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionBlock: {
    borderBottomWidth: 1,
    paddingBottom: 22,
    marginBottom: 22,
  },
  specsBlock: {
    paddingBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  detailsList: {
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
  },
  detailValueMono: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'SF Mono' : 'monospace',
    fontWeight: '600',
    textAlign: 'right',
  },
  breakAllText: {
    maxWidth: 220,
    fontSize: 11,
  },
  hostValueTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 240,
  },
  editIcon: {
    margin: 0,
    marginLeft: 2,
    width: 20,
    height: 20,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
  },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 0, // Sharp square edges
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 6,
  },
  pingBtn: {
    borderWidth: 1,
  },
  pingBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  discoveryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  pairingButtonsGroup: {
    gap: 10,
  },
  pairingBtn: {
    width: '100%',
    height: 44,
    borderRadius: 0, // Sharp corners
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  repairBtn: {
    borderWidth: 1,
  },
  repairBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  unpairBtn: {
    borderWidth: 1,
  },
  unpairBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dialogContainer: {
    margin: 20,
    borderRadius: 0, // Flat corners
    borderWidth: 1,
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  dialogBody: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  dialogInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 12,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'SF Mono' : 'monospace',
  },
  dialogError: {
    fontSize: 11,
    marginTop: 6,
  },
  dialogActions: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  dialogCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dialogCancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dialogSubmitBtn: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogSubmitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  zeroMarginIcon: {
    margin: 0,
  },
});

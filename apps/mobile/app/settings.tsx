import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import {
  Text,
  Button,
  Surface,
  Divider,
  IconButton,
  Snackbar,
  Dialog,
  Portal,
  useTheme,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import {
  BEACON_PORT,
  TARGET_LONG_EDGE_PX,
  MAX_FILES,
  WEBP_QUALITY,
} from '@imgdrop/shared';
import { useAppStore } from '../src/store/useAppStore';
import { ConnectionBadge } from '../src/components/ConnectionBadge';
import type { AppTheme } from '../src/theme/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme<AppTheme>();

  const {
    serverId,
    token,
    host,
    port,
    isPaired,
    connectionStatus,
    pingServer,
    startDiscovery,
    unpair,
  } = useAppStore();

  const [isPinging, setIsPinging] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [unpairDialogVisible, setUnpairDialogVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);

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
    try {
      const found = await startDiscovery();
      if (found) {
        setSnackbarMessage('Desktop server discovered & updated!');
      } else {
        setSnackbarMessage('Discovery finished: No server detected on LAN.');
      }
    } catch {
      setSnackbarMessage('Discovery error occurred.');
    } finally {
      setIsDiscovering(false);
    }
  };

  const confirmUnpair = async () => {
    setUnpairDialogVisible(false);
    await unpair();
    setSnackbarMessage('Server credentials removed.');
    setTimeout(() => {
      router.replace('/');
    }, 400);
  };

  const maskedToken = token
    ? token.length > 10
      ? `${token.slice(0, 4)}...${token.slice(-4)}`
      : '••••••••'
    : 'None';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Connection Diagnostics Card */}
        <Surface style={styles.card} elevation={1}>
          <View style={styles.cardHeader}>
            <View>
              <Text variant="titleMedium" style={styles.cardTitle}>
                Connection & Server
              </Text>
              <Text variant="bodySmall" style={styles.cardSubtitle}>
                Current handoff target and LAN status
              </Text>
            </View>
            <ConnectionBadge status={connectionStatus} isPaired={isPaired} />
          </View>

          <Divider style={styles.divider} />

          <View style={styles.fieldRow}>
            <Text variant="bodySmall" style={styles.fieldLabel}>
              Server Host:
            </Text>
            <Text variant="bodyMedium" style={styles.fieldValue}>
              {host || 'Not set (Discovery required)'}
            </Text>
          </View>

          <View style={styles.fieldRow}>
            <Text variant="bodySmall" style={styles.fieldLabel}>
              Server Port:
            </Text>
            <Text variant="bodyMedium" style={styles.fieldValue}>
              {port}
            </Text>
          </View>

          <View style={styles.fieldRow}>
            <Text variant="bodySmall" style={styles.fieldLabel}>
              Server ID:
            </Text>
            <Text variant="bodyMedium" style={styles.fieldValue} numberOfLines={1}>
              {serverId || 'Unpaired'}
            </Text>
          </View>

          <View style={styles.fieldRow}>
            <Text variant="bodySmall" style={styles.fieldLabel}>
              Auth Token:
            </Text>
            <Text variant="bodyMedium" style={styles.fieldValue}>
              {maskedToken}
            </Text>
          </View>

          <Divider style={styles.divider} />

          {/* Action buttons */}
          <View style={styles.actionButtonContainer}>
            <Button
              mode="contained-tonal"
              icon="swap-horizontal-bold"
              onPress={handlePing}
              loading={isPinging}
              disabled={isPinging || !isPaired || !host}
              style={styles.actionBtn}
            >
              Ping Server
            </Button>

            <Button
              mode="contained-tonal"
              icon="radar"
              onPress={handleDiscovery}
              loading={isDiscovering}
              disabled={isDiscovering || !isPaired}
              style={styles.actionBtn}
            >
              Trigger Re-Discovery
            </Button>
          </View>
        </Surface>

        {/* Pairing Actions Card */}
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Pairing Controls
          </Text>
          <Text variant="bodySmall" style={styles.cardSubtitle}>
            Scan new desktop terminal QR code or clear credentials
          </Text>

          <View style={styles.buttonStack}>
            <Button
              mode="outlined"
              icon="qrcode-scan"
              onPress={() => router.push('/pair')}
              style={styles.stackBtn}
            >
              {isPaired ? 'Re-Pair Desktop' : 'Pair Desktop Server'}
            </Button>

            {isPaired && (
              <Button
                mode="text"
                icon="link-off"
                textColor={theme.colors.error}
                onPress={() => setUnpairDialogVisible(true)}
                style={styles.stackBtn}
              >
                Unpair Server
              </Button>
            )}
          </View>
        </Surface>

        {/* System Specifications Card */}
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleMedium" style={styles.cardTitle}>
            Handoff Specifications
          </Text>

          <View style={styles.fieldRow}>
            <Text variant="bodySmall" style={styles.fieldLabel}>
              Max Long Edge:
            </Text>
            <Text variant="bodyMedium" style={styles.fieldValue}>
              {TARGET_LONG_EDGE_PX} px
            </Text>
          </View>

          <View style={styles.fieldRow}>
            <Text variant="bodySmall" style={styles.fieldLabel}>
              Max Drop Batch:
            </Text>
            <Text variant="bodyMedium" style={styles.fieldValue}>
              {MAX_FILES} images
            </Text>
          </View>

          <View style={styles.fieldRow}>
            <Text variant="bodySmall" style={styles.fieldLabel}>
              Compression:
            </Text>
            <Text variant="bodyMedium" style={styles.fieldValue}>
              WebP / JPEG (quality {WEBP_QUALITY})
            </Text>
          </View>

          <View style={styles.fieldRow}>
            <Text variant="bodySmall" style={styles.fieldLabel}>
              Discovery Beacon Port:
            </Text>
            <Text variant="bodyMedium" style={styles.fieldValue}>
              UDP {BEACON_PORT}
            </Text>
          </View>
        </Surface>
      </ScrollView>

      {/* Unpair Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={unpairDialogVisible}
          onDismiss={() => setUnpairDialogVisible(false)}
        >
          <Dialog.Title>Unpair Desktop Server?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This will remove the saved server ID and authentication token from secure storage. You will need to scan a new QR code to drop images.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setUnpairDialogVisible(false)}>Cancel</Button>
            <Button textColor={theme.colors.error} onPress={confirmUnpair}>
              Unpair
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontWeight: '700',
    color: '#0F172A',
  },
  cardSubtitle: {
    color: '#64748B',
    marginTop: 2,
  },
  divider: {
    marginVertical: 14,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  fieldLabel: {
    color: '#64748B',
    fontWeight: '600',
  },
  fieldValue: {
    color: '#0F172A',
    fontWeight: '600',
  },
  actionButtonContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
  },
  buttonStack: {
    marginTop: 12,
    gap: 10,
  },
  stackBtn: {
    borderRadius: 10,
  },
});

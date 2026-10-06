import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, ActivityIndicator, useTheme } from 'react-native-paper';
import type { ConnectionStatus } from '../store/useAppStore';
import type { AppTheme } from '../theme/theme';

export interface ConnectionBadgeProps {
  status: ConnectionStatus;
  isPaired: boolean;
  onPress?: () => void;
  compact?: boolean;
}

export const ConnectionBadge: React.FC<ConnectionBadgeProps> = ({
  status,
  isPaired,
  onPress,
  compact = false,
}) => {
  const theme = useTheme<AppTheme>();

  let label = 'Offline';
  let iconName = 'wifi-off';
  let chipColor = theme.colors.statusDisconnected || '#94A3B8';
  let textColor = '#FFFFFF';
  let showSpinner = false;

  if (!isPaired) {
    label = 'Not Paired';
    iconName = 'qrcode-scan';
    chipColor = theme.colors.outlineVariant || '#E2E8F0';
    textColor = theme.colors.onSurfaceVariant || '#475569';
  } else if (status === 'connected') {
    label = 'Connected';
    iconName = 'check-circle';
    chipColor = theme.colors.statusConnected || '#10B981';
    textColor = '#FFFFFF';
  } else if (status === 'discovering') {
    label = 'Discovering';
    iconName = 'radar';
    chipColor = theme.colors.statusConnecting || '#3B82F6';
    textColor = '#FFFFFF';
    showSpinner = true;
  } else {
    label = 'Offline';
    iconName = 'wifi-off';
    chipColor = theme.colors.statusError || '#EF4444';
    textColor = '#FFFFFF';
  }

  return (
    <View style={styles.container}>
      <Chip
        mode="flat"
        icon={
          showSpinner
            ? () => <ActivityIndicator size={14} color={textColor} />
            : iconName
        }
        style={[
          styles.chip,
          { backgroundColor: chipColor },
          compact && styles.compactChip,
        ]}
        textStyle={[
          styles.text,
          { color: textColor },
          compact && styles.compactText,
        ]}
        onPress={onPress}
      >
        {label}
      </Chip>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    borderRadius: 16,
    height: 32,
  },
  compactChip: {
    height: 28,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    marginVertical: 0,
    marginRight: 4,
  },
  compactText: {
    fontSize: 11,
    marginRight: 2,
  },
});

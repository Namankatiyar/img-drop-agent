import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { IconButton } from 'react-native-paper';
import type { ConnectionStatus } from '../store/useAppStore';
import { useAppTheme } from '../theme/theme';

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
  const theme = useAppTheme();

  let label = 'Offline';
  let iconName = 'wifi-off';
  let badgeBg = theme.colors.appDanger || '#DC2626';
  let textColor = '#FFFFFF';
  let showSpinner = false;

  if (!isPaired) {
    label = 'Not Paired';
    iconName = 'qrcode-scan';
    badgeBg = theme.dark ? '#27272A' : '#E4E4E7';
    textColor = theme.dark ? '#A1A1AA' : '#71717A';
  } else if (status === 'connected') {
    label = 'Connected';
    iconName = 'check';
    badgeBg = theme.colors.appSuccess || '#16A34A';
    textColor = '#FFFFFF';
  } else if (status === 'discovering') {
    label = 'Discovering';
    iconName = 'radar';
    badgeBg = theme.colors.appAccent || '#2563EB';
    textColor = '#FFFFFF';
    showSpinner = true;
  } else {
    label = 'Offline';
    iconName = 'wifi-off';
    badgeBg = theme.colors.appDanger || '#DC2626';
    textColor = '#FFFFFF';
  }

  const content = (
    <View
      style={[
        styles.badge,
        { backgroundColor: badgeBg },
        compact && styles.compactBadge,
      ]}
    >
      {showSpinner ? (
        <ActivityIndicator size={12} color={textColor} style={styles.iconOffset} />
      ) : (
        <IconButton
          icon={iconName}
          size={13}
          iconColor={textColor}
          style={styles.iconButton}
        />
      )}
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={styles.touchable}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  touchable: {
    borderRadius: 0,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 0, // Sharp flat edges per Stitch Minimal spec
  },
  compactBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  iconButton: {
    margin: 0,
    width: 14,
    height: 14,
    marginRight: 4,
  },
  iconOffset: {
    marginRight: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'capitalize',
  },
});

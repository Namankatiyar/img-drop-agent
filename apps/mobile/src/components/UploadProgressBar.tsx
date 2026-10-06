import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ProgressBar, Text, useTheme } from 'react-native-paper';
import type { AppTheme } from '../theme/theme';

export interface UploadProgressBarProps {
  progress: number; // 0.0 to 1.0
  isUploading: boolean;
  totalImages?: number;
}

export const UploadProgressBar: React.FC<UploadProgressBarProps> = ({
  progress,
  isUploading,
  totalImages = 0,
}) => {
  const theme = useTheme<AppTheme>();

  if (!isUploading && progress <= 0) {
    return null;
  }

  const percentage = Math.min(100, Math.max(0, Math.round(progress * 100)));

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text variant="bodySmall" style={styles.labelText}>
          {percentage >= 100
            ? 'Processing on server...'
            : `Uploading ${totalImages} ${totalImages === 1 ? 'image' : 'images'}...`}
        </Text>
        <Text
          variant="labelMedium"
          style={[styles.percentText, { color: theme.colors.primary }]}
        >
          {percentage}%
        </Text>
      </View>
      <ProgressBar
        progress={progress}
        color={theme.colors.primary}
        style={styles.progressBar}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    paddingHorizontal: 4,
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  labelText: {
    color: '#64748B',
  },
  percentText: {
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
});

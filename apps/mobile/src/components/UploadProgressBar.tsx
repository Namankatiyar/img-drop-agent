import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { ProgressBar } from 'react-native-paper';
import { useAppTheme } from '../theme/theme';

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
  const theme = useAppTheme();

  if (!isUploading) {
    return null;
  }

  const percentage = Math.min(100, Math.max(0, Math.round(progress * 100)));

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text
          style={[
            styles.labelText,
            { color: theme.colors.appMuted },
          ]}
        >
          {percentage >= 100
            ? 'Processing on server...'
            : `Uploading ${totalImages} ${totalImages === 1 ? 'image' : 'images'}...`}
        </Text>
        <Text
          style={[
            styles.percentText,
            { color: theme.colors.appAccent },
          ]}
        >
          {percentage}%
        </Text>
      </View>
      <ProgressBar
        progress={progress}
        color={theme.colors.appAccent}
        style={[
          styles.progressBar,
          {
            backgroundColor: theme.dark ? '#27272A' : '#E4E4E7',
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '500',
  },
  percentText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'SF Mono' : 'monospace',
    fontWeight: '700',
  },
  progressBar: {
    height: 4,
    borderRadius: 0, // Flat square edges per Stitch minimal spec
  },
});

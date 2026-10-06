import React from 'react';
import { StyleSheet, View, Image, TouchableOpacity } from 'react-native';
import { Text, IconButton, Surface, useTheme } from 'react-native-paper';
import type { SelectedImage } from '../store/useAppStore';
import type { AppTheme } from '../theme/theme';

export interface ImageTileProps {
  image: SelectedImage;
  onRemove: (id: string) => void;
  size?: number;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export const ImageTile: React.FC<ImageTileProps> = ({
  image,
  onRemove,
  size = 110,
}) => {
  const theme = useTheme<AppTheme>();

  return (
    <Surface style={[styles.card, { width: size, height: size }]} elevation={1}>
      <Image
        source={{ uri: image.uri }}
        style={styles.thumbnail}
        resizeMode="cover"
      />

      {/* Position Badge (1..20) */}
      <View
        style={[
          styles.badge,
          { backgroundColor: theme.colors.primary },
        ]}
      >
        <Text style={[styles.badgeText, { color: theme.colors.onPrimary }]}>
          {image.position}
        </Text>
      </View>

      {/* Remove Button */}
      <TouchableOpacity
        style={styles.removeTouchable}
        onPress={() => onRemove(image.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={styles.removeBackground}>
          <IconButton
            icon="close"
            size={14}
            iconColor="#FFFFFF"
            style={styles.removeIcon}
          />
        </View>
      </TouchableOpacity>

      {/* File Size / Meta Footer */}
      <View style={styles.footerOverlay}>
        <Text style={styles.metaText} numberOfLines={1}>
          {image.size > 0
            ? formatBytes(image.size)
            : image.width && image.height
            ? `${image.width}x${image.height}`
            : 'Image'}
        </Text>
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    margin: 4,
    backgroundColor: '#E2E8F0',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1.5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  removeTouchable: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 10,
  },
  removeBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeIcon: {
    margin: 0,
    width: 20,
    height: 20,
  },
  footerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  metaText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
});

import React from 'react';
import { StyleSheet, View, Image, TouchableOpacity, Text, Platform } from 'react-native';
import { IconButton } from 'react-native-paper';
import type { SelectedImage } from '../store/useAppStore';
import { useAppTheme } from '../theme/theme';

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
  size = 105,
}) => {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.card,
        {
          width: size,
          height: size,
          borderColor: theme.colors.appBorder,
          backgroundColor: theme.colors.appCard,
        },
      ]}
    >
      <Image
        source={{ uri: image.uri }}
        style={styles.thumbnail}
        resizeMode="cover"
      />

      {/* Position Badge (Square, Flat 0 radius) */}
      <View
        style={[
          styles.badge,
          { backgroundColor: theme.colors.appAccent },
        ]}
      >
        <Text style={styles.badgeText}>
          {image.position}
        </Text>
      </View>

      {/* Remove Button (Square, Flat 0 radius) */}
      <TouchableOpacity
        style={styles.removeTouchable}
        onPress={() => onRemove(image.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
      >
        <View style={styles.removeBackground}>
          <IconButton
            icon="close"
            size={12}
            iconColor="#FFFFFF"
            style={styles.removeIcon}
          />
        </View>
      </TouchableOpacity>

      {/* File Size / Meta Footer (Monospace, Sharp) */}
      <View style={styles.footerOverlay}>
        <Text style={styles.metaText} numberOfLines={1}>
          {image.size > 0
            ? formatBytes(image.size)
            : image.width && image.height
            ? `${image.width}x${image.height}`
            : 'Image'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 0, // Sharp flat edges
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    margin: 4,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 0,
    left: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  removeTouchable: {
    position: 'absolute',
    top: 2,
    right: 2,
    zIndex: 10,
  },
  removeBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 0,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeIcon: {
    margin: 0,
    width: 16,
    height: 16,
  },
  footerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(9, 9, 11, 0.75)',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  metaText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontFamily: Platform.OS === 'ios' ? 'SF Mono' : 'monospace',
    fontWeight: '500',
    textAlign: 'center',
  },
});

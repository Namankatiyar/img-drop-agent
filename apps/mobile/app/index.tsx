import React from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import {
  Appbar,
  Button,
  Card,
  TextInput,
  Text,
  Banner,
  Modal,
  Portal,
  IconButton,
  Surface,
  useTheme,
  Divider,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MAX_FILES, MAX_NOTE_LENGTH } from '@imgdrop/shared';
import { useAppStore } from '../src/store/useAppStore';
import { ConnectionBadge } from '../src/components/ConnectionBadge';
import { ImageTile } from '../src/components/ImageTile';
import { UploadProgressBar } from '../src/components/UploadProgressBar';
import type { AppTheme } from '../src/theme/theme';

export default function MainUploadScreen() {
  const router = useRouter();
  const theme = useTheme<AppTheme>();

  const {
    isPaired,
    connectionStatus,
    host,
    port,
    selectedImages,
    note,
    isUploading,
    uploadProgress,
    lastError,
    lastCreatedGroup,
    pickImages,
    captureImage,
    removeImage,
    clearSelectedImages,
    setNote,
    submitGroup,
    retrySubmit,
    clearLastError,
    clearLastCreatedGroup,
  } = useAppStore();

  const handleBadgePress = () => {
    if (!isPaired) {
      router.push('/pair');
    } else {
      router.push('/settings');
    }
  };

  const remainingSlots = MAX_FILES - selectedImages.length;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {/* Material 3 Appbar */}
      <Appbar.Header style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.Content
          title="ImgDrop"
          titleStyle={{ fontWeight: '700', fontSize: 20 }}
        />
        <ConnectionBadge
          status={connectionStatus}
          isPaired={isPaired}
          onPress={handleBadgePress}
        />
        <Appbar.Action
          icon="cog-outline"
          onPress={() => router.push('/settings')}
        />
      </Appbar.Header>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Unpaired Notice Banner */}
        {!isPaired && (
          <Surface style={[styles.noticeCard, { backgroundColor: theme.colors.primaryContainer }]} elevation={0}>
            <View style={styles.noticeRow}>
              <IconButton icon="qrcode-scan" size={24} iconColor={theme.colors.primary} />
              <View style={styles.noticeTextContainer}>
                <Text variant="titleSmall" style={{ color: theme.colors.onPrimaryContainer, fontWeight: '700' }}>
                  Desktop Not Paired
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onPrimaryContainer }}>
                  Scan the QR code in your desktop terminal to start dropping images.
                </Text>
              </View>
            </View>
            <Button
              mode="contained"
              icon="camera"
              onPress={() => router.push('/pair')}
              style={styles.noticeButton}
            >
              Pair with Desktop
            </Button>
          </Surface>
        )}

        {/* Error Banner with Retry */}
        {lastError && (
          <Banner
            visible={!!lastError}
            icon="alert-circle"
            actions={[
              {
                label: 'Dismiss',
                onPress: clearLastError,
              },
              {
                label: 'Retry Upload',
                onPress: retrySubmit,
              },
            ]}
            style={[styles.errorBanner, { backgroundColor: theme.colors.errorContainer }]}
          >
            <Text style={{ color: theme.colors.onErrorContainer, fontWeight: '500' }}>
              {lastError}
            </Text>
          </Banner>
        )}

        {/* Selected Images Section */}
        <Surface style={styles.sectionCard} elevation={1}>
          <View style={styles.sectionHeader}>
            <View>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Selected Photos
              </Text>
              <Text variant="bodySmall" style={styles.sectionSubtitle}>
                {selectedImages.length} of {MAX_FILES} maximum
              </Text>
            </View>
            {selectedImages.length > 0 && (
              <Button
                mode="text"
                compact
                textColor={theme.colors.error}
                onPress={clearSelectedImages}
                disabled={isUploading}
              >
                Clear All
              </Button>
            )}
          </View>

          {/* Image Grid Preview */}
          {selectedImages.length === 0 ? (
            <View style={styles.emptyGallery}>
              <IconButton
                icon="image-multiple-outline"
                size={48}
                iconColor={theme.colors.outline}
              />
              <Text variant="bodyMedium" style={styles.emptyText}>
                No photos selected yet
              </Text>
              <Text variant="bodySmall" style={styles.emptySubtext}>
                Take photos with camera or select from your gallery.
              </Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {selectedImages.map((img) => (
                <ImageTile
                  key={img.id}
                  image={img}
                  onRemove={() => removeImage(img.id)}
                />
              ))}
            </View>
          )}

          {/* Action Buttons: Camera & Gallery */}
          <View style={styles.actionRow}>
            <Button
              mode="outlined"
              icon="camera"
              onPress={captureImage}
              disabled={isUploading || remainingSlots <= 0}
              style={styles.actionButton}
            >
              Take Photo
            </Button>
            <Button
              mode="contained-tonal"
              icon="image-plus"
              onPress={pickImages}
              disabled={isUploading || remainingSlots <= 0}
              style={styles.actionButton}
            >
              Gallery ({remainingSlots} left)
            </Button>
          </View>
        </Surface>

        {/* Note Card */}
        <Surface style={styles.sectionCard} elevation={1}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Drop Note (Optional)
          </Text>
          <TextInput
            mode="outlined"
            placeholder="Add context or instructions for your desktop..."
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            maxLength={MAX_NOTE_LENGTH}
            disabled={isUploading}
            style={styles.noteInput}
          />
          <View style={styles.counterRow}>
            <Text
              variant="labelSmall"
              style={[
                styles.counterText,
                note.length >= MAX_NOTE_LENGTH && { color: theme.colors.error },
              ]}
            >
              {note.length} / {MAX_NOTE_LENGTH}
            </Text>
          </View>
        </Surface>

        {/* Upload Progress Bar */}
        <UploadProgressBar
          progress={uploadProgress}
          isUploading={isUploading}
          totalImages={selectedImages.length}
        />

        {/* Submit Upload Button */}
        <Button
          mode="contained"
          icon="cloud-upload"
          onPress={submitGroup}
          loading={isUploading}
          disabled={isUploading || selectedImages.length === 0 || !isPaired}
          contentStyle={styles.uploadButtonContent}
          style={styles.uploadButton}
        >
          {isUploading
            ? 'Sending Images...'
            : `Drop ${selectedImages.length} ${selectedImages.length === 1 ? 'Photo' : 'Photos'} to Desktop`}
        </Button>
      </ScrollView>

      {/* Success Modal */}
      <Portal>
        <Modal
          visible={!!lastCreatedGroup}
          onDismiss={clearLastCreatedGroup}
          contentContainerStyle={[
            styles.modalContainer,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <View style={styles.modalContent}>
            <View
              style={[
                styles.successIconCircle,
                { backgroundColor: theme.colors.successContainer },
              ]}
            >
              <IconButton
                icon="check-circle"
                size={40}
                iconColor={theme.colors.success}
              />
            </View>

            <Text variant="headlineSmall" style={styles.modalTitle}>
              Drop Complete!
            </Text>
            <Text variant="bodyMedium" style={styles.modalSubtitle}>
              Images successfully delivered to desktop handoff folder.
            </Text>

            <Divider style={styles.modalDivider} />

            <View style={styles.metaRow}>
              <Text variant="bodySmall" style={styles.metaLabel}>Group ID:</Text>
              <Text variant="bodySmall" style={styles.metaValue} numberOfLines={1}>
                {lastCreatedGroup?.id}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Text variant="bodySmall" style={styles.metaLabel}>Images:</Text>
              <Text variant="bodySmall" style={styles.metaValue}>
                {lastCreatedGroup?.image_count ?? selectedImages.length} files
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Text variant="bodySmall" style={styles.metaLabel}>Time:</Text>
              <Text variant="bodySmall" style={styles.metaValue}>
                {lastCreatedGroup?.created_at
                  ? new Date(lastCreatedGroup.created_at).toLocaleTimeString()
                  : new Date().toLocaleTimeString()}
              </Text>
            </View>

            <Button
              mode="contained"
              onPress={clearLastCreatedGroup}
              style={styles.modalButton}
            >
              Done
            </Button>
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  noticeCard: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  noticeTextContainer: {
    flex: 1,
    marginLeft: 4,
  },
  noticeButton: {
    marginTop: 4,
    borderRadius: 8,
  },
  errorBanner: {
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionSubtitle: {
    color: '#64748B',
  },
  emptyGallery: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  emptyText: {
    color: '#475569',
    fontWeight: '600',
    marginTop: 4,
  },
  emptySubtext: {
    color: '#94A3B8',
    marginTop: 2,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
  },
  noteInput: {
    backgroundColor: 'transparent',
    marginTop: 8,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  counterText: {
    color: '#94A3B8',
  },
  uploadButton: {
    marginTop: 12,
    borderRadius: 12,
  },
  uploadButtonContent: {
    paddingVertical: 8,
  },
  modalContainer: {
    margin: 20,
    borderRadius: 20,
    padding: 24,
  },
  modalContent: {
    alignItems: 'center',
  },
  successIconCircle: {
    borderRadius: 36,
    marginBottom: 12,
  },
  modalTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSubtitle: {
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalDivider: {
    width: '100%',
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 8,
  },
  metaLabel: {
    color: '#64748B',
    fontWeight: '600',
  },
  metaValue: {
    color: '#0F172A',
    fontWeight: '600',
    maxWidth: '70%',
  },
  modalButton: {
    marginTop: 16,
    width: '100%',
    borderRadius: 10,
  },
});

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
import { IconButton, Portal, Modal, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MAX_FILES, MAX_NOTE_LENGTH } from '@imgdrop/shared';
import { useAppStore } from '../src/store/useAppStore';
import { ConnectionBadge } from '../src/components/ConnectionBadge';
import { ImageTile } from '../src/components/ImageTile';
import { UploadProgressBar } from '../src/components/UploadProgressBar';
import { useAppTheme } from '../src/theme/theme';

export default function MainUploadScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [noteFocused, setNoteFocused] = useState(false);

  const {
    isPaired,
    connectionStatus,
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
  const isSubmitDisabled = isUploading || selectedImages.length === 0 || !isPaired;

  const insets = useSafeAreaInsets();
  const topPadding = insets.top > 0
    ? insets.top + 8
    : Platform.OS === 'android'
    ? (RNStatusBar.currentHeight || 24) + 8
    : 12;
  const bottomPadding = insets.bottom > 0 ? insets.bottom + 8 : 14;

  return (
    <View style={[styles.safeArea, { backgroundColor: theme.colors.appBg }]}>
      {/* Top App Bar per Stitch Minimal Spec with safe area padding */}
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
        <Text style={[styles.brandTitle, { color: theme.colors.appText }]}>
          ImgDrop
        </Text>
        <View style={styles.topRightControls}>
          <ConnectionBadge
            status={connectionStatus}
            isPaired={isPaired}
            onPress={handleBadgePress}
          />
          <TouchableOpacity
            onPress={() => router.push('/settings')}
            style={styles.settingsTouchable}
            accessibilityLabel="Settings"
            activeOpacity={0.7}
          >
            <IconButton
              icon="cog-outline"
              size={22}
              iconColor={theme.colors.appMuted}
              style={styles.settingsIcon}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Unpaired Notice Card */}
        {!isPaired && (
          <View
            style={[
              styles.unpairedCard,
              {
                borderColor: theme.colors.appBorder,
                backgroundColor: theme.colors.appCard,
              },
            ]}
          >
            <View style={styles.unpairedHeader}>
              <IconButton
                icon="qrcode-scan"
                size={22}
                iconColor={theme.colors.appAccent}
                style={styles.zeroMarginIcon}
              />
              <View style={styles.unpairedTextGroup}>
                <Text style={[styles.unpairedTitle, { color: theme.colors.appText }]}>
                  Desktop Not Paired
                </Text>
                <Text style={[styles.unpairedSubtitle, { color: theme.colors.appMuted }]}>
                  Scan the QR code in your desktop terminal to start dropping images.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/pair')}
              activeOpacity={0.8}
              style={[
                styles.unpairedButton,
                { backgroundColor: theme.colors.appAccent },
              ]}
            >
              <IconButton
                icon="camera"
                size={16}
                iconColor="#FFFFFF"
                style={styles.zeroMarginIcon}
              />
              <Text style={styles.unpairedButtonText}>Pair with Desktop</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Error Banner with Retry */}
        {lastError && (
          <View
            style={[
              styles.errorBanner,
              {
                borderColor: theme.colors.appDanger,
                backgroundColor: theme.dark ? '#2A1215' : '#FEE2E2',
              },
            ]}
          >
            <View style={styles.errorTextRow}>
              <IconButton
                icon="alert-circle-outline"
                size={18}
                iconColor={theme.colors.appDanger}
                style={styles.zeroMarginIcon}
              />
              <Text
                style={[styles.errorText, { color: theme.colors.appDanger }]}
                numberOfLines={3}
              >
                {lastError}
              </Text>
            </View>
            <View style={styles.errorActionsRow}>
              <TouchableOpacity
                onPress={clearLastError}
                style={styles.errorActionBtn}
              >
                <Text style={[styles.errorActionText, { color: theme.colors.appMuted }]}>
                  Dismiss
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={retrySubmit}
                style={[
                  styles.errorActionBtn,
                  styles.retryBtn,
                  { borderColor: theme.colors.appDanger },
                ]}
              >
                <Text style={[styles.errorActionText, { color: theme.colors.appDanger, fontWeight: '700' }]}>
                  Retry Upload
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Selected Photos Card */}
        <View
          style={[
            styles.sectionCard,
            {
              borderColor: theme.colors.appBorder,
              backgroundColor: theme.colors.appCard,
            },
          ]}
        >
          {/* Section Header */}
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.colors.appText }]}>
                Selected Photos
              </Text>
              <Text style={[styles.sectionSubtitle, { color: theme.colors.appMuted }]}>
                {selectedImages.length} of {MAX_FILES} maximum
              </Text>
            </View>
            {selectedImages.length > 0 && (
              <TouchableOpacity
                onPress={clearSelectedImages}
                disabled={isUploading}
                style={styles.clearAllTouchable}
              >
                <Text style={[styles.clearAllText, { color: theme.colors.appDanger }]}>
                  Clear All
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Empty Dropzone OR Photo Grid */}
          {selectedImages.length === 0 ? (
            <View
              style={[
                styles.emptyDropzone,
                {
                  borderColor: theme.colors.appBorder,
                  backgroundColor: theme.colors.appBg,
                },
              ]}
            >
              <IconButton
                icon="image-outline"
                size={42}
                iconColor={theme.colors.appDim}
                style={styles.zeroMarginIcon}
              />
              <Text style={[styles.emptyTitle, { color: theme.colors.appText }]}>
                No photos selected yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.appMuted }]}>
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

          {/* 2-Column Action Buttons Row */}
          <View style={styles.actionButtonsRow}>
            {/* Take Photo Button (Outlined hairline) */}
            <TouchableOpacity
              onPress={captureImage}
              disabled={isUploading || remainingSlots <= 0}
              activeOpacity={0.7}
              style={[
                styles.actionBtn,
                styles.takePhotoBtn,
                {
                  borderColor: theme.colors.appBorder,
                  backgroundColor: theme.dark ? '#18181B' : '#FFFFFF',
                  opacity: isUploading || remainingSlots <= 0 ? 0.5 : 1,
                },
              ]}
            >
              <IconButton
                icon="camera-outline"
                size={18}
                iconColor={theme.colors.appAccent}
                style={styles.btnIcon}
              />
              <Text style={[styles.takePhotoText, { color: theme.colors.appText }]}>
                Take Photo
              </Text>
            </TouchableOpacity>

            {/* Gallery Button (Solid accent) */}
            <TouchableOpacity
              onPress={pickImages}
              disabled={isUploading || remainingSlots <= 0}
              activeOpacity={0.8}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: theme.colors.appAccent,
                  opacity: isUploading || remainingSlots <= 0 ? 0.5 : 1,
                },
              ]}
            >
              <IconButton
                icon="image-multiple-outline"
                size={18}
                iconColor="#FFFFFF"
                style={styles.btnIcon}
              />
              <Text style={styles.galleryText}>
                Gallery ({remainingSlots} left)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Drop Note Card */}
        <View
          style={[
            styles.sectionCard,
            {
              borderColor: theme.colors.appBorder,
              backgroundColor: theme.colors.appCard,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.appText }]}>
            Drop Note (Optional)
          </Text>
          <View
            style={[
              styles.noteInputContainer,
              {
                borderColor: noteFocused
                  ? theme.colors.appAccent
                  : theme.colors.appBorder,
                backgroundColor: theme.colors.appInput,
              },
            ]}
          >
            <TextInput
              placeholder="Add context or instructions for your desktop..."
              placeholderTextColor={theme.colors.appDim}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
              maxLength={MAX_NOTE_LENGTH}
              editable={!isUploading}
              onFocus={() => setNoteFocused(true)}
              onBlur={() => setNoteFocused(false)}
              style={[styles.noteTextInput, { color: theme.colors.appText }]}
              textAlignVertical="top"
            />
          </View>
          <View style={styles.charCounterContainer}>
            <Text
              style={[
                styles.charCounterText,
                {
                  color:
                    note.length >= MAX_NOTE_LENGTH
                      ? theme.colors.appDanger
                      : theme.colors.appMuted,
                },
              ]}
            >
              {note.length} / {MAX_NOTE_LENGTH}
            </Text>
          </View>
        </View>

        {/* Upload Progress Bar */}
        <UploadProgressBar
          progress={uploadProgress}
          isUploading={isUploading}
          totalImages={selectedImages.length}
        />
      </ScrollView>

      {/* Bottom Action CTA Fixed at Bottom */}
      <View
        style={[
          styles.bottomActionContainer,
          {
            paddingBottom: bottomPadding,
            backgroundColor: theme.colors.appBg,
            borderTopColor: theme.colors.appBorder,
          },
        ]}
      >
        <TouchableOpacity
          onPress={submitGroup}
          disabled={isSubmitDisabled}
          activeOpacity={0.8}
          style={[
            styles.submitCtaButton,
            isSubmitDisabled
              ? {
                  backgroundColor: theme.dark ? '#27272A80' : '#E4E4E7',
                  borderColor: theme.colors.appBorder,
                }
              : {
                  backgroundColor: theme.colors.appAccent,
                  borderColor: theme.colors.appAccent,
                },
          ]}
        >
          {isUploading ? (
            <>
              <ActivityIndicator size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.submitCtaTextActive}>Sending Images...</Text>
            </>
          ) : (
            <>
              <IconButton
                icon="cloud-upload-outline"
                size={20}
                iconColor={isSubmitDisabled ? theme.colors.appMuted : '#FFFFFF'}
                style={styles.zeroMarginIcon}
              />
              <Text
                style={[
                  styles.submitCtaText,
                  {
                    color: isSubmitDisabled
                      ? theme.colors.appMuted
                      : '#FFFFFF',
                  },
                ]}
              >
                Drop {selectedImages.length} {selectedImages.length === 1 ? 'Photo' : 'Photos'} to Desktop
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Success Modal (Sharp flat edges per Stitch Minimal Spec) */}
      <Portal>
        <Modal
          visible={!!lastCreatedGroup}
          onDismiss={clearLastCreatedGroup}
          contentContainerStyle={[
            styles.modalContainer,
            {
              backgroundColor: theme.colors.appCard,
              borderColor: theme.colors.appBorder,
            },
          ]}
        >
          <View style={styles.modalContent}>
            <View
              style={[
                styles.successIconBadge,
                { backgroundColor: theme.colors.appSuccess },
              ]}
            >
              <IconButton
                icon="check"
                size={28}
                iconColor="#FFFFFF"
                style={styles.zeroMarginIcon}
              />
            </View>

            <Text style={[styles.modalTitle, { color: theme.colors.appText }]}>
              Drop Complete!
            </Text>
            <Text style={[styles.modalSubtitle, { color: theme.colors.appMuted }]}>
              Images successfully delivered to desktop handoff folder.
            </Text>

            <Divider
              style={[
                styles.modalDivider,
                { backgroundColor: theme.colors.appBorder },
              ]}
            />

            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: theme.colors.appMuted }]}>
                Group ID:
              </Text>
              <Text
                style={[styles.metaValue, { color: theme.colors.appText }]}
                numberOfLines={1}
              >
                {lastCreatedGroup?.id}
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: theme.colors.appMuted }]}>
                Images:
              </Text>
              <Text style={[styles.metaValue, { color: theme.colors.appText }]}>
                {lastCreatedGroup?.image_count ?? selectedImages.length} files
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={[styles.metaLabel, { color: theme.colors.appMuted }]}>
                Time:
              </Text>
              <Text style={[styles.metaValue, { color: theme.colors.appText }]}>
                {lastCreatedGroup?.created_at
                  ? new Date(lastCreatedGroup.created_at).toLocaleTimeString()
                  : new Date().toLocaleTimeString()}
              </Text>
            </View>

            <TouchableOpacity
              onPress={clearLastCreatedGroup}
              activeOpacity={0.8}
              style={[
                styles.modalDoneButton,
                { backgroundColor: theme.colors.appAccent },
              ]}
            >
              <Text style={styles.modalDoneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </Portal>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  topRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsTouchable: {
    padding: 2,
  },
  settingsIcon: {
    margin: 0,
    width: 28,
    height: 28,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  unpairedCard: {
    borderWidth: 1,
    padding: 14,
    borderRadius: 0,
    marginBottom: 16,
  },
  unpairedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  unpairedTextGroup: {
    flex: 1,
    marginLeft: 8,
  },
  unpairedTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  unpairedSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  unpairedButton: {
    height: 40,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unpairedButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  errorBanner: {
    borderWidth: 1,
    padding: 12,
    borderRadius: 0,
    marginBottom: 16,
  },
  errorTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    marginLeft: 6,
  },
  errorActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  errorActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  retryBtn: {
    borderWidth: 1,
    borderRadius: 0,
  },
  errorActionText: {
    fontSize: 11,
  },
  sectionCard: {
    borderWidth: 1,
    padding: 16,
    borderRadius: 0, // Sharp square edges
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  clearAllTouchable: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyDropzone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    paddingVertical: 36,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0, // Sharp corners
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 220,
    lineHeight: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 12,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 0, // Sharp corners
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  takePhotoBtn: {
    borderWidth: 1,
  },
  takePhotoText: {
    fontSize: 12,
    fontWeight: '600',
  },
  galleryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  btnIcon: {
    margin: 0,
    marginRight: 4,
    width: 20,
    height: 20,
  },
  noteInputContainer: {
    borderWidth: 1,
    borderRadius: 0, // Flat square edges
    padding: 10,
    marginTop: 10,
  },
  noteTextInput: {
    fontSize: 13,
    minHeight: 64,
    padding: 0,
  },
  charCounterContainer: {
    alignItems: 'flex-end',
    marginTop: 6,
  },
  charCounterText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'SF Mono' : 'monospace',
  },
  bottomActionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  submitCtaButton: {
    height: 48,
    borderRadius: 0, // Sharp square edges per Stitch minimal spec
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  submitCtaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitCtaTextActive: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  modalContainer: {
    margin: 20,
    padding: 20,
    borderRadius: 0, // Sharp square edges
    borderWidth: 1,
  },
  modalContent: {
    alignItems: 'center',
  },
  successIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 0, // Square badge
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  modalDivider: {
    width: '100%',
    height: 1,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 4,
  },
  metaLabel: {
    fontSize: 12,
  },
  metaValue: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'SF Mono' : 'monospace',
    fontWeight: '600',
  },
  modalDoneButton: {
    width: '100%',
    height: 44,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  modalDoneButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  zeroMarginIcon: {
    margin: 0,
  },
});

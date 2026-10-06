import {
  MD3LightTheme,
  MD3DarkTheme,
  useTheme,
  type MD3Theme,
} from 'react-native-paper';

/**
 * Custom color tokens specific to the ImgDrop application
 */
export interface ImgDropCustomColors {
  /** Success states (e.g. transfer complete, beacon verified) */
  success: string;
  onSuccess: string;
  successContainer: string;
  onSuccessContainer: string;

  /** Warning states (e.g. storage nearly full, large file warning) */
  warning: string;
  onWarning: string;
  warningContainer: string;
  onWarningContainer: string;

  /** Info states */
  info: string;
  onInfo: string;
  infoContainer: string;
  onInfoContainer: string;

  /** LAN Hotspot & Discovery connection status colors */
  statusConnected: string;
  statusConnecting: string;
  statusDisconnected: string;
  statusError: string;

  /** UDP beacon signal indicators */
  beaconActive: string;

  /** Card and divider border color */
  cardBorder: string;
}

/**
 * Full extended theme type combining MD3Theme colors with ImgDrop custom tokens
 */
export type AppTheme = MD3Theme & {
  colors: MD3Theme['colors'] & ImgDropCustomColors;
};

/**
 * Material Design 3 Light Theme with ImgDrop Brand Colors
 */
export const lightTheme: AppTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2563EB',
    onPrimary: '#FFFFFF',
    primaryContainer: '#DBEAFE',
    onPrimaryContainer: '#1E3A8A',

    secondary: '#0D9488',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#CCFBF1',
    onSecondaryContainer: '#115E59',

    tertiary: '#7C3AED',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#EDE9FE',
    onTertiaryContainer: '#4C1D95',

    background: '#F8FAFC',
    onBackground: '#0F172A',
    surface: '#FFFFFF',
    onSurface: '#0F172A',
    surfaceVariant: '#F1F5F9',
    onSurfaceVariant: '#475569',

    outline: '#CBD5E1',
    outlineVariant: '#E2E8F0',

    error: '#EF4444',
    onError: '#FFFFFF',
    errorContainer: '#FEE2E2',
    onErrorContainer: '#991B1B',

    // ImgDrop custom extensions
    success: '#10B981',
    onSuccess: '#FFFFFF',
    successContainer: '#D1FAE5',
    onSuccessContainer: '#065F46',

    warning: '#F59E0B',
    onWarning: '#FFFFFF',
    warningContainer: '#FEF3C7',
    onWarningContainer: '#92400E',

    info: '#3B82F6',
    onInfo: '#FFFFFF',
    infoContainer: '#DBEAFE',
    onInfoContainer: '#1E40AF',

    statusConnected: '#10B981',
    statusConnecting: '#3B82F6',
    statusDisconnected: '#94A3B8',
    statusError: '#EF4444',

    beaconActive: '#06B6D4',
    cardBorder: '#E2E8F0',
  },
};

/**
 * Material Design 3 Dark Theme with ImgDrop Brand Colors
 */
export const darkTheme: AppTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#60A5FA',
    onPrimary: '#1E3A8A',
    primaryContainer: '#1E40AF',
    onPrimaryContainer: '#DBEAFE',

    secondary: '#2DD4BF',
    onSecondary: '#134E4A',
    secondaryContainer: '#115E59',
    onSecondaryContainer: '#CCFBF1',

    tertiary: '#A78BFA',
    onTertiary: '#4C1D95',
    tertiaryContainer: '#5B21B6',
    onTertiaryContainer: '#EDE9FE',

    background: '#0B0F19',
    onBackground: '#F8FAFC',
    surface: '#151E2E',
    onSurface: '#F8FAFC',
    surfaceVariant: '#1E293B',
    onSurfaceVariant: '#CBD5E1',

    outline: '#334155',
    outlineVariant: '#1E293B',

    error: '#F87171',
    onError: '#450A0A',
    errorContainer: '#7F1D1D',
    onErrorContainer: '#FEE2E2',

    // ImgDrop custom extensions
    success: '#34D399',
    onSuccess: '#064E3B',
    successContainer: '#065F46',
    onSuccessContainer: '#D1FAE5',

    warning: '#FBBF24',
    onWarning: '#78350F',
    warningContainer: '#92400E',
    onWarningContainer: '#FEF3C7',

    info: '#60A5FA',
    onInfo: '#1E3A8A',
    infoContainer: '#1E40AF',
    onInfoContainer: '#DBEAFE',

    statusConnected: '#34D399',
    statusConnecting: '#60A5FA',
    statusDisconnected: '#64748B',
    statusError: '#F87171',

    beaconActive: '#22D3EE',
    cardBorder: '#1E293B',
  },
};

/**
 * Type-safe hook for accessing ImgDrop theme colors and attributes
 */
export const useAppTheme = () => useTheme<AppTheme>();

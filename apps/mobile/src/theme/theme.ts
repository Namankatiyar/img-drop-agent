import {
  MD3LightTheme,
  MD3DarkTheme,
  useTheme,
  type MD3Theme,
} from 'react-native-paper';

/**
 * Custom color tokens specific to the ImgDrop application and Stitch minimal design system
 */
export interface ImgDropCustomColors {
  /** Success states */
  success: string;
  onSuccess: string;
  successContainer: string;
  onSuccessContainer: string;

  /** Warning states */
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

  // Stitch Minimal Tokens
  appBg: string;
  appCard: string;
  appBorder: string;
  appInput: string;
  appText: string;
  appMuted: string;
  appDim: string;
  appAccent: string;
  appAccentHover: string;
  appDanger: string;
  appSuccess: string;
}

/**
 * Full extended theme type combining MD3Theme colors with ImgDrop custom tokens
 */
export type AppTheme = MD3Theme & {
  colors: MD3Theme['colors'] & ImgDropCustomColors;
};

/**
 * Material Design 3 Light Theme aligned with Stitch Minimal Interface Redesign
 */
export const lightTheme: AppTheme = {
  ...MD3LightTheme,
  roundness: 0,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2563EB',
    onPrimary: '#FFFFFF',
    primaryContainer: '#DBEAFE',
    onPrimaryContainer: '#1E40AF',

    secondary: '#0D9488',
    onSecondary: '#FFFFFF',
    secondaryContainer: '#CCFBF1',
    onSecondaryContainer: '#115E59',

    tertiary: '#7C3AED',
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#EDE9FE',
    onTertiaryContainer: '#4C1D95',

    background: '#F4F4F5',
    onBackground: '#09090B',
    surface: '#FFFFFF',
    onSurface: '#09090B',
    surfaceVariant: '#FAFAFA',
    onSurfaceVariant: '#71717A',

    outline: '#E4E4E7',
    outlineVariant: '#F4F4F5',

    error: '#DC2626',
    onError: '#FFFFFF',
    errorContainer: '#FEE2E2',
    onErrorContainer: '#991B1B',

    // ImgDrop custom extensions
    success: '#16A34A',
    onSuccess: '#FFFFFF',
    successContainer: '#DCFCE7',
    onSuccessContainer: '#14532D',

    warning: '#D97706',
    onWarning: '#FFFFFF',
    warningContainer: '#FEF3C7',
    onWarningContainer: '#78350F',

    info: '#2563EB',
    onInfo: '#FFFFFF',
    infoContainer: '#DBEAFE',
    onInfoContainer: '#1E40AF',

    statusConnected: '#16A34A',
    statusConnecting: '#2563EB',
    statusDisconnected: '#DC2626',
    statusError: '#DC2626',

    beaconActive: '#0284C7',
    cardBorder: '#E4E4E7',

    // Stitch Minimal Tokens
    appBg: '#F4F4F5',
    appCard: '#FFFFFF',
    appBorder: '#E4E4E7',
    appInput: '#FFFFFF',
    appText: '#09090B',
    appMuted: '#71717A',
    appDim: '#A1A1AA',
    appAccent: '#2563EB',
    appAccentHover: '#1D4ED8',
    appDanger: '#DC2626',
    appSuccess: '#16A34A',
  },
};

/**
 * Material Design 3 Dark Theme aligned with Stitch Minimal Interface Redesign
 */
export const darkTheme: AppTheme = {
  ...MD3DarkTheme,
  roundness: 0,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#2563EB',
    onPrimary: '#FFFFFF',
    primaryContainer: '#1E3A8A',
    onPrimaryContainer: '#DBEAFE',

    secondary: '#2DD4BF',
    onSecondary: '#134E4A',
    secondaryContainer: '#115E59',
    onSecondaryContainer: '#CCFBF1',

    tertiary: '#A78BFA',
    onTertiary: '#4C1D95',
    tertiaryContainer: '#5B21B6',
    onTertiaryContainer: '#EDE9FE',

    background: '#09090B',
    onBackground: '#FFFFFF',
    surface: '#18181B',
    onSurface: '#FFFFFF',
    surfaceVariant: '#121215',
    onSurfaceVariant: '#A1A1AA',

    outline: '#27272A',
    outlineVariant: '#18181B',

    error: '#DC2626',
    onError: '#FFFFFF',
    errorContainer: '#450A0A',
    onErrorContainer: '#FEE2E2',

    // ImgDrop custom extensions
    success: '#16A34A',
    onSuccess: '#FFFFFF',
    successContainer: '#052E16',
    onSuccessContainer: '#BBF7D0',

    warning: '#D97706',
    onWarning: '#FFFFFF',
    warningContainer: '#451A03',
    onWarningContainer: '#FEF3C7',

    info: '#2563EB',
    onInfo: '#FFFFFF',
    infoContainer: '#1E3A8A',
    onInfoContainer: '#DBEAFE',

    statusConnected: '#16A34A',
    statusConnecting: '#2563EB',
    statusDisconnected: '#DC2626',
    statusError: '#DC2626',

    beaconActive: '#0284C7',
    cardBorder: '#27272A',

    // Stitch Minimal Tokens
    appBg: '#09090B',
    appCard: '#18181B',
    appBorder: '#27272A',
    appInput: '#121215',
    appText: '#FFFFFF',
    appMuted: '#A1A1AA',
    appDim: '#52525B',
    appAccent: '#2563EB',
    appAccentHover: '#1D4ED8',
    appDanger: '#DC2626',
    appSuccess: '#16A34A',
  },
};

/**
 * Type-safe hook for accessing ImgDrop theme colors and attributes
 */
export const useAppTheme = () => useTheme<AppTheme>();

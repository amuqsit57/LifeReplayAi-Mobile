/**
 * A light palette built for a feed of other people's lives.
 *
 * On white the photographs are the only saturated thing on screen, which is what
 * makes the app feel like a window onto memories rather than a piece of
 * software. The neutrals carry a slight violet bias so the chrome relates to the
 * accent instead of sitting beside it.
 */
export const colors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F4F9',
  surfaceSunk: '#ECEAF3',
  border: '#E5E2ED',
  borderStrong: '#CFC9DD',

  text: '#14101C',
  textSoft: '#4A4358',
  textMuted: '#8B8399',
  textOnAccent: '#FFFFFF',

  // One saturated brand colour, used sparingly: primary actions, the active tab,
  // a liked heart. Everything else is neutral so it keeps its meaning.
  primary: '#6B4EE6',
  primarySoft: '#EFEBFF',
  primaryPress: '#5A3FD0',

  accent: '#F0562D',
  accentSoft: '#FFEDE7',

  success: '#1F9D5B',
  successSoft: '#E4F6EC',
  warning: '#C2820B',
  warningSoft: '#FCF2DC',
  danger: '#DC2F3E',
  dangerSoft: '#FDE9EB',

  mediaPlaceholder: '#E7E4EF',
  scrim: 'rgba(16, 12, 26, 0.55)',
  // Laid over the foot of a poster so white text stays readable on any picture.
  posterScrim: ['rgba(10,7,18,0)', 'rgba(10,7,18,0.72)'],
};

/**
 * Two faces, doing different jobs.
 *
 * Fraunces is a serif with real character in its curves — it carries the titles
 * and gives the app a voice that a default system stack cannot. Manrope sets
 * everything that has to be read rather than looked at. The pairing is the
 * single clearest thing separating this from an interface assembled out of
 * whatever the phone came with.
 */
export const fonts = {
  display: 'Fraunces_700Bold',
  displayItalic: 'Fraunces_600SemiBold_Italic',
  body: 'Manrope_500Medium',
  bodyBold: 'Manrope_700Bold',
  bodyExtra: 'Manrope_800ExtraBold',
};

export const type = {
  display: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.4,
  },
  heading: { fontFamily: fonts.bodyExtra, fontSize: 16, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17 },
  tiny: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.3 },
  // For codes, counts and runtimes — anything where the digits should line up.
  mono: { fontFamily: fonts.bodyExtra, fontSize: 13, letterSpacing: 1 },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const shadow = {
  // Light UI needs shadow to be almost invisible; anything heavier reads as a
  // dark theme with the colours swapped.
  card: {
    shadowColor: '#241B3C',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#241B3C',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
};

/** Each replay style gets an identity so the picker reads at a glance. */
export const STYLE_META = {
  highlights: {
    label: 'Highlights',
    tint: '#C2820B',
    icon: 'zap',
    blurb: 'Short and quick — the best bits only',
  },
  celebration: {
    label: 'Celebration',
    tint: '#F0562D',
    icon: 'gift',
    blurb: 'Upbeat, for a party or a night out',
  },
  cinematic: {
    label: 'Cinematic',
    tint: '#6B4EE6',
    icon: 'film',
    blurb: 'Slow and unhurried, long holds',
  },
  family_story: {
    label: 'Family Story',
    tint: '#1F9D5B',
    icon: 'heart',
    blurb: 'The whole day, nothing left out',
  },
};

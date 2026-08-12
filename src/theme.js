/**
 * A neutral, high-contrast system on white.
 *
 * Earlier passes tinted the greys warm and set the titles in a serif, which read
 * as characterful rather than professional. Both are gone. The greys are a true
 * cool-neutral ramp, the ground is white without a cast, and there is exactly
 * one accent — everything else is neutral, so when colour appears it means
 * something. This is the discipline that makes an interface look considered:
 * restraint, contrast, and spacing, not hue.
 */
export const colors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F3F8',
  surfaceSunk: '#ECEAF3',
  border: '#E4E1EC',
  borderStrong: '#CFC9DD',

  text: '#16121F',
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
  // Over a poster or a hero, so anything white on top of a picture holds.
  posterScrim: ['rgba(12,9,20,0)', 'rgba(12,9,20,0.45)', 'rgba(12,9,20,0.85)'],
  heroScrim: ['rgba(12,9,20,0.15)', 'rgba(12,9,20,0.55)', 'rgba(12,9,20,0.88)'],
};

/**
 * One family, many weights.
 *
 * A single grotesque used across the whole scale reads as more professional than
 * a display serif paired with a body face — the serif gave the app a voice, but
 * the voice was wrong for something people trust with their photographs. Weight
 * and tracking carry the hierarchy instead of a change of typeface.
 */
export const fonts = {
  regular: 'Manrope_500Medium',
  bold: 'Manrope_700Bold',
  black: 'Manrope_800ExtraBold',
};

export const type = {
  // Tight tracking at large sizes is most of what makes a heading look drawn
  // rather than typed.
  display: { fontFamily: fonts.black, fontSize: 28, lineHeight: 34, letterSpacing: -0.9 },
  title: { fontFamily: fonts.black, fontSize: 20, lineHeight: 26, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, letterSpacing: -0.1 },
  caption: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 17 },
  tiny: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14 },
  // Spaced caps, for codes, runtimes and section markers.
  slate: { fontFamily: fonts.black, fontSize: 10.5, lineHeight: 14, letterSpacing: 1.4 },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const shadow = {
  // Light UI needs shadow to be almost invisible; anything heavier reads as a
  // dark theme with the colours swapped.
  card: {
    shadowColor: '#221A38',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#221A38',
    shadowOpacity: 0.13,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};

/**
 * Each film style gets a hue, drawn from one ramp so four of them on a screen
 * look like a set rather than four unrelated brand colours.
 */
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

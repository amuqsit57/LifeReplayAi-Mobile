/**
 * A light palette built for a feed.
 *
 * On a white ground the photographs are the only saturated thing on screen,
 * which is what makes a feed feel like other people's lives rather than like a
 * piece of software. The neutrals carry a slight violet bias rather than being
 * pure grey, so the chrome relates to the accent instead of sitting beside it.
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
 * Two faces, doing different jobs.
 *
 * Fraunces carries headings — a serif with real character in its curves, which
 * is what gives the app a voice a system stack cannot. Manrope sets everything
 * meant to be read rather than looked at.
 *
 * The wordmark deliberately does not use either: it keeps the system face it was
 * drawn in, so the logo stays exactly as it is while the rest of the app gains
 * the typography.
 */
export const fonts = {
  display: 'Fraunces_700Bold',
  body: 'Manrope_500Medium',
  bodyBold: 'Manrope_700Bold',
  bodyExtra: 'Manrope_800ExtraBold',
};

export const type = {
  display: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.bodyExtra, fontSize: 17, lineHeight: 23, letterSpacing: -0.2 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  tiny: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.3 },
  // Spaced caps, for codes and runtimes.
  slate: { fontFamily: fonts.bodyExtra, fontSize: 10.5, lineHeight: 14, letterSpacing: 1.4 },
};

/**
 * The wordmark's own type. System face, weights rather than families — the shape
 * the logo already has.
 */
export const markType = {
  lg: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.6 },
  sm: { fontSize: 17, lineHeight: 23, fontWeight: '700', letterSpacing: -0.4 },
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

/**
 * Ink and ember.
 *
 * The app is almost entirely other people's photographs, and photographs sit
 * better on a dark ground than a bright one — a white interface makes every
 * image look like it is being examined, a dark one makes it look like it is
 * being watched. This is the room lights going down.
 *
 * The dark is warm rather than neutral: browns and umbers rather than blue-grey,
 * because family footage is warm and a cold ground fights it. The accent is an
 * ember, picked from the same family as tungsten light and golden hour, which is
 * what most of this footage is lit by anyway.
 */
export const colors = {
  // Paper rather than screen white: a hair of warmth, so photographs sit on it
  // instead of being cut out against it.
  background: '#FDFCFA',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F1EC',
  surfaceSunk: '#EBE6DF',
  border: '#E8E3DB',
  borderStrong: '#D2C9BC',

  text: '#1A1512',
  textSoft: '#544B44',
  textMuted: '#8C8079',
  textOnAccent: '#FFFFFF',

  // An ember. Warm enough to belong beside family photographs, and nothing like
  // the blue every other app reaches for.
  primary: '#D9542B',
  primarySoft: '#FDEEE8',
  primaryPress: '#BC4620',

  // Brass, the second voice — counts, codes, the quiet marks.
  accent: '#A8791C',
  accentSoft: '#FBF2DF',

  success: '#1E8C57',
  successSoft: '#E3F4EB',
  warning: '#A8791C',
  warningSoft: '#FBF2DF',
  danger: '#C8353F',
  dangerSoft: '#FBE8E9',

  mediaPlaceholder: '#EDE8E1',
  scrim: 'rgba(26, 21, 18, 0.55)',
  // Laid over the foot of a poster so white text stays readable on any picture.
  posterScrim: ['rgba(18,13,10,0)', 'rgba(18,13,10,0.5)', 'rgba(18,13,10,0.88)'],
  heroScrim: ['rgba(18,13,10,0.15)', 'rgba(18,13,10,0.55)', 'rgba(18,13,10,0.85)'],
};

/**
 * Two faces, doing different jobs.
 *
 * Fraunces is a serif with real character in its curves — it carries the titles
 * and gives the app a voice that a default system stack cannot. Manrope sets
 * everything that has to be read rather than looked at.
 */
export const fonts = {
  display: 'Fraunces_700Bold',
  displayItalic: 'Fraunces_600SemiBold_Italic',
  body: 'Manrope_500Medium',
  bodyBold: 'Manrope_700Bold',
  bodyExtra: 'Manrope_800ExtraBold',
};

export const type = {
  display: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
  title: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.bodyExtra, fontSize: 16, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17 },
  tiny: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14, letterSpacing: 0.3 },
  // Set like a slate: spaced caps, for codes, counts and runtimes.
  slate: { fontFamily: fonts.bodyExtra, fontSize: 11, lineHeight: 14, letterSpacing: 1.6 },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

export const shadow = {
  // Warm-tinted rather than grey. A neutral shadow on a warm ground reads as
  // dirt; one carrying the ground's own hue reads as depth.
  card: {
    shadowColor: '#3B2A1E',
    shadowOpacity: 0.09,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#3B2A1E',
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
};

/** Each replay style gets an identity so the picker reads at a glance. */
export const STYLE_META = {
  highlights: {
    label: 'Highlights',
    tint: '#A8791C',
    icon: 'zap',
    blurb: 'Short and quick — the best bits only',
  },
  celebration: {
    label: 'Celebration',
    tint: '#D9542B',
    icon: 'gift',
    blurb: 'Upbeat, for a party or a night out',
  },
  cinematic: {
    label: 'Cinematic',
    tint: '#5B4B8A',
    icon: 'film',
    blurb: 'Slow and unhurried, long holds',
  },
  family_story: {
    label: 'Family Story',
    tint: '#1E7A5A',
    icon: 'heart',
    blurb: 'The whole day, nothing left out',
  },
};

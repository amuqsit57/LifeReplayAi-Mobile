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
  background: '#14110F',
  surface: '#1C1815',
  surfaceAlt: '#241F1B',
  surfaceSunk: '#0E0C0A',
  border: '#2E2823',
  borderStrong: '#463D35',

  text: '#F6F0E8',
  textSoft: '#C4B8AC',
  textMuted: '#8A7D72',
  textOnAccent: '#1A1310',

  // One warm accent, used sparingly. Everything else is neutral so it keeps its
  // meaning when it does appear.
  primary: '#E8663D',
  primarySoft: '#33201A',
  primaryPress: '#CF5631',

  // Brass, for the second voice — counts, codes, the quiet marks of quality.
  accent: '#D6A54A',
  accentSoft: '#2E2416',

  success: '#5FB88A',
  successSoft: '#182A22',
  warning: '#D6A54A',
  warningSoft: '#2E2416',
  danger: '#E5575B',
  dangerSoft: '#331A1C',

  mediaPlaceholder: '#221D19',
  scrim: 'rgba(8, 6, 5, 0.72)',
  // Laid over the foot of a poster so text stays readable on any picture.
  posterScrim: ['rgba(10,8,6,0)', 'rgba(10,8,6,0.55)', 'rgba(10,8,6,0.92)'],
  // Behind a hero, warm rather than grey so a photograph does not go muddy.
  heroScrim: ['rgba(20,17,15,0.25)', 'rgba(20,17,15,0.75)', 'rgba(20,17,15,0.97)'],
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
  // On a dark ground a shadow does almost nothing; separation comes from the
  // surface being lighter than the background, and from a hairline border.
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  raised: {
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 9,
  },
};

/** Each replay style gets an identity so the picker reads at a glance. */
export const STYLE_META = {
  highlights: {
    label: 'Highlights',
    tint: '#E0B341',
    icon: 'zap',
    blurb: 'Short and quick — the best bits only',
  },
  celebration: {
    label: 'Celebration',
    tint: '#F0713F',
    icon: 'gift',
    blurb: 'Upbeat, for a party or a night out',
  },
  cinematic: {
    label: 'Cinematic',
    tint: '#9B8BF4',
    icon: 'film',
    blurb: 'Slow and unhurried, long holds',
  },
  family_story: {
    label: 'Family Story',
    tint: '#63C295',
    icon: 'heart',
    blurb: 'The whole day, nothing left out',
  },
};

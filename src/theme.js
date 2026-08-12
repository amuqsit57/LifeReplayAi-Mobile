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
  surfaceAlt: '#F5F6F8',
  surfaceSunk: '#ECEEF2',
  border: '#E4E7EC',
  borderStrong: '#C6CBD4',

  // Near-black rather than pure, so long text is not harsh, with a trace of blue
  // to sit with the neutral ramp.
  text: '#0C0E14',
  textSoft: '#474D59',
  textMuted: '#858B98',
  textOnAccent: '#FFFFFF',

  // One accent. Indigo carries authority without being the corporate blue every
  // utility app defaults to.
  primary: '#4F46E5',
  primarySoft: '#EEEDFD',
  primaryPress: '#4038C7',

  // Reserved for emphasis inside content — counts, an active heart — never for
  // navigation, so it keeps its weight.
  accent: '#E0453C',
  accentSoft: '#FDECEB',

  success: '#0F8B54',
  successSoft: '#E4F5ED',
  warning: '#B25E09',
  warningSoft: '#FDF1E3',
  danger: '#D02F3A',
  dangerSoft: '#FDEBEC',

  mediaPlaceholder: '#EDEFF3',
  scrim: 'rgba(12, 14, 20, 0.6)',
  // Over the foot of a poster, so white text holds on any picture.
  posterScrim: ['rgba(8,10,14,0)', 'rgba(8,10,14,0.5)', 'rgba(8,10,14,0.9)'],
  heroScrim: ['rgba(8,10,14,0.1)', 'rgba(8,10,14,0.55)', 'rgba(8,10,14,0.88)'],
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
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

export const shadow = {
  // Barely there. On white, separation should come from the hairline border;
  // the shadow only lifts the element off the page a fraction.
  card: {
    shadowColor: '#0C0E14',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#0C0E14',
    shadowOpacity: 0.12,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
};

/**
 * Each film style gets a hue, drawn from one ramp so four of them on a screen
 * look like a set rather than four unrelated brand colours.
 */
export const STYLE_META = {
  highlights: {
    label: 'Highlights',
    tint: '#B25E09',
    icon: 'zap',
    blurb: 'Short and quick — the best bits only',
  },
  celebration: {
    label: 'Celebration',
    tint: '#D02F3A',
    icon: 'gift',
    blurb: 'Upbeat, for a party or a night out',
  },
  cinematic: {
    label: 'Cinematic',
    tint: '#4F46E5',
    icon: 'film',
    blurb: 'Slow and unhurried, long holds',
  },
  family_story: {
    label: 'Family Story',
    tint: '#0F8B54',
    icon: 'heart',
    blurb: 'The whole day, nothing left out',
  },
};

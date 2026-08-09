/**
 * A dark, cinema-leaning palette: the app is mostly photographs and video, and
 * dark surfaces let the media carry the colour instead of competing with it.
 */
export const colors = {
  background: '#131019',
  surface: '#1C1826',
  surfaceAlt: '#262032',
  border: '#332B42',

  text: '#F3EFF8',
  textMuted: '#9C93AD',
  textOnAccent: '#1A1020',

  accent: '#C9A227',
  accentSoft: '#3A2F14',
  primary: '#8B6FE8',
  primarySoft: '#2A2340',

  success: '#4FB477',
  warning: '#D9A441',
  danger: '#E0605E',
};

export const type = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
};

/** Each replay style gets an identity so the picker reads at a glance. */
export const STYLE_META = {
  highlights: { emoji: '⚡', label: 'Highlights', tint: '#D9A441' },
  celebration: { emoji: '🎉', label: 'Celebration', tint: '#E0605E' },
  cinematic: { emoji: '🎬', label: 'Cinematic', tint: '#8B6FE8' },
  family_story: { emoji: '❤️', label: 'Family Story', tint: '#4FB477' },
};

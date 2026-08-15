/**
 * The vocabulary an edit is written in, and the operations on one.
 *
 * Every name here is one the renderer implements. The backend re-checks all of
 * it — an unknown grade quietly becomes `natural` rather than failing the save —
 * so a name that drifts out of sync does not break anything, it just stops
 * working. Which is worse than breaking, so these lists are kept deliberately
 * flat and boring to compare against `app/effects.py`.
 *
 * Labels are written for someone who has never edited before. "Held" rather than
 * "fade_slow", "Straight cut" rather than "cut" — the underlying names are for
 * FFmpeg, not for the person arranging their wedding.
 */

/** Colour grades, each with a swatch so the picker shows the look rather than the word. */
export const GRADES = [
  { value: 'natural', label: 'Natural', swatch: '#B9B4C7', hint: 'As it was shot' },
  { value: 'warm', label: 'Warm', swatch: '#E8B27A', hint: 'Skin looks alive' },
  { value: 'golden', label: 'Golden', swatch: '#E9A23B', hint: 'Late afternoon' },
  { value: 'sunlit', label: 'Sunlit', swatch: '#F5D08A', hint: 'Bright and open' },
  { value: 'cool', label: 'Cool', swatch: '#8FB3D9', hint: 'Blue and calm' },
  { value: 'soft', label: 'Soft', swatch: '#DCC9D6', hint: 'Gentle contrast' },
  { value: 'vivid', label: 'Vivid', swatch: '#E0574F', hint: 'Colour pushed' },
  { value: 'muted', label: 'Muted', swatch: '#A9A29B', hint: 'Colour pulled back' },
  { value: 'vintage', label: 'Vintage', swatch: '#C9A886', hint: 'Older stock' },
  { value: 'faded_film', label: 'Faded film', swatch: '#CBBFAE', hint: 'Washed, lifted blacks' },
  { value: 'moody', label: 'Moody', swatch: '#5B5A73', hint: 'Dark and heavy' },
  { value: 'teal_orange', label: 'Teal & orange', swatch: '#4E8E8C', hint: 'The cinema look' },
  { value: 'dreamy', label: 'Dreamy', swatch: '#D7C4E8', hint: 'Hazy and soft' },
  { value: 'noir', label: 'Noir', swatch: '#3A3A42', hint: 'Hard black and white' },
  { value: 'bw', label: 'Black & white', swatch: '#8E8E96', hint: 'No colour' },
];

/**
 * The grades again, as something the phone can actually draw.
 *
 * React Native 0.81 on the New Architecture supports the `filter` style prop, so
 * these are real colour operations rather than a coloured sheet laid over the
 * picture — grayscale is grayscale, not grey paint at 40%.
 *
 * They approximate what FFmpeg does rather than reproduce it. The renderer uses
 * curves and per-channel levels that no single filter chain matches, so this is
 * close enough to choose by and never exactly what comes out. `null` means leave
 * the picture alone.
 */
export const GRADE_FILTER = {
  natural: null,
  warm: [{ sepia: 0.28 }, { saturate: 1.16 }, { brightness: 1.03 }],
  golden: [{ sepia: 0.42 }, { saturate: 1.22 }, { brightness: 1.06 }],
  sunlit: [{ brightness: 1.12 }, { sepia: 0.18 }, { saturate: 1.1 }],
  cool: [{ 'hue-rotate': '-14deg' }, { saturate: 1.06 }, { brightness: 0.99 }],
  soft: [{ contrast: 0.88 }, { brightness: 1.06 }, { saturate: 0.96 }],
  vivid: [{ saturate: 1.55 }, { contrast: 1.12 }],
  muted: [{ saturate: 0.62 }, { contrast: 0.98 }],
  vintage: [{ sepia: 0.5 }, { saturate: 0.86 }, { contrast: 0.94 }],
  faded_film: [{ saturate: 0.78 }, { contrast: 0.82 }, { brightness: 1.1 }],
  moody: [{ saturate: 0.74 }, { contrast: 1.22 }, { brightness: 0.82 }],
  teal_orange: [{ 'hue-rotate': '-10deg' }, { saturate: 1.3 }, { contrast: 1.1 }],
  dreamy: [{ saturate: 1.12 }, { brightness: 1.1 }, { contrast: 0.9 }],
  noir: [{ grayscale: 1 }, { contrast: 1.45 }, { brightness: 0.92 }],
  bw: [{ grayscale: 1 }],
};

/**
 * Textures, as the preview can draw them.
 *
 * `grain` is a tiled noise plate laid over the picture at low opacity — the same
 * idea as the renderer's, at a size a phone can composite. `bloom` and `halation`
 * are light spreading, which is a brightness and contrast lift plus a warm wash.
 * None of it matches FFmpeg frame for frame; all of it shows the difference
 * between choosing one and choosing none.
 */
export const TEXTURE_PREVIEW = {
  none: null,
  grain: { grain: 0.16 },
  heavy_grain: { grain: 0.3 },
  bloom: { filter: [{ brightness: 1.08 }, { contrast: 0.94 }], wash: 'rgba(255,255,255,0.06)' },
  halation: { filter: [{ brightness: 1.05 }, { saturate: 1.1 }], wash: 'rgba(255,138,80,0.10)' },
};

/** Film grain and light bloom. Sparingly — on every shot it reads as a filter. */
export const TEXTURES = [
  { value: 'none', label: 'Clean', hint: 'No texture' },
  { value: 'grain', label: 'Grain', hint: 'A little film' },
  { value: 'heavy_grain', label: 'Heavy grain', hint: 'Old stock' },
  { value: 'bloom', label: 'Bloom', hint: 'Highlights glow' },
  { value: 'halation', label: 'Halation', hint: 'Light bleeds' },
];

/** How a still moves. Videos are already moving, so this is photographs only. */
export const MOTIONS = [
  { value: 'push_in', label: 'Push in', icon: 'maximize-2' },
  { value: 'push_in_slow', label: 'Slow push', icon: 'maximize-2' },
  { value: 'pull_out', label: 'Pull out', icon: 'minimize-2' },
  { value: 'pan_right', label: 'Pan right', icon: 'arrow-right' },
  { value: 'pan_left', label: 'Pan left', icon: 'arrow-left' },
  { value: 'tilt_down', label: 'Tilt down', icon: 'arrow-down' },
  { value: 'tilt_up', label: 'Tilt up', icon: 'arrow-up' },
  { value: 'static', label: 'Hold still', icon: 'square' },
];

/** Playback speed. Videos only. */
export const SPEEDS = [
  { value: 'normal', label: 'Normal', hint: '1×' },
  { value: 'slight_slow', label: 'Eased', hint: '0.8×' },
  { value: 'slow', label: 'Slow motion', hint: '0.5×' },
  { value: 'quick', label: 'Quick', hint: '1.3×' },
];

/**
 * Transitions, grouped so a list of forty reads as a set of choices.
 *
 * `cut` first and alone because it is the right answer far more often than the
 * rest put together — the grouping exists so the others are findable, not so
 * they get used.
 */
export const TRANSITION_GROUPS = [
  {
    title: 'Straight',
    items: [
      { value: 'cut', label: 'Cut', hint: 'Straight to the next shot' },
    ],
  },
  {
    title: 'Blends',
    items: [
      { value: 'dissolve', label: 'Dissolve', hint: 'The standard soft join' },
      { value: 'fade', label: 'Fade', hint: 'Even blend' },
      { value: 'fade_fast', label: 'Quick fade', hint: 'Barely there' },
      { value: 'fade_slow', label: 'Held fade', hint: 'Lingers' },
      { value: 'blur', label: 'Blur through', hint: 'Softens between' },
      { value: 'distance', label: 'Distance', hint: 'Falls away' },
    ],
  },
  {
    title: 'Through a colour',
    items: [
      { value: 'fade_black', label: 'Through black', hint: 'A chapter break' },
      { value: 'fade_white', label: 'Through white', hint: 'A bright break' },
      { value: 'fade_grays', label: 'Through grey', hint: 'Drains, then returns' },
    ],
  },
  {
    title: 'Slides',
    items: [
      { value: 'slide_left', label: 'Slide left' },
      { value: 'slide_right', label: 'Slide right' },
      { value: 'slide_up', label: 'Slide up' },
      { value: 'slide_down', label: 'Slide down' },
      { value: 'smooth_left', label: 'Smooth left' },
      { value: 'smooth_right', label: 'Smooth right' },
      { value: 'smooth_up', label: 'Smooth up' },
    ],
  },
  {
    title: 'Wipes',
    items: [
      { value: 'wipe_left', label: 'Wipe left' },
      { value: 'wipe_right', label: 'Wipe right' },
      { value: 'wipe_up', label: 'Wipe up' },
      { value: 'wipe_down', label: 'Wipe down' },
      { value: 'wipe_diagonal', label: 'Diagonal wipe' },
      { value: 'cover_left', label: 'Cover left' },
      { value: 'cover_up', label: 'Cover up' },
      { value: 'reveal_left', label: 'Reveal left' },
      { value: 'reveal_up', label: 'Reveal up' },
    ],
  },
  {
    title: 'Shapes',
    items: [
      { value: 'circle_open', label: 'Circle open' },
      { value: 'circle_close', label: 'Circle close' },
      { value: 'circle_crop', label: 'Circle crop' },
      { value: 'rect_crop', label: 'Box crop' },
      { value: 'vert_open', label: 'Open vertically' },
      { value: 'vert_close', label: 'Close vertically' },
      { value: 'horz_open', label: 'Open horizontally' },
      { value: 'radial', label: 'Radial' },
    ],
  },
  {
    title: 'Bold',
    items: [
      { value: 'zoom_in', label: 'Zoom through' },
      { value: 'squeeze_h', label: 'Squeeze across' },
      { value: 'squeeze_v', label: 'Squeeze down' },
      { value: 'pixelize', label: 'Pixelate' },
      { value: 'slice', label: 'Slice' },
      { value: 'wind', label: 'Wind' },
      { value: 'diagonal', label: 'Diagonal' },
    ],
  },
];

export const TRANSITIONS = TRANSITION_GROUPS.flatMap((group) => group.items);

/**
 * Where a title sits in the frame.
 *
 * Bottom on almost every shot; the others exist for the ones where the bottom of
 * the frame is the subject.
 */
/** How the words are set. Five treatments a short film actually uses. */
export const CAPTION_STYLES = [
  { value: 'title', label: 'Title', hint: 'Caps, tracked, on a band' },
  { value: 'plain', label: 'Lower third', hint: 'Small scrim, as written' },
  { value: 'bold', label: 'Bold', hint: 'Large, straight on the picture' },
  { value: 'subtitle', label: 'Subtitle', hint: 'Boxed and low' },
  { value: 'card', label: 'Card', hint: 'Dimmed frame, centred' },
];

export const CAPTION_PLACES = [
  { value: 'top', label: 'Top' },
  { value: 'middle', label: 'Middle' },
  { value: 'bottom', label: 'Bottom' },
];

/**
 * Where a film's music comes from.
 *
 * `ai` is the score written from the occasion — already composed if anything has
 * been rendered, composed on the way if not. `track` is one specific file,
 * whether that came from composing to a brief, from the library, or off the
 * phone. `prompt` still exists server side but the app no longer sets it:
 * composing now and playing the result is strictly better than promising music
 * nobody has heard.
 */
export const MUSIC_MODES = [
  {
    value: 'ai',
    label: 'Already generated',
    icon: 'zap',
    hint: 'Considering the vibe of the event, this music was generated',
    recommended: true,
  },
  {
    value: 'make',
    label: 'Generate from AI',
    icon: 'edit-3',
    hint: 'Describe the music you want and compose it now',
  },
  {
    value: 'track',
    label: 'Custom or from library',
    icon: 'folder',
    hint: 'Anything you have made before, or a file from this phone',
  },
  { value: 'none', label: 'No music', icon: 'volume-x', hint: 'Silent' },
];

/** How much wall time a shot occupies, once its speed is taken into account. */
export function shotMillis(clip) {
  return Math.max(200, (Number(clip?.seconds) || 0) * 1000);
}

export const SPEED_RATE = { normal: 1, slight_slow: 0.8, slow: 0.5, quick: 1.3 };

export const MIN_SECONDS = 0.4;
export const MAX_SECONDS = 15;
// A video shot may run its whole length. Truncating a six minute clip to
// fifteen seconds was deciding for the person who chose to add it.
export const MAX_VIDEO_SECONDS = 900;
export const MAX_CLIPS = 150;

const label = (list, value, fallback) =>
  list.find((item) => item.value === value)?.label ?? fallback;

export const gradeLabel = (v) => label(GRADES, v, 'Natural');
export const transitionLabel = (v) => label(TRANSITIONS, v, 'Dissolve');
export const textureLabel = (v) => label(TEXTURES, v, 'Clean');
export const motionLabel = (v) => label(MOTIONS, v, 'Push in');
export const speedLabel = (v) => label(SPEEDS, v, 'Normal');
export const gradeSwatch = (v) => GRADES.find((g) => g.value === v)?.swatch ?? '#B9B4C7';

/** Total run time as arranged. Transitions overlap, so the finished film is a
 *  little shorter — this is the number to show while editing, not a promise. */
export function planSeconds(plan) {
  return (plan?.clips ?? []).reduce((sum, clip) => sum + (Number(clip.seconds) || 0), 0);
}

export function formatSeconds(seconds) {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** A new shot cut from a memory, with defaults that suit what it is. */
export function clipFor(memory) {
  const isVideo = memory.kind === 'video';
  const available = Number(memory.duration_seconds) || 0;

  return {
    memory_id: memory.id,
    // A video arrives whole and gets trimmed down; a still needs long enough to
    // read. Starting video at four seconds silently threw away everything past
    // that, and nobody expects adding a clip to cut it.
    seconds: isVideo ? Math.max(MIN_SECONDS, Math.min(MAX_VIDEO_SECONDS, available || 4)) : 2.5,
    start_at: 0,
    transition: 'dissolve',
    grade: 'natural',
    texture: 'none',
    motion: isVideo ? 'static' : 'push_in',
    speed: 'normal',
    // The renderer drops every clip's audio, so this never varies. Kept because
    // the plan schema still carries it and the field turning up absent would be
    // a change to what a plan looks like, for nothing.
    sound: 'keep',
  };
}

// ---------------------------------------------------------------------------
// Operations. All of them return a new plan — the editor keeps a history stack
// for undo, and mutating in place would rewrite the past as well as the present.
// ---------------------------------------------------------------------------

const withClips = (plan, clips) => ({ ...plan, clips });

export function updateClip(plan, index, patch) {
  const clips = plan.clips.map((clip, i) => (i === index ? { ...clip, ...patch } : clip));
  return withClips(plan, clips);
}

export function removeClip(plan, index) {
  return withClips(plan, plan.clips.filter((_, i) => i !== index));
}

export function duplicateClip(plan, index) {
  const clips = [...plan.clips];
  clips.splice(index + 1, 0, { ...clips[index] });
  return withClips(plan, clips);
}

export function moveClip(plan, from, to) {
  if (to < 0 || to >= plan.clips.length || from === to) return plan;
  const clips = [...plan.clips];
  const [moved] = clips.splice(from, 1);
  clips.splice(to, 0, moved);
  return withClips(plan, clips);
}

export function addClips(plan, memories, at = null) {
  const fresh = memories.map(clipFor);
  const clips = [...plan.clips];
  clips.splice(at ?? clips.length, 0, ...fresh);
  return withClips(plan, clips.slice(0, MAX_CLIPS));
}

/** Apply one setting to every shot — the thing you actually want after deciding
 *  the whole film should be warmer, rather than opening forty shots in turn. */
export function applyToAll(plan, patch) {
  return withClips(
    plan,
    plan.clips.map((clip) => {
      // Motion and speed mean nothing on the wrong kind of source, and forcing
      // them produces shots the backend will silently reset anyway.
      const safe = { ...patch };
      if (clip.motion === 'static' && 'motion' in safe) delete safe.motion;
      return { ...clip, ...safe };
    })
  );
}

/**
 * Replaces rather than merges.
 *
 * Merging left the previous choice's fields behind — switching from an uploaded
 * track back to the composed score kept the `path`, and the backend, seeing a
 * path, went on using the file.
 */
/**
 * Cut one shot into two at `fraction` along it.
 *
 * The second half picks up where the first leaves off — for video that means its
 * in-point moves — so the two together play exactly what the one did. The join
 * between them is a straight cut, since a dissolve onto itself is a dip.
 */
export function splitClip(plan, index, fraction = 0.5) {
  const clip = plan.clips[index];
  if (!clip) return plan;

  const total = Number(clip.seconds) || 0;
  const first = Math.max(MIN_SECONDS, Math.min(total - MIN_SECONDS, total * fraction));
  if (total < MIN_SECONDS * 2) return plan;

  const head = { ...clip, seconds: Number(first.toFixed(2)), transition: 'cut' };
  const tail = {
    ...clip,
    seconds: Number((total - first).toFixed(2)),
    start_at: Number(((Number(clip.start_at) || 0) + first).toFixed(2)),
  };
  // A caption belongs to the moment it was written on, not to both halves.
  delete tail.caption;

  const clips = [...plan.clips];
  clips.splice(index, 1, head, tail);
  return { ...plan, clips };
}

export function setMusic(plan, music) {
  return { ...plan, music };
}

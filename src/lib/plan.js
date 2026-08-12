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

/** Whether a shot's own sound is worth hearing. */
export const SOUNDS = [
  { value: 'keep', label: 'Keep', hint: 'You hear this shot' },
  { value: 'under', label: 'Duck', hint: 'Room tone, under the music' },
];

export const MUSIC_MODES = [
  { value: 'ai', label: 'Composed for this', icon: 'zap', hint: 'Scored from what happened' },
  { value: 'prompt', label: 'Describe it', icon: 'edit-3', hint: 'Compose from your words' },
  { value: 'track', label: 'My own track', icon: 'upload', hint: 'Use a file you have' },
  { value: 'none', label: 'No music', icon: 'volume-x', hint: 'Silent' },
];

export const MIN_SECONDS = 0.4;
export const MAX_SECONDS = 15;
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
    // A still needs long enough to read; a clip of video says what it has to say
    // faster, and four seconds is where an untrimmed shot starts to drag.
    seconds: isVideo ? Math.min(4, Math.max(MIN_SECONDS, available || 4)) : 2.5,
    start_at: 0,
    transition: 'dissolve',
    grade: 'natural',
    texture: 'none',
    motion: isVideo ? 'static' : 'push_in',
    speed: 'normal',
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

export function setMusic(plan, music) {
  return { ...plan, music: { ...(plan.music ?? {}), ...music } };
}

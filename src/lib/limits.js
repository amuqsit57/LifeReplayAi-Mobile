/**
 * What you get without paying.
 *
 * Counted rather than stored. Both allowances are derived from rows the server
 * already returns — the films that exist for an event, the tracks in the music
 * library — so there is no counter to drift, nothing to reset when a render
 * fails, and no way to get free generations back by reinstalling. The thing
 * being limited is the same thing being counted.
 *
 * Client side, though, and worth being honest about: this decides what to *show*
 * and when to offer the paywall. It is not enforcement. Anyone determined can
 * call the API directly, so the same two checks belong in the backend on
 * `POST /api/replays` and `POST /api/events/{id}/music` before this earns money.
 */

/** Films an event may have before Pro. Two is enough to compare two styles. */
export const FREE_FILMS_PER_EVENT = 2;

/**
 * Composed tracks, across everything, ever.
 *
 * Not per event: scoring is the expensive call and the one people would loop
 * through prompts on, so the whole account shares an allowance rather than
 * getting a fresh three with every event they make.
 */
export const FREE_SONGS_TOTAL = 3;

/**
 * How many AI films an event has had.
 *
 * Hand-cut edits do not count. They are assembled from shots that already exist
 * and cost nothing to decide on, and charging for the editor twice — once to
 * open it, once per render — would be mean.
 *
 * Album films do count. They are the same generation against a smaller pile of
 * photographs, and an event whose albums were free would be a way around this.
 */
export function filmsUsed(replays = []) {
  return replays.filter((replay) => {
    if (replay.is_edit) return false;
    // A render that failed cost the person nothing and gave them nothing, so it
    // must not spend an allowance — being charged for the app's own bad day is
    // the fastest way to make somebody never pay for anything.
    //
    // Queued and running do count, and deliberately: they will become films, and
    // not counting them would let three taps in quick succession start three
    // free renders before the first one finished.
    return replay.status !== 'failed';
  }).length;
}

/** Tracks this account has had composed. Uploads and render leftovers are free. */
export function songsUsed(tracks = []) {
  return tracks.filter((track) => track.source === 'generated').length;
}

/**
 * What is left, and whether the next one needs paying for.
 *
 * `left` is clamped at zero so a Pro subscriber who lapses after making ten
 * films sees "0 left" rather than "-8 left".
 */
export function allowance(used, cap, isPro) {
  const left = Math.max(0, cap - used);
  return { used, cap, left, exhausted: !isPro && left === 0, unlimited: Boolean(isPro) };
}

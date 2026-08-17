/** Supabase reads and writes. Row level security scopes everything to the caller's family. */

import { supabase } from './supabase';

function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// ---------------------------------------------------------------- auth

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  return data.session;
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function signUp({ email, password, fullName }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName.trim() } },
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

/**
 * Send the recovery email, which carries a six digit code.
 *
 * No `redirectTo`. A link would have to come back into the app through the
 * scheme, which means a deep link to parse, a redirect allow list to keep in
 * step with it, and a class of failure — the link opening a browser, or the
 * wrong build, or nothing at all — that is invisible from in here. A code is
 * read off the screen and typed, so the app never leaves the foreground and
 * there is one less thing to configure per environment.
 *
 * This does need the Recovery template in the Supabase dashboard to contain
 * `{{ .Token }}`; the stock one only has the link.
 */
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  if (error) {
    // The status is carried through rather than flattened into a message. A 504
    // here does not mean the mail failed — it means the auth server ran out of
    // patience waiting for SMTP, which on a free mail tier happens while the
    // message is going out anyway. The screen needs to be able to tell that
    // apart from a real refusal, and it cannot do that from prose.
    const problem = new Error(error.message);
    problem.status = error.status;
    throw problem;
  }
}

/**
 * Trade the code for a session.
 *
 * Supabase signs you in on the strength of the code — that is what recovery is —
 * so once this returns, `updatePassword` has an account to act on.
 */
export async function verifyRecoveryCode(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: 'recovery',
  });
  if (error) throw new Error(error.message);
  return data.session;
}

/**
 * Set the password of whoever the current session belongs to.
 *
 * The same call whether it is reached from a verified code or from a signed-in
 * account changing its own password in settings.
 */
export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------- family

export async function myFamily() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;

  const row = unwrap(
    await supabase
      .from('family_members')
      .select('family_id, role, families(id, name, invite_code)')
      .eq('user_id', auth.user.id)
      .limit(1)
      .maybeSingle()
  );
  return row?.families ?? null;
}

export async function createFamily(name) {
  return unwrap(await supabase.rpc('create_family', { family_name: name }));
}

export async function joinFamily(code, relationship = null) {
  return unwrap(await supabase.rpc('join_family', { code, relationship }));
}

export async function roster() {
  return unwrap(await supabase.rpc('family_roster'));
}

// ---------------------------------------------------------------- events

export async function listEvents() {
  return unwrap(
    await supabase
      .from('events')
      // The foreign key has to be named. There are two paths between these tables
      // — memories belonging to an event, and the single memory an event uses as
      // its cover — so an unqualified embed is ambiguous and PostgREST refuses the
      // whole request rather than guessing. That failed the query outright, which
      // is why the home screen showed no events at all while every one of them sat
      // in the database.
      // The member count comes along too: how many people are contributing is
      // the thing that makes a shared event feel shared, and asking per card
      // would be one round trip each.
      .select('*, memories!memories_event_id_fkey(count), event_members(count)')
      .order('event_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
  );
}

export async function getEvent(eventId) {
  return unwrap(await supabase.from('events').select('*').eq('id', eventId).maybeSingle());
}

export async function createEvent({ title, description, eventDate, location }) {
  // One call, and it makes you the owner and mints the invite code. Creating an
  // event no longer starts with "first, set up a family" — anyone without one
  // gets a personal family behind the scenes and never has to think about it.
  return unwrap(
    await supabase.rpc('create_event', {
      event_title: title,
      event_description: description || null,
      event_when: eventDate || null,
      event_location: location || null,
    })
  );
}

export async function joinEvent(code) {
  return unwrap(await supabase.rpc('join_event', { code }));
}

/**
 * Delete an event, and everything that hung off it.
 *
 * Only whoever created it can — enforced by the policy, not by hiding the
 * button, so somebody else's event cannot be removed by calling this directly.
 * The albums, memories and films go with it on cascade, which is what deleting
 * an event means to the person doing it.
 */
export async function deleteEvent(eventId) {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) throw new Error(error.message);
}

/**
 * Leave an event you were invited to.
 *
 * Removes the membership, not the event — and deliberately not the photographs
 * either. What somebody contributed to a shared day stays part of that day;
 * taking it with them on the way out would quietly gut everybody else's film.
 * Anything they want gone, they can delete first.
 */
export async function leaveEvent(eventId) {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth?.user?.id;
  if (!me) throw new Error('Not signed in');

  const { error } = await supabase
    .from('event_members')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', me);
  if (error) throw new Error(error.message);
}

export async function eventPeople(eventId) {
  return unwrap(await supabase.rpc('event_people', { target_event: eventId })) ?? [];
}

// ---------------------------------------------------------------- albums

export async function listAlbums(eventId) {
  return (
    unwrap(
      await supabase
        .from('albums')
        .select('*, album_memories(count)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
    ) ?? []
  );
}

export async function getAlbum(albumId) {
  return unwrap(await supabase.from('albums').select('*').eq('id', albumId).maybeSingle());
}

export async function createAlbum({ eventId, title, memoryIds = [] }) {
  const { data: auth } = await supabase.auth.getUser();
  const event = await getEvent(eventId);
  if (!event) throw new Error('That event is gone');

  const album = unwrap(
    await supabase
      .from('albums')
      .insert({
        event_id: eventId,
        family_id: event.family_id,
        created_by: auth.user.id,
        title: title.trim(),
        cover_memory_id: memoryIds[0] ?? null,
      })
      .select()
      .single()
  );

  if (memoryIds.length) await addToAlbum(album.id, memoryIds);
  return album;
}

export async function addToAlbum(albumId, memoryIds) {
  const { data: auth } = await supabase.auth.getUser();
  return unwrap(
    await supabase
      .from('album_memories')
      // Adding a photo already in the album is a no-op rather than an error: the
      // person selecting twenty does not know which three are already there.
      .upsert(
        memoryIds.map((memory_id) => ({
          album_id: albumId,
          memory_id,
          added_by: auth.user.id,
        })),
        { onConflict: 'album_id,memory_id', ignoreDuplicates: true }
      )
  );
}

export async function removeFromAlbum(albumId, memoryIds) {
  return unwrap(
    await supabase
      .from('album_memories')
      .delete()
      .eq('album_id', albumId)
      .in('memory_id', memoryIds)
  );
}

export async function albumMemoryIds(albumId) {
  const rows =
    unwrap(await supabase.from('album_memories').select('memory_id').eq('album_id', albumId)) ?? [];
  return rows.map((row) => row.memory_id);
}

export async function deleteAlbum(albumId) {
  return unwrap(await supabase.from('albums').delete().eq('id', albumId));
}

// ---------------------------------------------------------------- the feed

/**
 * Every finished film you can see, newest first.
 *
 * Row level security does the scoping: a replay is readable only if you are in
 * its event or the family that owns it, so this needs no filter of its own and
 * cannot accidentally widen.
 */
export async function feed() {
  return (
    unwrap(
      await supabase
        .from('replays')
        .select(
          '*, events!replays_event_id_fkey(id, title, event_date), ' +
            'albums(id, title), ' +
            'profiles!replays_requested_by_fkey(id, full_name, avatar_url), ' +
            'replay_likes(count), replay_comments(count)'
        )
        .eq('status', 'succeeded')
        .order('completed_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(60)
    ) ?? []
  );
}

export async function myLikes(replayIds) {
  if (!replayIds.length) return [];
  const { data: auth } = await supabase.auth.getUser();
  const rows =
    unwrap(
      await supabase
        .from('replay_likes')
        .select('replay_id')
        .eq('user_id', auth.user.id)
        .in('replay_id', replayIds)
    ) ?? [];
  return rows.map((row) => row.replay_id);
}

export async function setLike(replayId, liked) {
  const { data: auth } = await supabase.auth.getUser();
  if (liked) {
    return unwrap(
      await supabase
        .from('replay_likes')
        .upsert({ replay_id: replayId, user_id: auth.user.id }, { onConflict: 'replay_id,user_id' })
    );
  }
  return unwrap(
    await supabase
      .from('replay_likes')
      .delete()
      .eq('replay_id', replayId)
      .eq('user_id', auth.user.id)
  );
}

export async function listComments(replayId) {
  return (
    unwrap(
      await supabase
        .from('replay_comments')
        .select('*, profiles(id, full_name, avatar_url)')
        .eq('replay_id', replayId)
        .order('created_at', { ascending: true })
    ) ?? []
  );
}

export async function addComment(replayId, body) {
  const { data: auth } = await supabase.auth.getUser();
  return unwrap(
    await supabase
      .from('replay_comments')
      .insert({ replay_id: replayId, user_id: auth.user.id, body: body.trim() })
      .select('*, profiles(id, full_name, avatar_url)')
      .single()
  );
}

export async function deleteComment(commentId) {
  return unwrap(await supabase.from('replay_comments').delete().eq('id', commentId));
}

export async function myProfile() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;
  return unwrap(await supabase.from('profiles').select('*').eq('id', auth.user.id).maybeSingle());
}

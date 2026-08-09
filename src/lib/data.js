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
      .select('*, memories(count)')
      .order('event_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
  );
}

export async function getEvent(eventId) {
  return unwrap(await supabase.from('events').select('*').eq('id', eventId).maybeSingle());
}

export async function createEvent({ title, description, eventDate, location }) {
  const { data: auth } = await supabase.auth.getUser();
  const family = await myFamily();
  if (!family) throw new Error('You are not in a family yet');

  return unwrap(
    await supabase
      .from('events')
      .insert({
        family_id: family.id,
        created_by: auth.user.id,
        title: title.trim(),
        description: description?.trim() || null,
        event_date: eventDate || null,
        location: location?.trim() || null,
      })
      .select()
      .single()
  );
}

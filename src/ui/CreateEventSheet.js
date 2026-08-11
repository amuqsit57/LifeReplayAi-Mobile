import { Feather } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { createEvent, joinEvent } from '../lib/data';
import { colors, radius, shadow, spacing, type } from '../theme';

function Row({ icon, children }) {
  return (
    <View style={styles.row}>
      <Feather name={icon} size={16} color={colors.textMuted} style={styles.rowIcon} />
      {children}
    </View>
  );
}

/**
 * Create an event, or join one with a code.
 *
 * Both live in one sheet because they are the same intention arriving from two
 * sides — you are either the person who was there with the photos, or the person
 * they sent the code to.
 */
export default function CreateEventSheet({ visible, onClose }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState('create');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');

  function finish(event) {
    setTitle('');
    setLocation('');
    setDescription('');
    setCode('');
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['feed'] });
    onClose?.();
    router.push(`/event/${event.id}`);
  }

  const create = useMutation({
    mutationFn: () => createEvent({ title, description, location }),
    onSuccess: finish,
    onError: (error) => Alert.alert('Could not create', error.message),
  });

  const join = useMutation({
    mutationFn: () => joinEvent(code),
    onSuccess: finish,
    onError: (error) => Alert.alert('Could not join', error.message),
  });

  const creating = mode === 'create';
  const busy = create.isPending || join.isPending;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />

            <View style={styles.tabs}>
              {[
                { key: 'create', label: 'New event' },
                { key: 'join', label: 'Join with code' },
              ].map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => setMode(tab.key)}
                  style={[styles.tab, mode === tab.key && styles.tabOn]}
                >
                  <Text style={[styles.tabText, mode === tab.key && styles.tabTextOn]}>
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 380 }}>
              {creating ? (
                <View style={styles.form}>
                  <Row icon="edit-3">
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      placeholder="What was it?"
                      placeholderTextColor={colors.textMuted}
                      style={styles.inputLead}
                      autoFocus
                    />
                  </Row>
                  <Row icon="map-pin">
                    <TextInput
                      value={location}
                      onChangeText={setLocation}
                      placeholder="Where (optional)"
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                    />
                  </Row>
                  <Row icon="align-left">
                    <TextInput
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Anything worth knowing (optional)"
                      placeholderTextColor={colors.textMuted}
                      style={styles.input}
                      multiline
                    />
                  </Row>

                  <Text style={styles.note}>
                    You will get a code to share. Anyone with it can add their photos and make
                    films — no setup on their side.
                  </Text>
                </View>
              ) : (
                <View style={styles.form}>
                  <Row icon="hash">
                    <TextInput
                      value={code}
                      onChangeText={(value) => setCode(value.toUpperCase().trim())}
                      placeholder="ABCD12"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.inputLead, { letterSpacing: 3 }]}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={12}
                      autoFocus
                    />
                  </Row>
                  <Text style={styles.note}>
                    Ask whoever set the event up for its code.
                  </Text>
                </View>
              )}
            </ScrollView>

            <Pressable
              onPress={() => (creating ? create.mutate() : join.mutate())}
              disabled={busy || (creating ? !title.trim() : code.length < 4)}
              style={({ pressed }) => [
                styles.cta,
                (busy || (creating ? !title.trim() : code.length < 4)) && styles.ctaOff,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.ctaText}>
                {busy ? 'Working…' : creating ? 'Create event' : 'Join event'}
              </Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
    ...shadow.raised,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },

  tabs: { flexDirection: 'row', gap: spacing.lg },
  tab: { paddingVertical: spacing.xs, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.primary },
  tabText: { ...type.heading, color: colors.textMuted },
  tabTextOn: { color: colors.text },

  form: { gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowIcon: { marginTop: 3 },
  inputLead: { ...type.title, flex: 1, color: colors.text, padding: 0 },
  input: { ...type.body, flex: 1, color: colors.text, padding: 0, maxHeight: 96 },
  note: { ...type.caption, color: colors.textMuted, marginTop: spacing.md },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  ctaOff: { backgroundColor: colors.borderStrong },
  ctaText: { ...type.bodyStrong, color: '#fff' },
});

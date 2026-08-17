import { Feather } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing, type } from '../theme';
import { Avatar } from './social';

/**
 * Every way of narrowing a gallery, behind one control.
 *
 * The event page used to carry three horizontal rows of chips above the grid —
 * sort, contributor, kind — and they cost more than they gave. They pushed the
 * photographs off the first screenful, they scrolled sideways so most of the
 * options were never seen, and three rows of pills is what a page looks like
 * when nobody decided what mattered.
 *
 * One button instead, showing how many filters are on, opening a sheet where
 * the choices have room to be read. The photographs get the screen back, and
 * the options are all visible at once for the first time.
 */

/** The button that opens it. Says how many filters are on, so the sheet is never a surprise. */
export function FilterButton({ active = 0, onPress, label = 'Filter' }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}${active ? `, ${active} applied` : ''}`}
      style={({ pressed }) => [styles.button, active > 0 && styles.buttonOn, pressed && { opacity: 0.85 }]}
    >
      <Feather name="sliders" size={15} color={active ? '#fff' : colors.textSoft} />
      <Text style={[styles.buttonText, active > 0 && { color: '#fff' }]}>{label}</Text>
      {active > 0 ? (
        <View style={styles.count}>
          <Text style={styles.countText}>{active}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** One choice inside the sheet. A full-width row rather than a pill — it is being read, not scanned. */
function Choice({ icon, avatar, label, detail, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.choice, selected && styles.choiceOn, pressed && { opacity: 0.8 }]}
    >
      {avatar ? (
        <Avatar url={avatar.avatar_url} name={avatar.full_name} size="sm" />
      ) : (
        <View style={[styles.choiceIcon, selected && { backgroundColor: colors.primary }]}>
          <Feather name={icon} size={14} color={selected ? '#fff' : colors.textSoft} />
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Text style={[styles.choiceLabel, selected && { color: colors.primary }]} numberOfLines={1}>
          {label}
        </Text>
        {detail ? <Text style={styles.choiceDetail} numberOfLines={1}>{detail}</Text> : null}
      </View>

      {selected ? <Feather name="check" size={17} color={colors.primary} /> : null}
    </Pressable>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/**
 * The sheet itself.
 *
 * `sections` is a plain description of what can be chosen, so the event page and
 * the album can offer different sets — an album has no "by person" grouping to
 * turn off, an event does — without either of them drawing its own sheet.
 */
export default function FilterSheet({ visible, onClose, sections = [], onClear, activeCount = 0 }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.grabber} />

          <View style={styles.head}>
            <Text style={styles.title}>Filter</Text>
            {activeCount > 0 && onClear ? (
              <Pressable onPress={onClear} hitSlop={10}>
                <Text style={styles.clear}>Clear all</Text>
              </Pressable>
            ) : null}
          </View>

          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            {sections.map((section) => (
              <Section key={section.title} title={section.title}>
                {section.options.map((option) => (
                  <Choice
                    key={String(option.value)}
                    icon={option.icon}
                    avatar={option.avatar}
                    label={option.label}
                    detail={option.detail}
                    selected={option.value === section.value}
                    onPress={() => section.onChange(option.value)}
                  />
                ))}
              </Section>
            ))}
          </ScrollView>

          <Pressable style={styles.done} onPress={onClose}>
            <Text style={styles.doneText}>Show results</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  buttonOn: { backgroundColor: colors.primary },
  buttonText: { ...type.label, color: colors.textSoft },
  count: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  countText: { ...type.tiny, fontSize: 10, color: '#fff', textAlign: 'center' },

  backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
    ...shadow.raised,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...type.title, color: colors.text },
  clear: { ...type.label, color: colors.primary },

  section: { paddingTop: spacing.md },
  sectionTitle: { ...type.tiny, color: colors.textMuted, marginBottom: spacing.xs },
  sectionBody: { gap: 2 },

  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  choiceOn: { backgroundColor: colors.primarySoft },
  choiceIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceLabel: { ...type.body, color: colors.text },
  choiceDetail: { ...type.caption, color: colors.textMuted },

  done: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    marginTop: spacing.sm,
  },
  doneText: { ...type.bodyStrong, color: '#fff' },
});

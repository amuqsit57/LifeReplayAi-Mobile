import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, type } from '../../theme';
import { Wordmark } from '../brand';

/**
 * The frame every auth screen sits in.
 *
 * One shell rather than four hand-built screens, because the differences between
 * them were accidents rather than decisions — each had its own spacing, its own
 * idea of where the title went, and its own centred emoji. Signing in and
 * resetting a password should feel like two moments in one product.
 *
 * Set left, not centred. A centred column of headline, subtitle, labels and
 * fields gives the eye a new starting point on every line; ranging everything
 * from one edge is what makes a form look considered rather than assembled, and
 * it is the arrangement every well-made sign-in page has converged on.
 *
 * The mark is the real one out of `assets/brand`, which had been sitting there
 * unused while these screens showed a film-strip emoji.
 */
export default function AuthShell({ title, subtitle, children, footer, onBack }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      {/* A wash of brand colour behind the mark, fading out well before the
          fields. Enough to say the page belongs to something; not so much that
          it competes with the one control that matters. */}
      <LinearGradient
        colors={[colors.primarySoft, colors.background]}
        style={styles.wash}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.back}
            >
              <Feather name="arrow-left" size={20} color={colors.text} />
            </Pressable>
          ) : null}

          <View style={styles.head}>
            {/* The same lockup the feed's header carries, one size up. Signing
                in should be the app introducing itself, and the mark alone left
                these screens the only place in the product where it appears
                without its name. */}
            <View style={styles.lockup}>
              <Wordmark size="xl" />
            </View>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>

          <View style={styles.body}>{children}</View>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** The one thing this screen is for. Full width, and unmistakably the action. */
export function AuthButton({ label, onPress, loading, disabled, icon = 'arrow-right' }) {
  const off = disabled || loading;

  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy: loading }}
      style={({ pressed }) => [styles.cta, off && styles.ctaOff, pressed && styles.ctaDown]}
    >
      <Text style={[styles.ctaText, off && { color: colors.textMuted }]}>
        {loading ? 'Just a moment…' : label}
      </Text>
      {loading ? null : (
        <Feather name={icon} size={18} color={off ? colors.textMuted : '#fff'} />
      )}
    </Pressable>
  );
}

/**
 * Something the server said, rather than something a field got wrong.
 *
 * Kept apart from the field errors on purpose: "that password is too short" is
 * about the box above it, and "we could not reach the server" is about the whole
 * attempt. Running both through the same red line under the form made the second
 * kind look like the last field's fault.
 */
export function AuthAlert({ message }) {
  if (!message) return null;
  return (
    <View style={styles.alert}>
      <Feather name="alert-triangle" size={15} color={colors.danger} />
      <Text style={styles.alertText}>{message}</Text>
    </View>
  );
}

/** The way to the other screen — quiet, but not hidden. */
export function AuthSwitch({ prompt, action, onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.switch}>
      <Text style={styles.switchPrompt}>
        {prompt} <Text style={styles.switchAction}>{action}</Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  wash: { position: 'absolute', left: 0, right: 0, top: 0, height: 320 },

  content: { paddingHorizontal: spacing.xl, gap: spacing.xl, flexGrow: 1 },
  back: { width: 40, height: 40, justifyContent: 'center', marginLeft: -spacing.sm },

  head: { gap: spacing.xs },
  // The lockup gets its own air. Sitting on the same rhythm as the title and
  // subtitle it read as a third line of copy rather than as the brand above them.
  lockup: { alignSelf: 'flex-start', marginBottom: spacing.lg },
  title: { ...type.display, color: colors.text },
  subtitle: { ...type.body, color: colors.textSoft, maxWidth: 320 },

  body: { gap: spacing.lg },
  // Pushed to the bottom of the screen when the form is short, so the switch to
  // the other page is where a thumb already is.
  footer: { marginTop: 'auto', paddingTop: spacing.lg, alignItems: 'center' },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  ctaOff: { backgroundColor: colors.surfaceSunk, shadowOpacity: 0, elevation: 0 },
  ctaDown: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  ctaText: { ...type.bodyStrong, fontSize: 16, color: '#fff' },

  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.danger + '40',
  },
  alertText: { ...type.caption, color: colors.danger, flex: 1 },

  switch: { paddingVertical: spacing.sm },
  switchPrompt: { ...type.body, color: colors.textMuted },
  switchAction: { color: colors.primary, fontFamily: 'Manrope_700Bold' },
});

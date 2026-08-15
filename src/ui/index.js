import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadow, spacing, type } from '../theme';

export function Screen({ children, scroll = true, contentStyle, refreshControl }) {
  const insets = useSafeAreaInsets();
  const padding = {
    paddingTop: insets.top + spacing.lg,
    paddingBottom: insets.bottom + spacing.xxxl,
    paddingHorizontal: spacing.lg,
  };

  if (!scroll) return <View style={[s.root, padding, contentStyle]}>{children}</View>;

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[padding, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, padded = true, ...rest }) {
  return (
    <View style={[s.card, padded && { padding: spacing.lg }, style]} {...rest}>
      {children}
    </View>
  );
}

const VARIANTS = {
  primary: { bg: colors.primary, border: colors.primary, fg: '#fff' },
  accent: { bg: colors.accent, border: colors.accent, fg: colors.textOnAccent },
  secondary: { bg: colors.surfaceAlt, border: colors.border, fg: colors.text },
  ghost: { bg: 'transparent', border: colors.border, fg: colors.textMuted },
  danger: { bg: colors.danger, border: colors.danger, fg: '#fff' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
}) {
  const palette = VARIANTS[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={inactive ? undefined : onPress}
      disabled={inactive}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && { opacity: 0.85 },
        inactive && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[type.bodyStrong, { color: palette.fg }]}>
          {icon ? `${icon}  ` : ''}
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({ label, error, style, ...inputProps }) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Text style={[type.label, { color: colors.textMuted }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...inputProps}
        // After the spread so a caller extends the base style rather than replacing it.
        style={[s.input, error && { borderColor: colors.danger }, style]}
      />
      {error ? <Text style={[type.caption, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

export function Pill({ label, tone = 'neutral', icon }) {
  // Every tone reads off the palette. Success, warning and danger were still
  // carrying literal near-black backgrounds from when this was a dark theme —
  // three ink-coloured chips in the middle of a white app, with the tinted
  // tokens for exactly this sitting unused beside them.
  const tones = {
    neutral: { bg: colors.surfaceAlt, fg: colors.textMuted },
    primary: { bg: colors.primarySoft, fg: colors.primary },
    accent: { bg: colors.accentSoft, fg: colors.accent },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  };
  const palette = tones[tone] ?? tones.neutral;

  return (
    <View style={[s.pill, { backgroundColor: palette.bg }]}>
      <Text style={[type.caption, { color: palette.fg, fontWeight: '700' }]}>
        {icon ? `${icon} ` : ''}
        {label}
      </Text>
    </View>
  );
}

export function SectionHeader({ title, subtitle, action, onAction }) {
  return (
    <View style={s.section}>
      <View style={{ flex: 1 }}>
        <Text style={[type.heading, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[type.caption, { color: colors.textMuted, marginTop: 2 }]}>{subtitle}</Text>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={[type.label, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Empty({ icon = '📼', title, body }) {
  return (
    <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl }}>
      <Text style={{ fontSize: 40 }}>{icon}</Text>
      <Text style={[type.bodyStrong, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      {body ? (
        <Text style={[type.body, { color: colors.textMuted, textAlign: 'center' }]}>{body}</Text>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    minHeight: 50,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
});

import { Feather } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, type } from '../../theme';

/**
 * One field on an auth form.
 *
 * Three things the old shared `Field` did not do, all of which cost sign-ins:
 *
 * The border answers. A field you are typing in looks different from one you are
 * not and from one that is wrong — without that, a form of identical grey boxes
 * gives no sense of where you are or what it objected to.
 *
 * A password can be looked at. Typing a long password blind on a phone keyboard
 * is the single most common reason a correct password gets entered wrong, and
 * the fix has been a reveal control on every serious login form for a decade.
 *
 * Errors sit under the field they belong to. One message at the bottom of a form
 * makes you work out which box it means; against the box, there is nothing to
 * work out.
 *
 * Forwards its ref so a form can send the return key from one field to the next
 * rather than making people reach back up to the screen between them.
 */
const AuthField = forwardRef(function AuthField(
  { icon, label, error, hint, secure, style, onBlur, onFocus, ...rest },
  ref
) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const tone = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={[styles.root, style]}>
      <Text style={[styles.label, error && { color: colors.danger }]}>{label}</Text>

      <View
        style={[
          styles.box,
          { borderColor: tone },
          // A soft ring rather than a thicker border: thickening moves the text
          // by a pixel as you tab through, which reads as a judder.
          focused && !error && styles.focusRing,
          error && styles.errorFill,
        ]}
      >
        {icon ? (
          <Feather
            name={icon}
            size={17}
            color={error ? colors.danger : focused ? colors.primary : colors.textMuted}
          />
        ) : null}

        <TextInput
          ref={ref}
          style={styles.input}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secure && !revealed}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...rest}
        />

        {secure ? (
          <Pressable
            onPress={() => setRevealed((on) => !on)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          >
            <Feather name={revealed ? 'eye-off' : 'eye'} size={17} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <View style={styles.note}>
          <Feather name="alert-circle" size={12} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

export default AuthField;

const styles = StyleSheet.create({
  root: { gap: 6 },
  label: { ...type.label, color: colors.textSoft },

  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 54,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    backgroundColor: colors.surfaceAlt,
  },
  focusRing: {
    backgroundColor: colors.surface,
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  errorFill: { backgroundColor: colors.dangerSoft },

  // 16px minimum, or iOS zooms the whole page on focus.
  input: { ...type.body, fontSize: 16, flex: 1, color: colors.text, padding: 0 },

  note: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  errorText: { ...type.caption, color: colors.danger, flex: 1 },
  hint: { ...type.caption, color: colors.textMuted },
});

import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, type } from '../theme';
import { Tappable } from './press';

/**
 * The one thing to do if you have not done anything yet.
 *
 * Modelled on a prompt box, but the field is a sample of what the app will write
 * about your footage rather than something to type into — this does not generate
 * from a description, it reads what you actually filmed. Making it look editable
 * would promise a feature that does not exist; making it look like an example of
 * the output sets the right expectation and still shows what you get.
 *
 * The whole card is the button. A card that looks like an input with a button in
 * the corner invites people to tap the input first and find nothing happens.
 */
export default function CreateCard({ onPress, hint }) {
  return (
    <Tappable onPress={onPress} haptic scaleTo={0.985}>
      <LinearGradient
        colors={[colors.primarySoft, colors.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.head}>
          <View style={styles.spark}>
            <Feather name="zap" size={13} color={colors.primary} />
          </View>
          <Text style={styles.title}>Turn your day into a film</Text>
        </View>

        <Text style={styles.blurb}>
          Add the photos and videos everyone took. It finds the moments worth keeping and cuts
          them together.
        </Text>

        <View style={styles.sample}>
          <Text style={styles.sampleLabel}>WHAT IT WILL WRITE</Text>
          <Text style={styles.sampleText} numberOfLines={2}>
            {hint ?? '“The rings going on, confetti in the air, the first dance — 32 shots, cut to an original score.”'}
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.steps}>
            <Step icon="folder-plus" label="Event" />
            <Feather name="chevron-right" size={12} color={colors.textMuted} />
            <Step icon="upload" label="Upload" />
            <Feather name="chevron-right" size={12} color={colors.textMuted} />
            <Step icon="film" label="Film" />
          </View>

          <View style={styles.cta}>
            <Text style={styles.ctaText}>Start</Text>
            <Feather name="arrow-right" size={15} color="#fff" />
          </View>
        </View>
      </LinearGradient>
    </Tappable>
  );
}

function Step({ icon, label }) {
  return (
    <View style={styles.step}>
      <Feather name={icon} size={11} color={colors.textSoft} />
      <Text style={styles.stepText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary + '2A',
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  spark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.heading, color: colors.text, flex: 1 },
  blurb: { ...type.caption, color: colors.textSoft },

  sample: {
    gap: 5,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sampleLabel: { ...type.tiny, color: colors.textMuted, fontSize: 9.5, letterSpacing: 1 },
  sampleText: { ...type.caption, color: colors.textSoft, fontStyle: 'italic' },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  stepText: { ...type.tiny, color: colors.textSoft },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  ctaText: { ...type.label, color: '#fff' },
});

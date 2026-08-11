import { Redirect, Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/store';
import { colors, radius, type } from '../../src/theme';

/**
 * Three destinations and one action.
 *
 * Feed first, because the films other people made are the reason to open the app
 * at all. Create sits in the middle as a raised button rather than a tab — it is
 * something you do, not somewhere you go, and putting it under the thumb is the
 * one piece of social-app grammar worth copying wholesale.
 */
const TABS = [
  { name: 'feed', title: 'Feed', icon: '◉' },
  { name: 'events', title: 'Events', icon: '▦' },
  { name: 'create', title: 'Create', icon: '＋', action: true },
  { name: 'albums', title: 'Albums', icon: '❏' },
  { name: 'profile', title: 'You', icon: '☺' },
];

function TabIcon({ icon, label, focused, action }) {
  if (action) {
    return (
      <View style={styles.actionWrap}>
        <View style={styles.action}>
          <Text style={styles.actionIcon}>{icon}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.item}>
      <Text style={[styles.icon, focused && styles.iconOn]}>{icon}</Text>
      <Text style={[styles.label, focused && styles.labelOn]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const session = useAuth((s) => s.session);
  const ready = useAuth((s) => s.ready);

  if (ready && !session) return <Redirect href="/auth/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.bar,
        tabBarItemStyle: { paddingTop: 8 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused }) => (
              <TabIcon icon={tab.icon} label={tab.title} focused={focused} action={tab.action} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: Platform.OS === 'ios' ? 86 : 68,
    paddingBottom: Platform.OS === 'ios' ? 26 : 10,
  },
  item: { alignItems: 'center', gap: 2, width: 68 },
  icon: { fontSize: 19, color: colors.textMuted },
  iconOn: { color: colors.primary },
  label: { ...type.tiny, color: colors.textMuted },
  labelOn: { color: colors.primary },

  // Lifted out of the bar so it reads as the primary action rather than a
  // fourth place to be.
  actionWrap: { width: 68, alignItems: 'center' },
  action: {
    width: 48,
    height: 40,
    marginTop: -10,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: { color: colors.textOnAccent, fontSize: 22, fontWeight: '700', marginTop: -2 },
});

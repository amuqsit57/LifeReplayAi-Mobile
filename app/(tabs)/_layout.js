import { Feather } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/store';
import { colors, type } from '../../src/theme';

/**
 * Four places to be. Creating an event is not one of them — it lives as an icon
 * button in each screen's header, where an action belongs, rather than pretending
 * to be a destination.
 */
const TABS = [
  { name: 'feed', title: 'Feed', icon: 'film' },
  { name: 'events', title: 'Events', icon: 'grid' },
  { name: 'albums', title: 'Albums', icon: 'folder' },
  { name: 'profile', title: 'You', icon: 'user' },
];

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
              <View style={styles.item}>
                <Feather
                  name={tab.icon}
                  size={20}
                  color={focused ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.label, focused && styles.labelOn]}>{tab.title}</Text>
              </View>
            ),
          }}
        />
      ))}
      {/* Reachable by code but never shown as a tab. */}
      <Tabs.Screen name="create" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 26 : 8,
  },
  item: { alignItems: 'center', gap: 3, width: 72 },
  label: { ...type.tiny, color: colors.textMuted },
  labelOn: { color: colors.primary },
});

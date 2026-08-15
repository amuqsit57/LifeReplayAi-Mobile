import { Feather } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  // Measured, not assumed. The heights were fixed per platform — 84/26 on iOS,
  // 64/8 everywhere else — which is too tall on an iPad or an iPhone SE and too
  // short on an Android phone using gesture navigation, where the labels ended
  // up inside the swipe strip.
  const insets = useSafeAreaInsets();

  if (ready && !session) return <Redirect href="/auth/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: [
          styles.bar,
          { height: 58 + insets.bottom, paddingBottom: insets.bottom + 6 },
        ],
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
    paddingTop: 8,
  },
  item: { alignItems: 'center', gap: 3, width: 72 },
  label: { ...type.tiny, color: colors.textMuted },
  labelOn: { color: colors.primary },
});

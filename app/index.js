import { useQuery } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { myFamily } from '../src/lib/data';
import { useAuth } from '../src/store';
import { colors } from '../src/theme';

export default function Index() {
  const session = useAuth((s) => s.session);
  const ready = useAuth((s) => s.ready);
  const signedIn = Boolean(session);

  // Everything hangs off a family, so a signed-in user without one finishes setup
  // before any other screen would work.
  const family = useQuery({
    queryKey: ['myFamily'],
    queryFn: myFamily,
    enabled: signedIn,
  });

  if (!ready || (signedIn && family.isLoading)) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!signedIn) return <Redirect href="/auth/sign-in" />;
  if (!family.data) return <Redirect href="/family-setup" />;
  return <Redirect href="/home" />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});

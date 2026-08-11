import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '../src/store';
import { colors } from '../src/theme';

export default function Index() {
  const session = useAuth((s) => s.session);
  const ready = useAuth((s) => s.ready);

  if (!ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // No family gate any more. Creating an event makes one behind the scenes if you
  // do not have one, so nobody is asked to set up a household before they can put
  // photos anywhere.
  return session ? <Redirect href="/(tabs)/feed" /> : <Redirect href="/auth/sign-in" />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});

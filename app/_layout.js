import { Fraunces_700Bold, useFonts } from '@expo-google-fonts/fraunces';
import {
  Manrope_500Medium,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getSession, onAuthChange } from '../src/lib/data';
import {
  currentCustomerInfo,
  hasPro,
  identify,
  onCustomerInfo,
  startPurchases,
} from '../src/lib/purchases';
import { useAuth, usePro } from '../src/store';
import { colors } from '../src/theme';

export default function RootLayout() {
  // A face that fails to load must not hold the app behind a blank screen — the
  // system font is a worse look, not a broken one, so the error is treated as
  // "carry on" rather than "wait".
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_700Bold,
    Manrope_500Medium,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  const queryClient = useRef(
    new QueryClient({
      defaultOptions: {
        queries: { retry: 1, staleTime: 15_000, refetchOnWindowFocus: false },
      },
    })
  ).current;

  const setSession = useAuth((s) => s.setSession);
  const session = useAuth((s) => s.session);
  const setCustomerInfo = usePro((s) => s.setCustomerInfo);
  const setUnavailable = usePro((s) => s.setUnavailable);

  useEffect(() => {
    // Restore the persisted session first, then follow sign-in/sign-out.
    getSession()
      .then(setSession)
      .catch(() => setSession(null));

    return onAuthChange((session) => {
      setSession(session);
      // A different account must not read the previous one's cached rows.
      queryClient.clear();
    });
  }, [queryClient, setSession]);

  // Start the store once, and keep listening. The listener is what makes a
  // purchase made on the paywall — or a renewal, or a lapse — reach every screen
  // without any of them asking.
  useEffect(() => {
    let stop = () => {};
    let cancelled = false;

    startPurchases().then((ok) => {
      if (cancelled) return;
      if (!ok) return setUnavailable();

      stop = onCustomerInfo((info) => setCustomerInfo(info, hasPro(info)));
      currentCustomerInfo().then((info) => {
        if (!cancelled) setCustomerInfo(info, hasPro(info));
      });
    });

    return () => {
      cancelled = true;
      stop();
    };
  }, [setCustomerInfo, setUnavailable]);

  // A subscription belongs to the account, not the handset. Re-identifying on
  // every sign-in and sign-out is what carries it to a new phone and stops it
  // being inherited by whoever signs in next on a shared one.
  useEffect(() => {
    identify(session).then((info) => {
      if (info) setCustomerInfo(info, hasPro(info));
    });
  }, [session, setCustomerInfo]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'fade',
            }}
          />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

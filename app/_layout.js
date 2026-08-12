import {
  Manrope_500Medium,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getSession, onAuthChange } from '../src/lib/data';
import { useAuth } from '../src/store';
import { colors } from '../src/theme';

// Held until the faces are ready. Rendering in the system font and swapping a
// moment later makes the whole app flash and reflow.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
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

  useEffect(() => {
    // A font that fails to load must not leave the app behind a splash screen
    // forever — better the system face than nothing at all.
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

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

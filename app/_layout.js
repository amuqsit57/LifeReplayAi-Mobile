import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getSession, onAuthChange } from '../src/lib/data';
import { useAuth } from '../src/store';
import { colors } from '../src/theme';

export default function RootLayout() {
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
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

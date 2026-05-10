import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClerkProvider } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import AppNavigator from './src/navigation/AppNavigator';
import { useAiPoseLogging } from './src/hooks/useAiPoseLogging';
import { useCryAlertNotifications } from './src/hooks/useCryAlertNotifications';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error('Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env');
}

const tokenCache = {
  async getToken(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async saveToken(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
  async deleteToken(key: string) {
    return SecureStore.deleteItemAsync(key);
  },
};

export default function App() {
  useAiPoseLogging();
  useCryAlertNotifications();

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </ClerkProvider>
  );
}

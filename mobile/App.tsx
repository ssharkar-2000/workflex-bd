import { LogBox } from 'react-native';

// LogBox ignore list
LogBox.ignoreLogs([
  "Cannot assign to read-only property 'NONE'",
]);
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import { I18nProvider } from './src/i18n/I18nContext';
import { RootNavigator } from './src/navigation';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

function StatusBarForTheme() {
  const { mode } = useTheme();
  // 🟢 ডার্ক মোডে স্ট্যাটাস বার আইকন হালকা রঙের, লাইট মোডে গাঢ় রঙের
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <I18nProvider>
            <StatusBarForTheme />
            <RootNavigator />
          </I18nProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

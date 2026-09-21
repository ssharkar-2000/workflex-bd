import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { AIMonitoringScreen } from '../screens/AIMonitoringScreen';
import { AlertDetailScreen } from '../screens/AlertDetailScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { AttendanceScreen } from '../screens/AttendanceScreen';
import { CmsScreen } from '../screens/CmsScreen';
import { CompaniesScreen } from '../screens/CompaniesScreen';
import { CompanyDetailScreen } from '../screens/CompanyDetailScreen';
import { ComplaintsScreen } from '../screens/ComplaintsScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { EditWorkerScreen } from '../screens/EditWorkerScreen';
import { EmployersScreen } from '../screens/EmployersScreen';
import { JobDetailScreen } from '../screens/JobDetailScreen';
import { JobHistoryScreen } from '../screens/JobHistoryScreen';
import { JobsScreen } from '../screens/JobsScreen';
import { MenuScreen } from '../screens/MenuScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { PaymentsScreen } from '../screens/PaymentsScreen';
import { PostJobScreen } from '../screens/PostJobScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { SecurityScreen } from '../screens/SecurityScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SignInScreen } from '../screens/SignInScreen';
import { SystemScreen } from '../screens/SystemScreen';
import { TransactionDetailScreen } from '../screens/TransactionDetailScreen';
import { VerificationScreen } from '../screens/VerificationScreen';
import { WorkerProfileScreen } from '../screens/WorkerProfileScreen';
import { WorkersScreen } from '../screens/WorkersScreen';
import { colors, text } from '../theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return <Text style={[s.tabIcon, focused && s.tabIconActive]}>{glyph}</Text>;
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: s.tabBar,
        tabBarLabelStyle: s.tabLabel,
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="🏠" focused={focused} /> }}
      />
      <Tab.Screen
        name="Workers"
        component={WorkersScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="👷" focused={focused} /> }}
      />
      <Tab.Screen
        name="Jobs"
        component={JobsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="💼" focused={focused} /> }}
      />
      <Tab.Screen
        name="Payments"
        component={PaymentsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="💳" focused={focused} /> }}
      />
      <Tab.Screen
        name="Menu"
        component={MenuScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="☰" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { admin, loading } = useAuth();

  // 🟢 ১. প্রাথমিক অরিজিনাল ডাটা লোডিং চলাকালীন নিরাপদ স্প্ল্যাশ
  if (loading) {
    return (
      <View style={s.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          // 🟢 ২. নেভিগেশন ট্রানজিশনের সময় ব্যাকগ্রাউন্ড আনমাউন্ট ফ্লিকারিং বন্ধ করা
          animation: 'fade',
        }}
      >
        {admin ? (
          <Stack.Group>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen name="WorkerProfile" component={WorkerProfileScreen} />
            <Stack.Screen name="EditWorker" component={EditWorkerScreen} />
            <Stack.Screen name="JobHistory" component={JobHistoryScreen} />
            <Stack.Screen name="JobDetail" component={JobDetailScreen} />
            <Stack.Screen name="PostJob" component={PostJobScreen} />
            <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
            <Stack.Screen name="Verifications" component={VerificationScreen} />
            <Stack.Screen name="AIMonitoring" component={AIMonitoringScreen} />
            <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
            <Stack.Screen name="Analytics" component={AnalyticsScreen} />
            <Stack.Screen name="Complaints" component={ComplaintsScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Employers" component={EmployersScreen} />
            <Stack.Screen name="Companies" component={CompaniesScreen} />
            <Stack.Screen name="CompanyDetail" component={CompanyDetailScreen} />
            <Stack.Screen name="Attendance" component={AttendanceScreen} />
            <Stack.Screen name="Reports" component={ReportsScreen} />
            <Stack.Screen name="Security" component={SecurityScreen} />
            <Stack.Screen name="Cms" component={CmsScreen} />
            <Stack.Screen name="System" component={SystemScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </Stack.Group>
        ) : (
          <Stack.Group screenOptions={{ animation: 'none' }}>
            <Stack.Screen name="SignIn" component={SignInScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  tabBar: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    height: 62,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabLabel: { ...text.micro, fontSize: 10, fontWeight: '600' },
  tabIcon: { fontSize: 18, opacity: 0.45 },
  tabIconActive: { opacity: 1 },
});
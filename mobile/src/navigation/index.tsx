import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { NotificationPopup } from '../components/NotificationPopup';
import { AIMonitoringScreen } from '../screens/AIMonitoringScreen';
import { AlertDetailScreen } from '../screens/AlertDetailScreen';
import { AnalyticsScreen } from '../screens/AnalyticsScreen';
import { ApplicantsScreen } from '../screens/ApplicantsScreen';
import { AttendanceScreen } from '../screens/AttendanceScreen';
import { CmsDetailScreen } from '../screens/CmsDetailScreen';
import { CmsScreen } from '../screens/CmsScreen';
import { CompaniesScreen } from '../screens/CompaniesScreen';
import { CompanyCreateScreen } from '../screens/CompanyCreateScreen';
import { CompanyDetailScreen } from '../screens/CompanyDetailScreen';
import { ComplaintDetailScreen } from '../screens/ComplaintDetailScreen';
import { ComplaintsScreen } from '../screens/ComplaintsScreen';
import { EntityHistoryScreen } from '../screens/EntityHistoryScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { DocumentsScreen } from '../screens/DocumentsScreen';
import { EditWorkerScreen } from '../screens/EditWorkerScreen';
import { EmployerCreateScreen } from '../screens/EmployerCreateScreen';
import { EmployersScreen } from '../screens/EmployersScreen';
import { JobAnalyticsScreen } from '../screens/JobAnalyticsScreen';
import { JobDetailScreen } from '../screens/JobDetailScreen';
import { JobHistoryScreen } from '../screens/JobHistoryScreen';
import { InterviewsScreen } from '../screens/InterviewsScreen';
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
import { SubscriptionsScreen } from '../screens/SubscriptionsScreen';
import { SuspiciousTransactionsScreen } from '../screens/SuspiciousTransactionsScreen';
import { TransactionDetailScreen } from '../screens/TransactionDetailScreen';
import { VerificationScreen } from '../screens/VerificationScreen';
import { WorkerProfileScreen } from '../screens/WorkerProfileScreen';
import { WorkerTransactionsScreen } from '../screens/WorkerTransactionsScreen';
import { WorkersScreen } from '../screens/WorkersScreen';
import { useI18n } from '../i18n/I18nContext';
import { useTheme } from '../theme/ThemeContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  return <Text style={[s.tabIcon, focused && s.tabIconActive]}>{glyph}</Text>;
}

function Tabs() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const s = useMemo(() => createStyles(colors), [colors]);
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
        options={{
          tabBarLabel: t('nav.home'),
          tabBarIcon: ({ focused }) => <TabIcon glyph="🏠" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Workers"
        component={WorkersScreen}
        options={{
          tabBarLabel: t('nav.workers'),
          tabBarIcon: ({ focused }) => <TabIcon glyph="👷" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Jobs"
        component={JobsScreen}
        options={{
          tabBarLabel: t('nav.jobs'),
          tabBarIcon: ({ focused }) => <TabIcon glyph="💼" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Payments"
        component={PaymentsScreen}
        options={{
          tabBarLabel: t('nav.payments'),
          tabBarIcon: ({ focused }) => <TabIcon glyph="💳" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Menu"
        component={MenuScreen}
        options={{
          tabBarLabel: t('nav.menu'),
          tabBarIcon: ({ focused }) => <TabIcon glyph="☰" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { admin, loading } = useAuth();
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

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
            <Stack.Screen name="JobAnalytics" component={JobAnalyticsScreen} />
            <Stack.Screen name="Applicants" component={ApplicantsScreen} />
            {/* Item 10 */}
            <Stack.Screen name="Interviews" component={InterviewsScreen} />
            {/* Item 11 */}
            <Stack.Screen name="Documents" component={DocumentsScreen} />
            {/* Item 8 */}
            <Stack.Screen
              name="SuspiciousTransactions"
              component={SuspiciousTransactionsScreen}
            />
            <Stack.Screen name="PostJob" component={PostJobScreen} />
            <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
            <Stack.Screen name="Verifications" component={VerificationScreen} />
            <Stack.Screen name="AIMonitoring" component={AIMonitoringScreen} />
            <Stack.Screen name="AlertDetail" component={AlertDetailScreen} />
            <Stack.Screen name="Analytics" component={AnalyticsScreen} />
            <Stack.Screen name="Complaints" component={ComplaintsScreen} />
            <Stack.Screen name="ComplaintDetail" component={ComplaintDetailScreen} />
            <Stack.Screen name="EntityHistory" component={EntityHistoryScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Employers" component={EmployersScreen} />
            <Stack.Screen name="EmployerCreate" component={EmployerCreateScreen} />
            <Stack.Screen name="Companies" component={CompaniesScreen} />
            <Stack.Screen name="CompanyCreate" component={CompanyCreateScreen} />
            <Stack.Screen name="CompanyDetail" component={CompanyDetailScreen} />
            <Stack.Screen name="Attendance" component={AttendanceScreen} />
            <Stack.Screen name="Reports" component={ReportsScreen} />
            <Stack.Screen name="Security" component={SecurityScreen} />
            <Stack.Screen name="Cms" component={CmsScreen} />
            <Stack.Screen name="CmsDetail" component={CmsDetailScreen} />
            <Stack.Screen name="System" component={SystemScreen} />
            <Stack.Screen name="WorkerTransactions" component={WorkerTransactionsScreen} />
            <Stack.Screen name="Subscriptions" component={SubscriptionsScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
          </Stack.Group>
        ) : (
          <Stack.Group screenOptions={{ animation: 'none' }}>
            <Stack.Screen name="SignIn" component={SignInScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
      {/* Item 9 — mounted above the navigator so an incoming message pops
          over whichever screen is showing, not just the Notifications list.
          Inside NavigationContainer because it navigates when tapped. */}
      {admin ? <NotificationPopup /> : null}
    </NavigationContainer>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
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
    tabLabel: { fontSize: 10, fontWeight: '600' },
    tabIcon: { fontSize: 18, opacity: 0.45 },
    tabIconActive: { opacity: 1 },
  });
}
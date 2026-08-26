import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '../../src/store/auth-store';

/**
 * An admin session is established by POST /auth/admin/login, not by a flag
 * on a regular account — so this checks the store's `admin` field directly
 * rather than calling /me, which is a User-table endpoint an admin's token
 * was never issued against.
 */
export default function AdminLayout() {
  const admin = useAuthStore((s) => s.admin);

  if (!admin) return <Redirect href="/(auth)/welcome" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}

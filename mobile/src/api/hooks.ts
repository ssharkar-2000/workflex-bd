import { useCallback, useEffect, useState } from 'react';
import { api } from './client';

type State<T> = { data: T | null; loading: boolean; error: string | null };

/**
 * Minimal fetch-on-mount hook with a manual refetch. Deliberately not a full
 * cache layer — if this app grows, swap the body for TanStack Query and every
 * call site stays the same.
 */
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null });

  const load = useCallback(async () => {
    if (!path) return;
    // 🟢 আগের ডাটা ধরে রেখে শুধু লোডিং ও এরর স্টেট আপডেট করা
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api<T>(path);
      setState({ data, loading: false, error: null });
    } catch (e: any) {
      // 🟢 ডাটা null করা হবে না (s.data বজায় থাকবে), যাতে স্ক্রিন ক্র্যাশ বা ErrorState না দেখায়
      setState((s) => ({
        data: s.data, 
        loading: false, 
        error: e.message ?? 'Could not load this.',
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    let isMounted = true;
    
    if (isMounted) {
      load();
    }

    return () => {
      isMounted = false;
    };
  }, [load]);

  return { ...state, refetch: load };
}
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { api } from './client';
import { friendlyErrorAuto } from './errors';

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
        // Item 14: never surface the raw failure — friendlyErrorAuto turns
        // it into a translated sentence, including for a dropped connection.
        error: friendlyErrorAuto(e),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  // 🟢 আগে শুধু মাউন্টে একবার লোড হতো — react-navigation স্ট্যাকে স্ক্রিন আনমাউন্ট
  // হয় না, তাই approve/reject/suspend/delete করে ফিরে এলে লিস্ট আর কাউন্ট পুরনোই
  // থেকে যেত। useFocusEffect দিয়ে স্ক্রিনে ফোকাস ফিরলেই (initial mount সহ) রিফেচ
  // হবে, তাই অ্যাকশনের পর ফিরে এলে নাম্বার/লিস্ট সবসময় আপ-টু-ডেট থাকবে।
  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  return { ...state, refetch: load };
}
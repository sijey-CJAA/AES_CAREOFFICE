import { getSupabaseClient } from '../lib/supabase';
import type { DashboardStats } from '../types/database';

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_dashboard_stats');
  if (error) throw new Error(error.message);
  return data as DashboardStats;
}


import { getSupabaseClient } from '../lib/supabase';

export async function signInWithEmail(email: string, password: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function signOut() {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function requestPasswordReset(email: string) {
  const supabase = getSupabaseClient();
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new Error(error.message);
}

export async function changePassword(currentEmail: string, currentPassword: string, newPassword: string) {
  const supabase = getSupabaseClient();
  // Verify the current password by re-authenticating before updating
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: currentEmail,
    password: currentPassword,
  });
  if (verifyError) {
    throw new Error('Incorrect current password.');
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

export async function updateRecoveredPassword(newPassword: string) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

export async function verifyAdminAccess(): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('admins').select('id').limit(1);
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}


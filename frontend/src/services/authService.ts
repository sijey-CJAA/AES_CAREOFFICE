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

export async function fetchAdminProfile(): Promise<{ nickname: string | null; display_name: string | null } | null> {
  const supabase = getSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return null;

  const email = (user.email ?? '').trim().toLowerCase();
  const { data, error } = await supabase
    .from('admins')
    .select('id, nickname, display_name')
    .or(`auth_user_id.eq.${user.id},email.ilike.${email}`)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function updateAdminNickname(nickname: string): Promise<string> {
  const supabase = getSupabaseClient();
  const trimmed = nickname.trim();

  // Try RPC first (which safely enforces admin check & links auth_user_id)
  const { error: rpcError } = await supabase.rpc('update_admin_profile', {
    p_nickname: trimmed,
  });

  if (rpcError) {
    // Fall back to direct table update via RLS policy
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) throw new Error('Not authenticated');

    const email = (user.email ?? '').trim().toLowerCase();
    const { error: tblError } = await supabase
      .from('admins')
      .update({
        nickname: trimmed || null,
        display_name: trimmed || null,
        auth_user_id: user.id,
      })
      .or(`auth_user_id.eq.${user.id},email.ilike.${email}`);

    if (tblError) throw new Error(tblError.message);
  }

  // Also update Supabase Auth user_metadata so the local session keeps it
  await supabase.auth.updateUser({
    data: {
      nickname: trimmed,
      full_name: trimmed,
      display_name: trimmed,
    },
  });

  return trimmed;
}


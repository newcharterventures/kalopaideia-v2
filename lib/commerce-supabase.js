// lib/commerce-supabase.js — Kalopaideia auth via Supabase (same project as Mansion).
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || null;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || null;

export const isAuthConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
export const supabaseAnon = isAuthConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
export { SUPABASE_URL, SUPABASE_ANON_KEY };

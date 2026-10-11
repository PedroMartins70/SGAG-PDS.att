import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variaveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY sao obrigatorias (veja client/.env.example).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export function getSupabase() {
  return supabase;
}
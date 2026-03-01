import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './env';

const config = getSupabaseConfig();

if (!config) {
  throw new Error(
    'Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) are missing.'
  );
}

export const supabase = createClient(config.url, config.publishableKey);

export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

export const getSupabaseConfig = (): SupabaseConfig | null => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  return { url, publishableKey };
};

export const hasSupabaseConfig = () => Boolean(getSupabaseConfig());

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.SB_URL;
const supabaseKey = process.env.SB_PUBLISHABLE_KEY;

export const createClient = () =>
  createBrowserClient(
    supabaseUrl!,
    supabaseKey!,
  );

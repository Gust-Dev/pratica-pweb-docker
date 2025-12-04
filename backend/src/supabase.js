import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://gzqtrkzssqednkuwqlct.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6cXRya3pzc3FlZG5rdXdxbGN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NjcxNjcsImV4cCI6MjA4MDM0MzE2N30.XlxVWq942OjiE4LEs1HwUtp0SBSQ7ytOyaHUfy7Q9Lg";

const selectFirstNonEmpty = (...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const supabaseUrl = selectFirstNonEmpty(
  process.env.SUPABASE_URL,
  DEFAULT_SUPABASE_URL,
);

const supabaseKey = selectFirstNonEmpty(
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  process.env.SUPABASE_SERVICE_KEY,
  process.env.SUPABASE_ANON_KEY,
  process.env.SUPABASE_KEY,
  DEFAULT_SUPABASE_ANON_KEY,
);

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase configuration. Ensure SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_KEY) are set.",
  );
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export default supabase;

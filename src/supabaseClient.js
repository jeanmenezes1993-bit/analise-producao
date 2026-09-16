import { createClient } from "@supabase/supabase-js";

// Mesmo projeto Supabase já usado pelo site em produção
// (https://jeanmenezes1993-bit.github.io/analise-producao/).
// A anon key é pública por design (protegida por RLS no banco).
const SUPABASE_URL = "https://dsxotthnlhlsblorlvxe.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzeG90dGhubGhsc2Jsb3JsdnhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzNjg5ODYsImV4cCI6MjA5NTk0NDk4Nn0.cd1k_ueejID3oXq8hr8J5j7uUuUpKE7N10LH-laKZEQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const supabaseUrl = "https://qwslbmgfroejtkxqnxho.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3c2xibWdmcm9lanRreHFueGhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5OTQ5NTYsImV4cCI6MjEwMDU3MDk1Nn0.ZQaJheDyBm8n_E6rpQanB84gHKypLa2Ldg8RMiXrGws";

const supabase = window.supabase.createClient(
    supabaseUrl,
    supabaseAnonKey
);

// Make it available to the rest of the app
window.supabaseClient = supabase;

console.log("✅ Connected to Supabase");
    
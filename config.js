// 使用 window.supabase
const supabaseClient = window.supabase.createClient(
    'https://aoxjpnudahusexmhivjc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFveGpwbnVkYWh1c2V4bWhpdmpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgwNzk5ODcsImV4cCI6MjA1MzY1NTk4N30.ciwFFaYj-EI2B9xUy0gGFobikehg_tocdFmrdgLGu9E'
);

// 導出 supabase 客戶端
export const supabase = supabaseClient;

// 檢查連接狀態
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        console.log('已連接到 Supabase')
    } else if (event === 'SIGNED_OUT') {
        console.log('已斷開 Supabase 連接')
    }
}); 
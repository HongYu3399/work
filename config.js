// 改用 CDN 引入
const { createClient } = supabase;  // 直接從全局變量獲取

const SUPABASE_URL = 'https://aoxjpnudahusexmhivjc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFveGpwbnVkYWh1c2V4bWhpdmpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgwNzk5ODcsImV4cCI6MjA1MzY1NTk4N30.ciwFFaYj-EI2B9xUy0gGFobikehg_tocdFmrdgLGu9E'

// 初始化 Supabase 客戶端
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 檢查連接狀態
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        console.log('已連接到 Supabase')
    } else if (event === 'SIGNED_OUT') {
        console.log('已斷開 Supabase 連接')
    }
}) 
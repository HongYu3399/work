# 班表管理系統

一個簡單易用的網頁版班表管理系統，使用 Supabase 進行資料儲存。

## 功能特點

### 1. 班表管理
- 設定每日工作時間（支援整點和半點）
- 快捷時間設定，一鍵套用常用時段
- 休假日設定
- 自動跳轉到下一天，快速連續設定
- 支援刪除已設定的班表

### 2. 薪資計算
- 可設定基本時薪
- 支援自訂薪水金額
- 自動計算總工時和預估薪資
- 顯示當月工作天數統計

### 3. 資料匯出
- 匯出高解析度日曆圖片 (PNG)
- 匯出薪資明細表 (CSV)
- 匯出工時明細表 (CSV)

### 4. 其他功能
- 班表顏色標記
- 詳細工作記錄查看
- 資料本地儲存
- 支援月份切換

## 技術說明
- 使用 Supabase 進行資料儲存和同步
- 支援多裝置資料同步
- 使用者認證和授權
- 使用 html2canvas 產生高品質圖片
- 支援 CSV 格式匯出

## 安裝說明

### Supabase 設置
1. 在 Supabase 創建新專案
2. 創建以下資料表：
   ```sql
   -- 班表資料表
   create table schedules (
     id uuid default uuid_generate_v4() primary key,
     user_id uuid references auth.users,
     date date not null,
     start_time time,
     end_time time,
     break_time integer,
     shift_color text,
     salary_type text,
     custom_salary numeric,
     type text default 'work',
     created_at timestamp with time zone default timezone('utc'::text, now()),
     updated_at timestamp with time zone default timezone('utc'::text, now())
   );

   -- 快捷時間設定表
   create table presets (
     id uuid default uuid_generate_v4() primary key,
     user_id uuid references auth.users,
     start_time time not null,
     end_time time not null,
     break_time integer,
     color text,
     created_at timestamp with time zone default timezone('utc'::text, now())
   );
   ```
3. 設置資料表的 RLS (Row Level Security) 策略
4. 在專案中設置環境變數

### 本地開發設置
1. 複製專案檔案
2. 設置 config.js 中的 Supabase 配置
3. 使用網頁伺服器運行專案

## 使用說明

### 基本操作
1. 點擊日期格可開啟工作時間設定
2. 可選擇工作或休假
3. 設定上下班時間（支援整點和半點）
4. 設定休息時間
5. 選擇薪資計算方式（時薪/自訂）
6. 選擇班表顏色
7. 點擊保存即可

### 快捷時間設定
1. 點擊「+」新增常用時段
2. 設定時間和顏色
3. 之後可直接點擊快捷時間套用

### 資料匯出
1. 點擊「導出」按鈕
2. 選擇需要的匯出格式：
   - 薪資明細
   - 工時明細
   - 工作日曆

### 詳細記錄
1. 點擊「詳細記錄」查看當月完整工作記錄
2. 顯示每日工作時間和薪資明細

### 多裝置同步
- 登入同一帳號可在不同裝置間同步資料
- 資料會即時同步到雲端
- 支援離線操作，連網後自動同步

## 注意事項
- 需要網路連接才能同步資料
- 建議定期匯出資料備份
- 請妥善保管帳號密碼 
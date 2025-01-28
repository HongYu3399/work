import { supabase } from './config.js'

class Database {
    constructor() {
        this.supabase = supabase;
        this.offlineData = {
            schedules: new Map(),
            presets: []
        };
        this.syncQueue = [];
        this.isOnline = navigator.onLine;
        
        // 監聽網路狀態
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncOfflineData();
            // 添加上線日誌
            this.addLog('connection_status', {
                status: 'online',
                timestamp: new Date().toISOString()
            });
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            // 添加離線日誌
            this.addLog('connection_status', {
                status: 'offline',
                timestamp: new Date().toISOString()
            });
        });

        // 添加初始化日誌
        this.addLog('system_init', {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            timestamp: new Date().toISOString(),
            version: '1.0.0'  // 添加版本號
        });
    }

    // 獲取班表資料
    async getSchedules(year, month) {
        try {
            if (!this.isOnline) {
                return this.getOfflineSchedules(year, month);
            }

            const { data, error } = await this.supabase
                .from('schedules')
                .select('*')
                .gte('date', `${year}-${String(month).padStart(2, '0')}-01`)
                .lte('date', `${year}-${String(month).padStart(2, '0')}-31`);

            if (error) throw error;

            // 更新離線資料
            data.forEach(schedule => {
                this.offlineData.schedules.set(schedule.date, schedule);
            });

            return data;
        } catch (error) {
            console.error('Error fetching schedules:', error);
            return this.getOfflineSchedules(year, month);
        }
    }

    // 保存班表資料
    async saveSchedule(date, scheduleData) {
        try {
            // 保存到離線存儲
            this.offlineData.schedules.set(date, scheduleData);
            
            if (!this.isOnline) {
                this.syncQueue.push({
                    type: 'schedule',
                    action: 'upsert',
                    date,
                    data: scheduleData
                });
                return { success: true, offline: true };
            }

            // 準備要保存的資料
            const scheduleRecord = {
                date,
                start_time: scheduleData.startTime,
                end_time: scheduleData.endTime,
                break_time: parseInt(scheduleData.breakTime),
                shift_color: scheduleData.shiftColor,
                salary_type: scheduleData.salaryType,
                custom_salary: scheduleData.customSalary,
                type: scheduleData.type || 'work',
                updated_at: new Date().toISOString()
            };

            const { data, error } = await this.supabase
                .from('schedules')
                .upsert(scheduleRecord);

            if (error) throw error;

            // 添加日誌
            await this.addLog('save_schedule', {
                date,
                scheduleData,
                timestamp: new Date().toISOString()
            });

            return { success: true, data };

        } catch (error) {
            console.error('Error saving schedule:', error);
            return { success: false, error };
        }
    }

    // 刪除班表資料
    async deleteSchedule(date) {
        try {
            // 從離線存儲中刪除
            this.offlineData.schedules.delete(date);

            if (!this.isOnline) {
                this.syncQueue.push({
                    type: 'schedule',
                    action: 'delete',
                    date
                });
                return { success: true, offline: true };
            }

            const { error } = await this.supabase
                .from('schedules')
                .delete()
                .eq('date', date);

            if (error) throw error;

            // 添加日誌
            await this.addLog('delete_schedule', {
                date,
                timestamp: new Date().toISOString()
            });

            return { success: true };

        } catch (error) {
            console.error('Error deleting schedule:', error);
            return { success: false, error };
        }
    }

    // 獲取快捷時間設定
    async getPresets() {
        try {
            if (!this.isOnline) {
                return this.offlineData.presets;
            }

            const { data, error } = await this.supabase
                .from('presets')
                .select('*');

            if (error) throw error;

            // 更新離線資料
            this.offlineData.presets = data;
            return data;

        } catch (error) {
            console.error('Error fetching presets:', error);
            return this.offlineData.presets;
        }
    }

    // 保存快捷時間設定
    async savePreset(presetData) {
        try {
            if (!this.isOnline) {
                this.syncQueue.push({
                    type: 'preset',
                    action: 'upsert',
                    data: presetData
                });
                return { success: true, offline: true };
            }

            const { data, error } = await this.supabase
                .from('presets')
                .upsert(presetData);

            if (error) throw error;

            // 添加日誌
            await this.addLog('save_preset', {
                presetData,
                timestamp: new Date().toISOString()
            });

            return { success: true, data };

        } catch (error) {
            console.error('Error saving preset:', error);
            return { success: false, error };
        }
    }

    // 同步離線資料
    async syncOfflineData() {
        if (this.syncQueue.length === 0) return;

        const queue = [...this.syncQueue];
        this.syncQueue = [];

        for (const item of queue) {
            try {
                if (item.type === 'schedule') {
                    if (item.action === 'upsert') {
                        await this.saveSchedule(item.date, item.data);
                    } else if (item.action === 'delete') {
                        await this.deleteSchedule(item.date);
                    }
                } else if (item.type === 'preset') {
                    await this.savePreset(item.data);
                }
            } catch (error) {
                console.error('Error syncing offline data:', error);
                // 失敗的操作重新加入隊列
                this.syncQueue.push(item);
            }
        }
    }

    // 獲取離線班表資料
    getOfflineSchedules(year, month) {
        const schedules = [];
        for (const [date, data] of this.offlineData.schedules) {
            const [scheduleYear, scheduleMonth] = date.split('-');
            if (parseInt(scheduleYear) === year && parseInt(scheduleMonth) === month) {
                schedules.push({ date, ...data });
            }
        }
        return schedules;
    }

    // 添加日誌
    async addLog(action, details) {
        try {
            const { data, error } = await this.supabase
                .from('logs')
                .insert([
                    {
                        action,
                        details
                    }
                ]);

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Error adding log:', error);
            return { success: false, error };
        }
    }
}

// 導出資料庫實例
export const db = new Database(); 
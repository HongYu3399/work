import { db } from './database.js';

class Calendar {
    constructor() {
        this.date = new Date();
        this.currentMonth = this.date.getMonth();
        this.currentYear = this.date.getFullYear();
        this.scheduleData = JSON.parse(localStorage.getItem('scheduleData')) || {};
        
        this.selectedShiftColor = null;
        this.presets = JSON.parse(localStorage.getItem('timePresets')) || [
            { start: '09:00', end: '18:00', breakTime: '60', color: '#FFB7B7' },
            { start: '13:00', end: '22:00', breakTime: '60', color: '#FFDAB7' },
            { start: '18:00', end: '23:00', breakTime: '60', color: '#FFE4B7' }
        ];
        this.initializeElements();
        this.addEventListeners();
        this.initializeShiftButtons();
        this.renderCalendar();
        this.initializeStats();
        this.initializePresets();
        this.initializeSalarySetting();
        this.initializeDetailModal();
        this.initializeDeleteButton();
        this.initializeExport();
        this.initializeShiftType();
        this.db = db;
        this.loadData();
    }

    async loadData() {
        try {
            // 載入當月資料
            const schedules = await this.db.getSchedules(this.currentYear, this.currentMonth + 1);
            
            // 合併本地和遠端資料
            schedules.forEach(schedule => {
                // 如果遠端資料比本地新，則更新
                const localSchedule = this.scheduleData[schedule.date];
                if (!localSchedule || new Date(schedule.updated_at) > new Date(localSchedule.updated_at)) {
                    this.scheduleData[schedule.date] = schedule;
                }
            });
            
            // 保存到本地
            localStorage.setItem('scheduleData', JSON.stringify(this.scheduleData));
            
            // 載入快捷時間設定
            const presets = await this.db.getPresets();
            if (presets && presets.length > 0) {
                this.presets = presets;
                localStorage.setItem('timePresets', JSON.stringify(this.presets));
            }
            
            // 更新顯示
            this.renderCalendar();
            this.updateStats();
        } catch (error) {
            console.error('Error loading data:', error);
            // 如果載入失敗，使用本地資料
            this.renderCalendar();
            this.updateStats();
        }
    }

    initializeElements() {
        this.calendarDays = document.getElementById('calendar-days');
        this.currentMonthElement = document.getElementById('currentMonth');
        this.prevButton = document.getElementById('prevMonth');
        this.nextButton = document.getElementById('nextMonth');
        this.modal = document.getElementById('timeModal');
        this.selectedDate = null;

        // 添加顏色預設值的點擊事件
        document.querySelectorAll('.color-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const color = btn.dataset.color;
                document.getElementById('shiftColor').value = color;
                
                // 移除其他按鈕的選中狀態
                document.querySelectorAll('.color-preset').forEach(b => {
                    b.classList.remove('selected');
                });
                // 添加當前按鈕的選中狀態
                btn.classList.add('selected');
            });
        });

        // 添加滾輪事件處理
        document.getElementById('startHour').addEventListener('wheel', (e) => {
            e.preventDefault();
            const input = e.target;
            const value = parseInt(input.value);
            if (e.deltaY < 0) {
                // 向上滾動
                input.value = value < 23 ? value + 1 : 0;
            } else {
                // 向下滾動
                input.value = value > 0 ? value - 1 : 23;
            }
        });

        document.getElementById('endHour').addEventListener('wheel', (e) => {
            e.preventDefault();
            const input = e.target;
            const value = parseInt(input.value);
            if (e.deltaY < 0) {
                // 向上滾動
                input.value = value < 23 ? value + 1 : 0;
            } else {
                // 向下滾動
                input.value = value > 0 ? value - 1 : 23;
            }
        });

        // 添加快捷時間按鈕事件
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const startHour = btn.dataset.start;
                const endHour = btn.dataset.end;
                
                // 更新時間輸入框
                document.getElementById('startHour').value = parseInt(startHour);
                document.getElementById('startMinute').value = '00';
                document.getElementById('endHour').value = parseInt(endHour);
                document.getElementById('endMinute').value = '00';
                
                // 更新按鈕狀態
                document.querySelectorAll('.preset-btn').forEach(b => {
                    b.classList.remove('selected');
                });
                btn.classList.add('selected');
            });
        });
    }

    addEventListeners() {
        this.prevButton.addEventListener('click', () => this.previousMonth());
        this.nextButton.addEventListener('click', () => this.nextMonth());
        
        // 模態框事件
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelTime').addEventListener('click', () => this.closeModal());
        document.getElementById('saveTime').addEventListener('click', () => this.saveTimeData());
    }

    initializeShiftButtons() {
        const buttons = document.querySelectorAll('.shift-btn');
        buttons.forEach(btn => {
            btn.style.backgroundColor = btn.dataset.color;
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.selectedShiftColor = btn.dataset.color;
            });
        });
    }

    openModal(date) {
        this.selectedDate = date;
        const data = this.scheduleData[date] || {};
        const deleteBtn = document.getElementById('deleteTime');
        
        // 添加日期顯示
        const [year, month, day] = date.split('-').map(Number);
        const modalTitle = document.querySelector('#timeModal .modal-header h3');
        modalTitle.textContent = `設定工作時間 (${month}/${day})`;
        
        // 根據是否有班表來顯示或隱藏刪除按鈕
        if (data.startTime) {
            deleteBtn.classList.remove('hidden');
        } else {
            deleteBtn.classList.add('hidden');
        }
        
        if (data.startTime) {
            const [startHour, startMinute] = data.startTime.split(':');
            const [endHour, endMinute] = data.endTime.split(':');
            document.getElementById('startHour').value = parseInt(startHour);
            document.getElementById('startMinute').value = startMinute === '30' ? '30' : '0';
            document.getElementById('endHour').value = parseInt(endHour);
            document.getElementById('endMinute').value = endMinute === '30' ? '30' : '0';
        } else {
            // 設置默認值
            document.getElementById('startHour').value = 9;
            document.getElementById('startMinute').value = '0';
            document.getElementById('endHour').value = 18;
            document.getElementById('endMinute').value = '0';
        }
        
        document.getElementById('breakTime').value = data.breakTime || '60';
        document.getElementById('shiftColor').value = data.shiftColor || '#FFB7B7';
        
        // 重置快捷按鈕狀態
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // 設置薪資類型
        if (data.salaryType) {
            document.getElementById('salaryType').value = data.salaryType;
            const customSalaryInput = document.querySelector('.custom-salary-input');
            if (data.salaryType === 'custom') {
                customSalaryInput.style.display = 'block';
                document.getElementById('customSalary').value = data.customSalary || '';
            } else {
                customSalaryInput.style.display = 'none';
                document.getElementById('customSalary').value = '';
            }
        } else {
            document.getElementById('salaryType').value = 'hourly';
            document.querySelector('.custom-salary-input').style.display = 'none';
            document.getElementById('customSalary').value = '';
        }
        
        // 設置班別類型
        document.getElementById('shiftType').value = data.type || 'work';
        const workTimeInputs = document.getElementById('workTimeInputs');
        workTimeInputs.style.display = data.type === 'off' ? 'none' : 'block';
        
        this.modal.style.display = 'block';
    }

    closeModal() {
        this.modal.style.display = 'none';
    }

    async saveTimeData() {
        const shiftType = document.getElementById('shiftType').value;
        
        if (shiftType === 'off') {
            // 保存休假資料
            this.scheduleData[this.selectedDate] = {
                type: 'off',
                shiftColor: '#E0E0E0'  // 使用灰色表示休假
            };
        } else {
            // 原有的工作時間保存邏輯
            const startHour = document.getElementById('startHour').value.padStart(2, '0');
            const startMinute = document.getElementById('startMinute').value === '30' ? '30' : '00';
            const endHour = document.getElementById('endHour').value.padStart(2, '0');
            const endMinute = document.getElementById('endMinute').value === '30' ? '30' : '00';
            const breakTime = document.getElementById('breakTime').value;
            const shiftColor = document.getElementById('shiftColor').value;
            const salaryType = document.getElementById('salaryType').value;
            const customSalary = document.getElementById('customSalary').value;

            const startTime = `${startHour}:${startMinute}`;
            const endTime = `${endHour}:${endMinute}`;

            if (startHour && startMinute && endHour && endMinute) {
                this.scheduleData[this.selectedDate] = {
                    startTime,
                    endTime,
                    breakTime,
                    shiftColor,
                    salaryType,
                    customSalary: salaryType === 'custom' ? customSalary : null
                };
            } else {
                alert('請填寫完整的時間資訊');
                return;
            }
        }
        
        try {
            const result = await this.db.saveSchedule(this.selectedDate, this.scheduleData[this.selectedDate]);
            if (result.success) {
                // 保存到本地
                this.scheduleData[this.selectedDate] = this.scheduleData[this.selectedDate];
                localStorage.setItem('scheduleData', JSON.stringify(this.scheduleData));
                
                this.renderCalendar();
                this.closeModal();
                this.updateStats();
            } else {
                alert('保存失敗，請稍後再試');
            }
        } catch (error) {
            console.error('Error saving data:', error);
            // 如果保存到 Supabase 失敗，至少保存到本地
            this.scheduleData[this.selectedDate] = this.scheduleData[this.selectedDate];
            localStorage.setItem('scheduleData', JSON.stringify(this.scheduleData));
            
            this.renderCalendar();
            this.closeModal();
            this.updateStats();
            
            alert('資料已保存到本地，將在網路恢復時同步');
        }
    }

    renderCalendar() {
        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
        const startingDay = firstDay.getDay();
        const monthLength = lastDay.getDate();

        // 更新月份標題
        const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                          '七月', '八月', '九月', '十月', '十一月', '十二月'];
        this.currentMonthElement.textContent = 
            `${this.currentYear}年 ${monthNames[this.currentMonth]}`;

        // 清空日曆
        this.calendarDays.innerHTML = '';

        // 填充上個月的日期
        const prevMonthLastDay = new Date(this.currentYear, this.currentMonth, 0).getDate();
        for (let i = startingDay - 1; i >= 0; i--) {
            const day = document.createElement('div');
            day.className = 'day other-month';
            day.textContent = prevMonthLastDay - i;
            this.calendarDays.appendChild(day);
        }

        // 填充當前月份的日期
        const today = new Date();
        for (let i = 1; i <= monthLength; i++) {
            const day = document.createElement('div');
            day.className = 'day';
            
            const dateKey = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const content = document.createElement('div');
            content.className = 'day-content';

            // 添加日期數字
            const dateNumber = document.createElement('div');
            dateNumber.className = 'date-number';
            dateNumber.textContent = i;
            content.appendChild(dateNumber);

            // 添加時間信息
            if (this.scheduleData[dateKey]) {
                const timeInfo = document.createElement('div');
                timeInfo.className = 'time-info';
                
                if (this.scheduleData[dateKey].type === 'off') {
                    timeInfo.textContent = '休假';
                    timeInfo.style.backgroundColor = '#E0E0E0';
                } else {
                    const { startTime, endTime, shiftColor } = this.scheduleData[dateKey];
                    const formattedStart = startTime.replace(':', '');
                    const formattedEnd = endTime.replace(':', '');
                    timeInfo.textContent = `${formattedStart}~${formattedEnd}`;
                    timeInfo.style.backgroundColor = shiftColor;
                }
                
                content.appendChild(timeInfo);
            }

            day.appendChild(content);
            
            if (this.currentYear === today.getFullYear() && 
                this.currentMonth === today.getMonth() && 
                i === today.getDate()) {
                day.className += ' today';
            }

            day.addEventListener('click', () => this.openModal(dateKey));
            
            this.calendarDays.appendChild(day);
        }

        // 填充下個月的日期
        const remainingDays = 42 - (startingDay + monthLength);
        for (let i = 1; i <= remainingDays; i++) {
            const day = document.createElement('div');
            day.className = 'day other-month';
            day.textContent = i;
            this.calendarDays.appendChild(day);
        }
    }

    previousMonth() {
        this.currentMonth--;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        this.renderCalendar();
        this.updateStats();
    }

    nextMonth() {
        this.currentMonth++;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.renderCalendar();
        this.updateStats();
    }

    initializeStats() {
        // 監聽時薪變更
        document.getElementById('hourlyRate').addEventListener('change', () => {
            this.updateStats();
        });
    }

    updateStats() {
        const currentMonth = this.currentMonth;
        const currentYear = this.currentYear;
        let workDays = 0;
        let totalMinutes = 0;
        let totalSalary = 0;

        // 計算當月的工作天數和總時數
        Object.entries(this.scheduleData).forEach(([date, data]) => {
            const [year, month, day] = date.split('-').map(Number);
            if (year === currentYear && month === currentMonth + 1) {
                if (data.type !== 'off') {  // 只計算工作日
                    workDays++;
                    
                    // 計算工作時間（分鐘）
                    const [startHour, startMinute] = data.startTime.split(':').map(Number);
                    const [endHour, endMinute] = data.endTime.split(':').map(Number);
                    const breakTime = parseInt(data.breakTime);
                    
                    let minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute) - breakTime;
                    totalMinutes += minutes;

                    // 計算薪資
                    const hourlyRate = parseFloat(document.getElementById('hourlyRate').value) || 0;
                    if (data.salaryType === 'custom' && data.customSalary) {
                        totalSalary += parseInt(data.customSalary);
                    } else {
                        const hours = minutes / 60;
                        totalSalary += hours * hourlyRate;
                    }
                }
            }
        });

        // 更新統計資訊
        const totalHours = (totalMinutes / 60).toFixed(1);
        const estimatedSalary = Math.round(totalSalary);

        document.getElementById('workDays').textContent = `${workDays} 天`;
        document.getElementById('totalHours').textContent = `${totalHours} 小時`;
        document.getElementById('estimatedSalary').textContent = `NT$ ${estimatedSalary.toLocaleString()}`;
    }

    initializePresets() {
        // 初始化新增按鈕事件
        document.getElementById('addPresetBtn').addEventListener('click', () => {
            this.openPresetModal();
        });

        // 初始化快捷時間管理模態框事件
        const presetModal = document.getElementById('presetModal');
        presetModal.querySelector('.close').addEventListener('click', () => {
            presetModal.style.display = 'none';
        });
        document.getElementById('cancelPreset').addEventListener('click', () => {
            presetModal.style.display = 'none';
        });
        document.getElementById('savePreset').addEventListener('click', () => {
            this.savePreset();
        });

        this.renderPresets();

        // 添加顏色預設值的點擊事件（管理快捷時間模態框）
        document.querySelectorAll('#presetModal .color-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const color = btn.dataset.color;
                document.getElementById('presetColor').value = color;
                
                // 移除其他按鈕的選中狀態
                document.querySelectorAll('#presetModal .color-preset').forEach(b => {
                    b.classList.remove('selected');
                });
                // 添加當前按鈕的選中狀態
                btn.classList.add('selected');
            });
        });
    }

    renderPresets() {
        const container = document.getElementById('presetButtons');
        container.innerHTML = '';
        
        this.presets.forEach((preset, index) => {
            const btn = document.createElement('button');
            btn.className = 'preset-btn';
            btn.textContent = `${preset.start}-${preset.end}`;
            btn.style.backgroundColor = preset.color;
            btn.style.color = '#000000';
            
            btn.addEventListener('click', () => {
                // 保存當前日期的資料
                this.scheduleData[this.selectedDate] = {
                    startTime: preset.start,
                    endTime: preset.end,
                    breakTime: preset.breakTime,
                    shiftColor: preset.color,
                    salaryType: 'hourly',
                    customSalary: null
                };
                
                // 更新日曆和統計
                localStorage.setItem('scheduleData', JSON.stringify(this.scheduleData));
                this.renderCalendar();
                this.updateStats();
                
                // 關閉當前模態框
                this.modal.style.display = 'none';
                
                // 計算下一天的日期
                const [year, month, day] = this.selectedDate.split('-').map(Number);
                const nextDate = new Date(year, month - 1, day + 1);
                
                // 格式化下一天的日期
                const nextDateStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
                
                // 如果下一天在當前月份內，則開啟下一天的設定
                if (nextDate.getMonth() === this.currentMonth) {
                    // 確保資料已經保存並更新後再開啟下一天
                    setTimeout(() => {
                        this.openModal(nextDateStr);
                    }, 0);
                }
            });
            
            // 添加刪除按鈕
            const deleteBtn = document.createElement('span');
            deleteBtn.className = 'delete-preset';
            deleteBtn.textContent = '×';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.deletePreset(index);
            };
            
            btn.appendChild(deleteBtn);
            
            container.appendChild(btn);
        });
    }

    openPresetModal() {
        document.getElementById('presetModal').style.display = 'block';
    }

    savePreset() {
        const startHour = document.getElementById('presetStartHour').value.padStart(2, '0');
        const startMinute = document.getElementById('presetStartMinute').value.padStart(2, '0');
        const endHour = document.getElementById('presetEndHour').value.padStart(2, '0');
        const endMinute = document.getElementById('presetEndMinute').value.padStart(2, '0');
        const breakTime = document.getElementById('presetBreakTime').value;
        const color = document.getElementById('presetColor').value;

        const newPreset = {
            start: `${startHour}:${startMinute}`,
            end: `${endHour}:${endMinute}`,
            breakTime,
            color
        };

        this.presets.push(newPreset);
        localStorage.setItem('timePresets', JSON.stringify(this.presets));
        this.renderPresets();
        document.getElementById('presetModal').style.display = 'none';
    }

    deletePreset(index) {
        if (confirm('確定要刪除這個快捷時間嗎？')) {
            this.presets.splice(index, 1);
            localStorage.setItem('timePresets', JSON.stringify(this.presets));
            this.renderPresets();
        }
    }

    initializeSalarySetting() {
        const salaryTypeSelect = document.getElementById('salaryType');
        const customSalaryInput = document.querySelector('.custom-salary-input');
        
        salaryTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                customSalaryInput.style.display = 'block';
            } else {
                customSalaryInput.style.display = 'none';
                document.getElementById('customSalary').value = '';
            }
        });
    }

    initializeDetailModal() {
        // 初始化詳細記錄按鈕事件
        document.getElementById('showDetailBtn').addEventListener('click', () => {
            this.showDetailModal();
        });

        const detailModal = document.getElementById('detailModal');
        detailModal.querySelector('.close').addEventListener('click', () => {
            detailModal.style.display = 'none';
        });
        document.getElementById('closeDetail').addEventListener('click', () => {
            detailModal.style.display = 'none';
        });
    }

    showDetailModal() {
        const detailList = document.querySelector('.detail-list');
        detailList.innerHTML = '';
        
        // 獲取當月所有工作記錄
        const records = [];
        Object.entries(this.scheduleData).forEach(([date, data]) => {
            const [year, month, day] = date.split('-').map(Number);
            if (year === this.currentYear && month === this.currentMonth + 1) {
                // 計算工作時間
                const [startHour, startMinute] = data.startTime.split(':').map(Number);
                const [endHour, endMinute] = data.endTime.split(':').map(Number);
                const breakTime = parseInt(data.breakTime);
                
                let minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute) - breakTime;
                const hours = (minutes / 60).toFixed(1);

                // 計算薪資
                let salary;
                if (data.salaryType === 'custom' && data.customSalary) {
                    salary = parseInt(data.customSalary);
                } else {
                    const hourlyRate = parseFloat(document.getElementById('hourlyRate').value) || 0;
                    salary = Math.round(hours * hourlyRate);
                }

                records.push({
                    date: `${month}/${day}`,
                    startTime: data.startTime,
                    endTime: data.endTime,
                    breakTime: data.breakTime,
                    hours,
                    salary
                });
            }
        });

        // 按日期排序
        records.sort((a, b) => {
            const [aMonth, aDay] = a.date.split('/').map(Number);
            const [bMonth, bDay] = b.date.split('/').map(Number);
            return aDay - bDay;
        });

        // 生成詳細記錄列表
        records.forEach(record => {
            const item = document.createElement('div');
            item.className = 'detail-item';
            item.innerHTML = `
                <div class="detail-date">${record.date}</div>
                <div class="detail-time">
                    ${record.startTime}-${record.endTime}
                    <div class="detail-break">休息 ${record.breakTime} 分鐘</div>
                </div>
                <div class="detail-hours">${record.hours} 小時</div>
                <div class="detail-salary">NT$ ${record.salary.toLocaleString()}</div>
            `;
            detailList.appendChild(item);
        });

        document.getElementById('detailModal').style.display = 'block';
    }

    initializeDeleteButton() {
        const deleteBtn = document.getElementById('deleteTime');
        deleteBtn.addEventListener('click', () => {
            if (confirm('確定要刪除這天的班表嗎？')) {
                this.deleteTimeData();
            }
        });
    }

    async deleteTimeData() {
        if (this.selectedDate && this.scheduleData[this.selectedDate]) {
            try {
                const result = await this.db.deleteSchedule(this.selectedDate);
                if (result.success) {
                    // 從本地存儲中刪除
                    delete this.scheduleData[this.selectedDate];
                    localStorage.setItem('scheduleData', JSON.stringify(this.scheduleData));
                    
                    this.renderCalendar();
                    this.updateStats();
                    this.closeModal();
                } else {
                    alert('刪除失敗，請稍後再試');
                }
            } catch (error) {
                console.error('Error deleting data:', error);
                // 如果刪除失敗，至少從本地刪除
                delete this.scheduleData[this.selectedDate];
                localStorage.setItem('scheduleData', JSON.stringify(this.scheduleData));
                
                this.renderCalendar();
                this.updateStats();
                this.closeModal();
                
                alert('資料已從本地刪除，將在網路恢復時同步');
            }
        }
    }

    initializeExport() {
        // 初始化導出按鈕事件
        document.getElementById('exportBtn').addEventListener('click', () => {
            document.getElementById('exportModal').style.display = 'block';
        });

        const exportModal = document.getElementById('exportModal');
        exportModal.querySelector('.close').addEventListener('click', () => {
            exportModal.style.display = 'none';
        });

        // 添加導出選項點擊事件
        document.querySelectorAll('.export-option').forEach(option => {
            option.addEventListener('click', () => {
                const type = option.dataset.type;
                this.exportData(type);
                exportModal.style.display = 'none';
            });
        });
    }

    exportData(type) {
        switch (type) {
            case 'salary':
                this.exportSalaryDetails();
                break;
            case 'hours':
                this.exportHoursDetails();
                break;
            case 'calendar':
                this.exportCalendarImage();
                break;
            case 'csv':
                this.exportFullData();
                break;
        }
    }

    exportSalaryDetails() {
        // 獲取當月記錄
        const records = this.getMonthlyRecords();
        
        // 創建CSV內容
        let csvContent = '日期,工作時間,休息時間,工作時數,薪資類型,金額\n';
        records.forEach(record => {
            csvContent += `${record.date},${record.startTime}-${record.endTime},${record.breakTime}分鐘,${record.hours}小時,`;
            csvContent += `${record.salaryType === 'custom' ? '自訂薪水' : '時薪計算'},NT$ ${record.salary}\n`;
        });

        // 下載CSV文件
        this.downloadFile(csvContent, '薪資明細.csv');
    }

    exportHoursDetails() {
        const records = this.getMonthlyRecords();
        
        let csvContent = '日期,上班時間,下班時間,休息時間,實際工作時數\n';
        records.forEach(record => {
            csvContent += `${record.date},${record.startTime},${record.endTime},${record.breakTime}分鐘,${record.hours}小時\n`;
        });

        this.downloadFile(csvContent, '工時明細.csv');
    }

    exportCalendarImage() {
        // 使用html2canvas將日曆轉換為圖片，增加品質設定
        const calendar = document.querySelector('.calendar');
        const options = {
            scale: 3,  // 提高解析度
            useCORS: true,  // 允許跨域圖片
            allowTaint: true,  // 允許污染
            backgroundColor: '#ffffff',  // 設定背景色
            logging: false,  // 關閉日誌
            imageTimeout: 0,  // 取消圖片載入超時
            removeContainer: true  // 移除臨時容器
        };

        html2canvas(calendar, options).then(canvas => {
            // 將圖片轉換為更高品質的PNG
            const link = document.createElement('a');
            link.download = `工作日曆_${this.currentYear}年${this.currentMonth + 1}月.png`;
            link.href = canvas.toDataURL('image/png', 1.0);  // 使用最高品質
            link.click();
        });
    }

    exportFullData() {
        // 獲取所有資料
        const allData = Object.entries(this.scheduleData).map(([date, data]) => {
            const [year, month, day] = date.split('-');
            
            // 計算工作時數和薪資
            let hours = 0;
            let salary = 0;
            
            if (data.type === 'work') {
                const [startHour, startMinute] = data.startTime.split(':').map(Number);
                const [endHour, endMinute] = data.endTime.split(':').map(Number);
                const breakTime = parseInt(data.breakTime);
                
                const minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute) - breakTime;
                hours = (minutes / 60).toFixed(1);
                
                if (data.salaryType === 'custom' && data.customSalary) {
                    salary = parseInt(data.customSalary);
                } else {
                    const hourlyRate = parseFloat(document.getElementById('hourlyRate').value) || 0;
                    salary = Math.round(hours * hourlyRate);
                }
            }

            return {
                date,
                year,
                month,
                day,
                type: data.type || 'work',
                startTime: data.startTime || '',
                endTime: data.endTime || '',
                breakTime: data.breakTime || '',
                hours,
                salary,
                shiftColor: data.shiftColor || '',
                salaryType: data.salaryType || 'hourly',
                customSalary: data.customSalary || ''
            };
        });

        // 按日期排序
        allData.sort((a, b) => a.date.localeCompare(b.date));

        // 計算總計
        const totalWorkDays = allData.filter(d => d.type === 'work').length;
        const totalOffDays = allData.filter(d => d.type === 'off').length;
        const totalHours = allData.reduce((sum, d) => sum + parseFloat(d.hours || 0), 0).toFixed(1);
        const totalSalary = allData.reduce((sum, d) => sum + (d.salary || 0), 0);
        const hourlyRate = parseFloat(document.getElementById('hourlyRate').value) || 0;

        // 創建 CSV 內容
        let csvContent = '班表完整資料\n';
        csvContent += `匯出時間,${new Date().toLocaleString()}\n`;
        csvContent += `基本時薪,NT$ ${hourlyRate}\n`;
        csvContent += `總工作天數,${totalWorkDays} 天\n`;
        csvContent += `總休假天數,${totalOffDays} 天\n`;
        csvContent += `總工作時數,${totalHours} 小時\n`;
        csvContent += `總薪資,NT$ ${totalSalary.toLocaleString()}\n\n`;
        
        csvContent += '詳細記錄\n';
        csvContent += '日期,年,月,日,類型,上班時間,下班時間,休息時間,工作時數,薪資,顏色,薪資類型,自訂薪資\n';
        allData.forEach(record => {
            csvContent += `${record.date},${record.year},${record.month},${record.day},`;
            csvContent += `${record.type},${record.startTime},${record.endTime},${record.breakTime},`;
            csvContent += `${record.hours},NT$ ${record.salary || 0},`;
            csvContent += `${record.shiftColor},${record.salaryType},${record.customSalary}\n`;
        });

        // 下載 CSV 文件
        this.downloadFile(csvContent, `班表完整資料_${this.currentYear}年${this.currentMonth + 1}月.csv`);
    }

    getMonthlyRecords() {
        const records = [];
        Object.entries(this.scheduleData).forEach(([date, data]) => {
            const [year, month, day] = date.split('-').map(Number);
            if (year === this.currentYear && month === this.currentMonth + 1) {
                const [startHour, startMinute] = data.startTime.split(':').map(Number);
                const [endHour, endMinute] = data.endTime.split(':').map(Number);
                const breakTime = parseInt(data.breakTime);
                
                let minutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute) - breakTime;
                const hours = (minutes / 60).toFixed(1);

                let salary;
                if (data.salaryType === 'custom' && data.customSalary) {
                    salary = parseInt(data.customSalary);
                } else {
                    const hourlyRate = parseFloat(document.getElementById('hourlyRate').value) || 0;
                    salary = Math.round(hours * hourlyRate);
                }

                records.push({
                    date: `${year}/${month}/${day}`,
                    startTime: data.startTime,
                    endTime: data.endTime,
                    breakTime: data.breakTime,
                    hours,
                    salary,
                    salaryType: data.salaryType
                });
            }
        });

        return records.sort((a, b) => {
            const [aYear, aMonth, aDay] = a.date.split('/').map(Number);
            const [bYear, bMonth, bDay] = b.date.split('/').map(Number);
            return new Date(aYear, aMonth - 1, aDay) - new Date(bYear, bMonth - 1, bDay);
        });
    }

    downloadFile(content, filename) {
        const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    initializeShiftType() {
        const shiftTypeSelect = document.getElementById('shiftType');
        const workTimeInputs = document.getElementById('workTimeInputs');
        
        shiftTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'off') {
                workTimeInputs.style.display = 'none';
            } else {
                workTimeInputs.style.display = 'block';
            }
        });
    }
}

// 初始化日曆
document.addEventListener('DOMContentLoaded', () => {
    new Calendar();
}); 
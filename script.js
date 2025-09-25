nt. class CoffeeLogger {
            constructor() {
                this.records = this.loadRecords();
                this.beans = this.loadBeans();
                this.methods = this.loadMethods();
                this.satisfactionChartInstance = null;
                this.beanChartInstance = null;
                this.radarChartInstances = {};
                this.ratings = { satisfaction: 0, aroma: 0, acidity: 0, sweetness: 0, bitterness: 0, body: 0, aftertaste: 0 };
                this.sortConfig = { key: 'date', direction: 'desc' };
                this.dripTimer = { interval: null, startTime: 0, elapsedTime: 0, running: false };
                this.initializeApp();
            }

            // --- Local Storage Handlers ---
            loadRecords() { return JSON.parse(localStorage.getItem('coffee-records-v2')) || []; }
            saveRecords() { localStorage.setItem('coffee-records-v2', JSON.stringify(this.records)); }
            loadBeans() { return JSON.parse(localStorage.getItem('coffee-beans-v2')) || []; }
            saveBeans() { localStorage.setItem('coffee-beans-v2', JSON.stringify(this.beans)); }
            loadMethods() { return JSON.parse(localStorage.getItem('coffee-methods-v2')) || []; }
            saveMethods() { localStorage.setItem('coffee-methods-v2', JSON.stringify(this.methods)); }
            
            initializeApp() {
                this.updateTodayDate();
                this.updateSummaryStats();
                this.setupEventListeners();
                this.updateHistoryDisplay();
                this.updateBeanManagementUI();
                this.updateBeanSelectionDropdown();
                this.updateMethodManagementUI();
                this.updateMethodSelectionDropdown();
                this.updateTasteChartFilter();
                this.generateAnalytics();
                this.renderRadarCharts();
                this.setDefaultBrewDateTime();
                this.addMethodStep(true);
            }
           
            setupEventListeners() {
                document.querySelectorAll('.stars').forEach(container => {
                    container.addEventListener('click', e => {
                        if (e.target.classList.contains('star')) {
                            this.setRating(container.dataset.rating, parseInt(e.target.dataset.value));
                        }
                    });
                    container.addEventListener('mouseover', e => {
                        if (e.target.classList.contains('star')) {
                            const stars = container.querySelectorAll('.star');
                            const rating = parseInt(e.target.dataset.value);
                            stars.forEach((star, i) => star.classList.toggle('hover', i < rating));
                        }
                    });
                    container.addEventListener('mouseleave', () => {
                        container.querySelectorAll('.star').forEach(s => s.classList.remove('hover'));
                    });
                });

                const roastDateInput = document.getElementById('roast-date');
                const roastDateUnknown = document.getElementById('roast-date-unknown');
                roastDateUnknown.addEventListener('change', () => {
                    roastDateInput.disabled = roastDateUnknown.checked;
                    if (roastDateUnknown.checked) roastDateInput.value = '';
                });

                document.getElementById('bean-weight').addEventListener('input', () => this.calculateBrewRatios());
                document.getElementById('brew-ratio').addEventListener('input', () => this.calculateBrewRatios());
                document.getElementById('water-weight').addEventListener('input', () => this.calculateBrewRatios());

                document.getElementById('extraction-method').addEventListener('change', (e) => {
                    document.getElementById('drip-timer-btn').disabled = !e.target.value;
                });
            }
            
            updateTodayDate() {
                const today = new Date();
                const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
                document.getElementById('today-date').textContent = today.toLocaleDateString('ja-JP', options);
            }

            updateSummaryStats() {
                const todayStr = new Date().toISOString().split('T')[0];
                const todayRecords = this.records.filter(r => r.date.startsWith(todayStr));
                document.getElementById('today-count').textContent = todayRecords.length;
                if (todayRecords.length > 0) {
                    const avg = todayRecords.reduce((sum, r) => sum + r.ratings.satisfaction, 0) / todayRecords.length;
                    document.getElementById('avg-satisfaction').textContent = avg.toFixed(1);
                } else {
                    document.getElementById('avg-satisfaction').textContent = '-';
                }
                document.getElementById('streak-days').textContent = this.calculateStreak();
            }

            calculateStreak() {
                const dates = [...new Set(this.records.map(r => r.date.split('T')[0]))].sort().reverse();
                if (dates.length === 0) return 0;
                let streak = 0;
                const today = new Date();
                today.setHours(0,0,0,0);

                const firstRecordDate = new Date(dates[0]);
                firstRecordDate.setHours(0,0,0,0);
                
                const dayDiff = (today - firstRecordDate) / (1000 * 60 * 60 * 24);
                if (dayDiff > 1) return 0;
                if (dayDiff === 0 || dayDiff === 1) streak = 1;
                
                for (let i = 0; i < dates.length - 1; i++) {
                    const current = new Date(dates[i]);
                    const next = new Date(dates[i+1]);
                    const diff = (current - next) / (1000 * 60 * 60 * 24);
                    if (diff === 1) {
                        streak++;
                    } else {
                        break;
                    }
                }
                return streak;
            }

            setRating(type, value) {
                this.ratings[type] = value;
                const stars = document.querySelectorAll(`[data-rating="${type}"] .star`);
                stars.forEach((star, index) => star.classList.toggle('active', index < value));
            }

            // --- Bean Management ---
            updateBeanManagementUI() {
                const container = document.getElementById('bean-list-container');
                container.innerHTML = '';
                if (this.beans.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: #666;">まだ豆が登録されていません。</p>';
                    return;
                }
                this.beans.forEach((bean, index) => {
                    const item = document.createElement('div');
                    item.className = 'bean-item';
                    item.innerHTML = `
                        <div>
                            <span><strong>${bean.name}</strong></span>
                            <div class="bean-item-details">
                                ${bean.storeName || 'お店不明'} / ${bean.roastLevel || '焙煎度不明'}
                            </div>
                        </div>
                        <div class="btn-group" style="gap: 5px;">
                            <button class="btn btn-secondary btn-small" onclick="showBeanDetails(${index})">詳細</button>
                            <button class="btn btn-secondary btn-small" onclick="editBean(${index})">編集</button>
                            <button class="btn-danger btn-small" onclick="deleteBean(${index})">削除</button>
                        </div>
                    `;
                    container.appendChild(item);
                });
            }

            updateBeanSelectionDropdown() {
                const select = document.getElementById('bean-type');
                select.innerHTML = '';
                if (this.beans.length === 0) {
                    select.innerHTML = '<option disabled selected>先に設定タブで豆を登録してください</option>';
                    return;
                }
                this.beans.forEach(bean => {
                    const option = document.createElement('option');
                    option.value = bean.name;
                    option.textContent = bean.name;
                    select.appendChild(option);
                });
            }

            addOrUpdateBean() {
                const name = document.getElementById('new-bean-name').value.trim();
                if (!name) {
                    this.showNotification('⚠️ 豆の名前を入力してください', 'warning');
                    return;
                }
                
                const beanData = {
                    name,
                    url: document.getElementById('bean-url').value,
                    storeName: document.getElementById('store-name').value,
                    storeUrl: document.getElementById('store-url').value,
                    roastLevel: document.getElementById('roast-level').value,
                    roastDate: document.getElementById('roast-date-unknown').checked ? '不明' : document.getElementById('roast-date').value,
                    purchaseType: document.getElementById('purchase-type').value,
                    price: parseInt(document.getElementById('price').value) || null,
                    weight: parseInt(document.getElementById('purchase-weight').value) || null,
                    purchaseDate: document.getElementById('purchase-date').value,
                };
                
                const editingIndex = document.getElementById('editing-bean-index').value;
                if (editingIndex) {
                    this.beans[editingIndex] = beanData;
                    this.showNotification('✅ 豆の情報を更新しました');
                } else {
                    if (this.beans.some(b => b.name === name)) {
                        this.showNotification('⚠️ 同じ名前の豆が既に存在します', 'warning');
                        return;
                    }
                    this.beans.push(beanData);
                    this.showNotification('✅ 新しい豆を登録しました');
                }

                this.saveBeans();
                this.updateBeanManagementUI();
                this.updateBeanSelectionDropdown();
                this.updateTasteChartFilter();
                this.cancelEditBean(); // Reset form
            }

            editBean(index) {
                const bean = this.beans[index];
                if (!bean) return;

                document.getElementById('editing-bean-index').value = index;
                document.getElementById('new-bean-name').value = bean.name;
                document.getElementById('bean-url').value = bean.url || '';
                document.getElementById('store-name').value = bean.storeName || '';
                document.getElementById('store-url').value = bean.storeUrl || '';
                document.getElementById('roast-level').value = bean.roastLevel || 'シティ';
                document.getElementById('roast-date-unknown').checked = bean.roastDate === '不明';
                document.getElementById('roast-date').disabled = bean.roastDate === '不明';
                document.getElementById('roast-date').value = bean.roastDate !== '不明' ? bean.roastDate : '';
                document.getElementById('purchase-type').value = bean.purchaseType || '豆';
                document.getElementById('price').value = bean.price || '';
                document.getElementById('purchase-weight').value = bean.weight || '';
                document.getElementById('purchase-date').value = bean.purchaseDate || '';

                const btnContainer = document.getElementById('bean-form-buttons');
                btnContainer.innerHTML = `
                    <button class="btn btn-primary" onclick="addOrUpdateBean()">💾 更新を保存</button>
                    <button class="btn btn-secondary" onclick="cancelEditBean()">キャンセル</button>
                `;
                document.getElementById('new-bean-name').focus();
            }

            cancelEditBean() {
                document.getElementById('editing-bean-index').value = '';
                document.getElementById('new-bean-name').value = '';
                document.getElementById('bean-url').value = '';
                document.getElementById('store-name').value = '';
                document.getElementById('store-url').value = '';
                document.getElementById('roast-level').selectedIndex = 4;
                document.getElementById('roast-date-unknown').checked = false;
                document.getElementById('roast-date').disabled = false;
                document.getElementById('roast-date').value = '';
                document.getElementById('purchase-type').selectedIndex = 0;
                document.getElementById('price').value = '';
                document.getElementById('purchase-weight').value = '';
                document.getElementById('purchase-date').value = '';

                const btnContainer = document.getElementById('bean-form-buttons');
                btnContainer.innerHTML = `<button class="btn btn-primary" onclick="addOrUpdateBean()">＋ 豆を登録</button>`;
            }

            deleteBean(index) {
                const beanName = this.beans[index].name;
                if (confirm(`「${beanName}」を本当に削除しますか？`)) {
                    this.beans.splice(index, 1);
                    this.saveBeans();
                    this.updateBeanManagementUI();
                    this.updateBeanSelectionDropdown();
                    this.updateTasteChartFilter();
                    this.renderRadarCharts(); 
                    this.showNotification(`🗑️「${beanName}」を削除しました`);
                }
            }

            // --- Core Logic ---
            handleSaveClick() {
                const editingId = document.getElementById('editing-record-id').value;
                if (editingId) {
                    this.updateRecord(editingId);
                } else {
                    this.saveRecord();
                }
            }
            
            saveRecord() {
                const record = this.getCurrentRecipe();
                if (!this.validateRecord(record)) return;

                this.records.unshift(record);
                this.saveRecords();
                
                this.updateSummaryStats();
                this.updateHistoryDisplay();
                this.generateAnalytics();
                this.renderRadarCharts();
                this.resetForm();
                this.showNotification('✅ 記録を保存しました！');
            }
            
            updateRecord(recordId) {
                const recordIndex = this.records.findIndex(r => r.date === recordId);
                if (recordIndex === -1) return;

                const updatedRecord = this.getCurrentRecipe(recordId);
                if (!this.validateRecord(updatedRecord)) return;
                
                this.records[recordIndex] = updatedRecord;
                this.saveRecords();
                
                this.updateSummaryStats();
                this.updateHistoryDisplay();
                this.generateAnalytics();
                this.renderRadarCharts();
                this.resetForm();
                hideModal();
                this.showNotification('✅ 記録を更新しました！');
            }

            deleteRecord(recordDate) {
                if (confirm('この記録を本当に削除しますか？')) {
                    const recordIndex = this.records.findIndex(r => r.date === recordDate);
                    if (recordIndex > -1) {
                        this.records.splice(recordIndex, 1);
                        this.saveRecords();
                        this.updateHistoryDisplay();
                        this.updateSummaryStats();
                        this.generateAnalytics();
                        this.renderRadarCharts();
                        this.showNotification('🗑️ 記録を削除しました');
                    }
                }
            }

            validateRecord(record) {
                const r = record.recipe;
                if (!r.beanType) { this.showNotification('⚠️ 豆の種類を選択してください', 'warning'); return false; }
                if (isNaN(r.beanWeight) || r.beanWeight <= 0) { this.showNotification('⚠️ 豆の量を正しく入力してください', 'warning'); return false; }
                if (isNaN(r.waterWeight) || r.waterWeight <= 0) { this.showNotification('⚠️ お湯の量を正しく入力してください', 'warning'); return false; }
                if (isNaN(r.waterTemperature) || r.waterTemperature <= 0) { this.showNotification('⚠️ 湯温を正しく入力してください', 'warning'); return false; }
                if (record.ratings.satisfaction === 0) { this.showNotification('⚠️ 総合満足度を評価してください', 'warning'); return false; }
                return true;
            }
            
            getCurrentRecipe(originalDate = null) {
                const brewDatetime = document.getElementById('brew-datetime').value;
                const brewDate = brewDatetime ? new Date(brewDatetime) : new Date();

                return {
                    recipe: {
                        beanType: document.getElementById('bean-type').value,
                        beanWeight: parseFloat(document.getElementById('bean-weight').value),
                        brewRatio: parseFloat(document.getElementById('brew-ratio').value),
                        grindSize: document.getElementById('grind-size').value,
                        dripper: document.getElementById('dripper').value,
                        waterWeight: parseFloat(document.getElementById('water-weight').value),
                        waterTemperature: parseInt(document.getElementById('water-temperature').value, 10),
                        extractionMethod: document.getElementById('extraction-method').value
                    },
                    details: {
                        theme: document.getElementById('theme').value,
                        summary: document.getElementById('summary').value,
                    },
                    ratings: { ...this.ratings },
                    date: originalDate || brewDate.toISOString()
                };
            }
            
            applyRecipeToForm(record) {
                this.setDateTimeInputValue('brew-datetime', new Date(record.date));
                
                document.getElementById('bean-type').value = record.recipe.beanType || '';
                document.getElementById('bean-weight').value = record.recipe.beanWeight || '';
                document.getElementById('brew-ratio').value = record.recipe.brewRatio || '';
                document.getElementById('grind-size').value = record.recipe.grindSize || '';
                document.getElementById('dripper').value = record.recipe.dripper || '';
                document.getElementById('water-weight').value = record.recipe.waterWeight || '';
                document.getElementById('water-temperature').value = record.recipe.waterTemperature || '';
                document.getElementById('extraction-method').value = record.recipe.extractionMethod || '';
                document.getElementById('theme').value = record.details.theme || '';
                document.getElementById('summary').value = record.details.summary || '';
                 
                Object.keys(this.ratings).forEach(key => {
                    this.setRating(key, record.ratings[key] || 0);
                });

                this.calculateBrewRatios();
            }

            resetForm() {
                const form = document.getElementById('record');
                form.querySelectorAll('input, textarea, select').forEach(el => {
                    if (el.type === 'button' || el.type === 'submit' || el.type === 'hidden' || el.id === 'brew-datetime') return;
                    if (el.tagName === 'SELECT') {
                        if (el.id !== 'bean-type' && el.id !== 'extraction-method') {
                           el.selectedIndex = (el.id === 'grind-size') ? 3 : 0;
                       }
                   } else if (el.type !== 'range') {
                       el.value = '';
                   }
                });
                Object.keys(this.ratings).forEach(key => this.setRating(key, 0));
                document.getElementById('editing-record-id').value = '';
                document.getElementById('save-btn').textContent = '💾 記録を保存';
                this.setDefaultBrewDateTime();
            }
            
            setDefaultBrewDateTime() {
                this.setDateTimeInputValue('brew-datetime', new Date());
            }

            setDateTimeInputValue(elementId, date) {
                const el = document.getElementById(elementId);
                if (!el) return;
                const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
                el.value = localDate.toISOString().slice(0, 16);
            }
             
            calculateBrewRatios() {
                const beanWeightEl = document.getElementById('bean-weight');
                const ratioEl = document.getElementById('brew-ratio');
                const waterWeightEl = document.getElementById('water-weight');

                const beanWeight = parseFloat(beanWeightEl.value);
                const ratio = parseFloat(ratioEl.value);
                const waterWeight = parseFloat(waterWeightEl.value);

                const focusedElId = document.activeElement.id;

                if (!ratio) return;

                if ( (focusedElId === 'bean-weight' || focusedElId === 'brew-ratio') && beanWeight) {
                    waterWeightEl.value = (beanWeight * ratio).toFixed(1);
                } else if (focusedElId === 'water-weight' && waterWeight) {
                    beanWeightEl.value = (waterWeight / ratio).toFixed(1);
                }
            }
            
            // --- Analytics & Charting ---
            generateAnalytics() { this.updateSatisfactionChart(); this.updateBeanChart(); this.updateBestRecipe(); }
            updateSatisfactionChart() { const ctx = document.getElementById('satisfactionChart').getContext('2d'); if (this.satisfactionChartInstance) this.satisfactionChartInstance.destroy(); const last30Days = Array.from({length: 30}).map((_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toISOString().split('T')[0]; }).reverse(); const satisfactionData = last30Days.map(date => { const dayRecords = this.records.filter(r => r.date.startsWith(date)); if (dayRecords.length === 0) return null; return dayRecords.reduce((sum, r) => sum + r.ratings.satisfaction, 0) / dayRecords.length; }); this.satisfactionChartInstance = new Chart(ctx, { type: 'line', data: { labels: last30Days.map(date => new Date(date).toLocaleDateString('ja-JP', {month: 'short', day: 'numeric'})), datasets: [{ label: '満足度', data: satisfactionData, borderColor: '#8B4513', backgroundColor: 'rgba(139, 69, 19, 0.1)', tension: 0.4, fill: true }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 5, ticks: { stepSize: 1 }}}, plugins: { legend: { display: false }}} }); }
            updateBeanChart() { const ctx = document.getElementById('beanChart').getContext('2d'); if (this.beanChartInstance) this.beanChartInstance.destroy(); const beanStats = this.records.reduce((acc, record) => { if (!record.recipe || !record.recipe.beanType) return acc; const beanType = record.recipe.beanType; if (!acc[beanType]) acc[beanType] = { count: 0, total: 0 }; acc[beanType].count++; acc[beanType].total += record.ratings.satisfaction; return acc; }, {}); const labels = Object.keys(beanStats); const avgRatings = labels.map(bean => beanStats[bean].total / beanStats[bean].count); this.beanChartInstance = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: '平均満足度', data: avgRatings, backgroundColor: ['#8B4513', '#D2691E', '#CD853F', '#DEB887', '#F4A460', '#D2B48C', '#BC8F8F', '#A0522D'] }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 5 }}, plugins: { legend: { display: false }}} }); }
            updateBestRecipe() { const container = document.getElementById('best-recipe'); const bestRecipe = [...this.records].filter(r => r.ratings && r.ratings.satisfaction >= 4).sort((a, b) => b.ratings.satisfaction - a.ratings.satisfaction)[0]; if (!bestRecipe || !bestRecipe.recipe) { container.innerHTML = '<p>満足度4以上の記録なし</p>'; return; } container.innerHTML = `<div style="background: linear-gradient(135deg, #FFD700, #FFA500); padding: 20px; border-radius: 10px; color: white;"><h4>🏆 ${bestRecipe.recipe.beanType}</h4><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-top: 15px;"><div><strong>豆量:</strong> ${bestRecipe.recipe.beanWeight}g</div><div><strong>湯量:</strong> ${bestRecipe.recipe.waterWeight}g</div><div><strong>温度:</strong> ${bestRecipe.recipe.waterTemperature}°C</div><div><strong>メソッド:</strong> ${bestRecipe.recipe.extractionMethod}</div></div><div style="margin-top: 15px;"><strong>満足度:</strong> ${'★'.repeat(bestRecipe.ratings.satisfaction)}${'☆'.repeat(5 - bestRecipe.ratings.satisfaction)}</div><button onclick="applyRecipeById('${bestRecipe.date}')" style="margin-top: 15px; padding: 8px 16px; border: none; border-radius: 5px; background: rgba(255,255,255,0.3); color: white; cursor: pointer;">このレシピを適用</button></div>`; }
            
            updateTasteChartFilter() {
                const container = document.getElementById('taste-chart-filter-container');
                container.innerHTML = '';
                if (this.beans.length === 0) {
                    container.innerHTML = '<p>先に設定タブで豆を登録してください。</p>';
                    return;
                }
                this.beans.forEach(bean => {
                    const item = document.createElement('div');
                    item.className = 'filter-item';
                    item.innerHTML = `
                        <input type="checkbox" id="filter-${bean.name}" value="${bean.name}" checked onchange="coffeeLogger.renderRadarCharts()">
                        <label for="filter-${bean.name}">${bean.name}</label>
                    `;
                    container.appendChild(item);
                });
            }
            
            renderRadarCharts() {
                const container = document.getElementById('taste-charts-container');
                container.innerHTML = '';
                
                Object.values(this.radarChartInstances).forEach(chart => chart.destroy());
                this.radarChartInstances = {};

                const selectedBeans = Array.from(document.querySelectorAll('#taste-chart-filter-container input:checked')).map(cb => cb.value);
                const filteredRecords = this.records
                    .filter(r => selectedBeans.includes(r.recipe.beanType) && r.ratings.aroma > 0)
                    .sort((a, b) => new Date(b.date) - new Date(a.date));

                if (filteredRecords.length === 0) {
                    container.innerHTML = '<p>表示できる記録がありません。評価を記録してみましょう！</p>';
                    return;
                }

                filteredRecords.forEach(record => {
                    const chartId = `radar-${record.date}`;
                    const item = document.createElement('div');
                    item.className = 'taste-chart-item';
                    const recordDate = new Date(record.date).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    item.innerHTML = `
                        <h4>${record.recipe.beanType}</h4>
                        <p style="text-align:center; font-size: 0.8rem; margin-top: -10px; margin-bottom: 10px;">${recordDate}</p>
                        <canvas id="${chartId}"></canvas>
                    `;
                    container.appendChild(item);

                    const ctx = document.getElementById(chartId).getContext('2d');
                    const ratings = record.ratings;
                    const chartData = [
                        ratings.aroma, ratings.acidity, ratings.sweetness,
                        ratings.bitterness, ratings.body, ratings.aftertaste
                    ];

                    this.radarChartInstances[chartId] = new Chart(ctx, {
                        type: 'radar',
                        data: {
                            labels: ['香り', '酸味', '甘さ', '苦み', 'ボディ', '余韻'],
                            datasets: [{
                                label: record.recipe.beanType,
                                data: chartData,
                                backgroundColor: 'rgba(139, 69, 19, 0.2)',
                                borderColor: 'rgba(139, 69, 19, 1)',
                                borderWidth: 2,
                                pointBackgroundColor: 'rgba(139, 69, 19, 1)'
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: true,
                            plugins: { legend: { display: false } },
                            scale: {
                                min: 0,
                                max: 5,
                                ticks: { stepSize: 1, display: false }
                            }
                        }
                    });
                });
            }

            // --- History Tab ---
            updateHistoryDisplay() {
                const container = document.getElementById('records-list');
                const sortKey = document.getElementById('sort-by').value;
                this.sortConfig.key = sortKey;

                if (this.records.length === 0) {
                    container.innerHTML = '<p>まだ記録がありません。最初の一杯を記録してみましょう！</p>';
                    return;
                }

                const sortedRecords = [...this.records].sort((a, b) => {
                    let valA, valB;
                    switch (this.sortConfig.key) {
                        case 'satisfaction': valA = a.ratings.satisfaction; valB = b.ratings.satisfaction; break;
                        case 'beanType': valA = a.recipe.beanType; valB = b.recipe.beanType; break;
                        case 'daysSinceRoast': valA = this._getDaysSinceRoast(a.date, a.recipe.beanType) ?? -1; valB = this._getDaysSinceRoast(b.date, b.recipe.beanType) ?? -1; break;
                        default: valA = new Date(a.date); valB = new Date(b.date); break;
                    }
                    if (valA < valB) return this.sortConfig.direction === 'asc' ? -1 : 1;
                    if (valA > valB) return this.sortConfig.direction === 'asc' ? 1 : -1;
                    return 0;
                });

                container.innerHTML = sortedRecords.map(record => {
                    const date = new Date(record.date);
                    const satisfaction = '★'.repeat(record.ratings.satisfaction) + '☆'.repeat(5 - record.ratings.satisfaction);
                    const daysSinceRoast = this._getDaysSinceRoast(record.date, record.recipe.beanType);
                    
                    return `
                        <div class="record-item">
                            <div class="record-item-main">
                                <div class="record-header">
                                    <span class="record-date">${date.toLocaleString('ja-JP')}</span>
                                    <span class="record-rating">${satisfaction}</span>
                                </div>
                                <div class="record-details">
                                    <p><strong>豆:</strong> ${record.recipe.beanType}</p>
                                    <p><strong>レシピ:</strong> ${record.recipe.beanWeight}g / ${record.recipe.waterWeight}g / ${record.recipe.waterTemperature}°C</p>
                                </div>
                                <div class="record-details">
                                <p><strong>焙煎後:</strong> ${daysSinceRoast !== null ? `${daysSinceRoast}日` : '不明'}</p>
                                <p><strong>メソッド:</strong> ${record.recipe.extractionMethod}</p>
                                </div>
                            </div>
                            <div class="record-item-actions btn-group" style="flex-direction: row; align-items: center; justify-content: center; gap: 5px;">
                                <button class="btn btn-secondary btn-small" onclick="showRecordDetails('${record.date}')">詳細</button>
                                <button class="btn btn-secondary btn-small" onclick="editRecordFromHistory('${record.date}')">編集</button>
                                <button class="btn-danger btn-small" onclick="deleteRecord('${record.date}')">削除</button>
                            </div>
                        </div>`;
                }).join('');
            }

            toggleSortDirection() {
                this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
                document.getElementById('sort-direction-btn').textContent = this.sortConfig.direction === 'asc' ? '昇順' : '降順';
                this.updateHistoryDisplay();
            }

            _getDaysSinceRoast(recordDate, beanName) {
                const bean = this.beans.find(b => b.name === beanName);
                if (!bean || !bean.roastDate || bean.roastDate === '不明') return null;
                const roastDate = new Date(bean.roastDate);
                const brewDate = new Date(recordDate);
                const diffTime = Math.abs(brewDate - roastDate);
                return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }
        
            // --- Method Management & Timer ---
            updateMethodManagementUI() {
                const container = document.getElementById('method-list-container');
                container.innerHTML = '';
                if (this.methods.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: #666;">登録されたメソッドはありません。</p>';
                    return;
                }
                this.methods.forEach((method, index) => {
                    const item = document.createElement('div');
                    item.className = 'method-item';
                    const totalTime = method.totalTime;
                    item.innerHTML = `
                        <div>
                            <span>${method.name}</span>
                            <div class="method-item-details">
                                ${method.steps.length}手順 / ${Math.floor(totalTime / 60)}分${totalTime % 60}秒
                            </div>
                        </div>
                        <button class="btn-danger" onclick="deleteMethod(${index})">削除</button>
                    `;
                    container.appendChild(item);
                });
            }

            updateMethodSelectionDropdown() {
                const select = document.getElementById('extraction-method');
                select.innerHTML = '<option value="">メソッドを選択...</option>';
                if (this.methods.length === 0) {
                    select.insertAdjacentHTML('beforeend', '<option value="" disabled>先にメソッドを登録してください</option>');
                    document.getElementById('drip-timer-btn').disabled = true;
                    return;
                }
                this.methods.forEach(method => {
                    const option = document.createElement('option');
                    option.value = method.name;
                    option.textContent = method.name;
                    select.appendChild(option);
                });
            }

            addMethodStep(isInitial = false) {
                const container = document.getElementById('method-steps-container');
                const stepElement = document.createElement('div');
                stepElement.className = 'method-step';
                const isFirstStep = container.children.length === 0;

                stepElement.innerHTML = `
                    <select class="form-control" ${isFirstStep ? 'disabled' : ''}>
                        ${isFirstStep ? '<option>蒸らす</option>' : `
                        <option value="円を描くように注ぐ">円を描くように注ぐ</option>
                        <option value="カップを揺らす">カップを揺らす</option>
                        <option value="待つ">待つ</option>
                        <option value="かき混ぜる">かき混ぜる</option>
                        `}
                    </select>
                    <div class="time-input-group" ${isFirstStep ? 'style="visibility: hidden;"' : ''}>
                        <input type="number" class="form-control" placeholder="分" min="0" ${isFirstStep ? 'value="0" disabled' : ''}>
                        <span>:</span>
                        <input type="number" class="form-control" placeholder="秒" min="0" max="59" ${isFirstStep ? 'value="0" disabled' : ''}>
                    </div>
                    <input type="number" class="form-control" placeholder="${isFirstStep ? 'お湯の量(g)' : '累計湯量(g)'}">
                    ${isFirstStep ? '<span></span>' : '<button class="btn-danger btn-small" onclick="removeMethodStep(this)">×</button>'}
                `;
                container.appendChild(stepElement);
            }
            
            removeMethodStep(button) {
                button.parentElement.remove();
            }

            saveMethod() {
                const name = document.getElementById('new-method-name').value.trim();
                if (!name) { this.showNotification('⚠️ メソッド名を入力してください', 'warning'); return; }
                if (this.methods.some(m => m.name === name)) { this.showNotification('⚠️ 同じ名前のメソッドが既に存在します', 'warning'); return; }
                
                const steps = [];
                document.querySelectorAll('#method-steps-container .method-step').forEach((stepEl, index) => {
                    const inputs = stepEl.querySelectorAll('input');
                    const isFirstStep = index === 0;
                    steps.push({
                        action: stepEl.querySelector('select').value,
                        minutes: isFirstStep ? 0 : parseInt(inputs[0].value) || 0,
                        seconds: isFirstStep ? 0 : parseInt(inputs[1].value) || 0,
                        waterAmount: parseFloat(inputs[isFirstStep ? 0 : 2].value) || null
                    });
                });

                if (steps.length === 0) { this.showNotification('⚠️ 少なくとも1つの手順を追加してください', 'warning'); return; }
                const totalTimeMin = parseInt(document.getElementById('method-total-time-min').value) || 0;
                const totalTimeSec = parseInt(document.getElementById('method-total-time-sec').value) || 0;

                this.methods.push({ name, steps, totalTime: (totalTimeMin * 60) + totalTimeSec });
                this.saveMethods();
                this.updateMethodManagementUI();
                this.updateMethodSelectionDropdown();

                document.getElementById('new-method-name').value = '';
                document.getElementById('method-steps-container').innerHTML = '';
                this.addMethodStep(true);
                document.getElementById('method-total-time-min').value = '';
                document.getElementById('method-total-time-sec').value = '';

                this.showNotification('✅ 新しい抽出メソッドを保存しました');
            }

            deleteMethod(index) {
                const methodName = this.methods[index].name;
                if(confirm(`「${methodName}」を本当に削除しますか？`)){
                    this.methods.splice(index, 1);
                    this.saveMethods();
                    this.updateMethodManagementUI();
                    this.updateMethodSelectionDropdown();
                    this.showNotification(`🗑️「${methodName}」を削除しました`);
                }
            }
            
            startDripTimer() {
                const methodName = document.getElementById('extraction-method').value;
                const method = this.methods.find(m => m.name === methodName);
                if (!method) return;

                const stepsContainer = document.getElementById('drip-timer-steps');
                stepsContainer.innerHTML = '';
                 let cumulativeTime = 0;
                method.steps.forEach((step, index) => {
                    const stepEl = document.createElement('div');
                    stepEl.className = 'timer-step';
                    cumulativeTime += (step.minutes * 60) + step.seconds;
                    stepEl.dataset.time = cumulativeTime;

                    let text = `${index + 1}. ${step.action}`;
                    if (index > 0) text += ` @ ${step.minutes}:${String(step.seconds).padStart(2, '0')}`;
                    if (step.waterAmount) text += ` - ${step.waterAmount}g`;
                    stepEl.textContent = text;
                    stepsContainer.appendChild(stepEl);
                });
                
                const totalTimeStep = document.createElement('div');
                totalTimeStep.className = 'timer-step';
                totalTimeStep.dataset.time = method.totalTime;
                totalTimeStep.textContent = `🏁 完了: ${Math.floor(method.totalTime / 60)}:${String(method.totalTime % 60).padStart(2, '0')}`;
                stepsContainer.appendChild(totalTimeStep);

                this.resetDripTimer();
                document.getElementById('drip-timer-modal').style.display = 'block';
            }

            hideDripTimer() {
                this.toggleDripTimer(true);
                document.getElementById('drip-timer-modal').style.display = 'none';
            }

            toggleDripTimer(forceStop = false) {
                const btn = document.getElementById('drip-timer-start-stop');
                if (this.dripTimer.running && !forceStop) {
                    this.dripTimer.running = false;
                    clearInterval(this.dripTimer.interval);
                    this.dripTimer.elapsedTime += Date.now() - this.dripTimer.startTime;
                    btn.textContent = 'スタート';
                    btn.classList.remove('btn-danger');
                } else if (!this.dripTimer.running && !forceStop) {
                    this.dripTimer.running = true;
                    this.dripTimer.startTime = Date.now();
                    this.dripTimer.interval = setInterval(() => this._updateDripTimerDisplay(), 100);
                    btn.textContent = 'ストップ';
                    btn.classList.add('btn-danger');
                } else if (forceStop) {
                     this.dripTimer.running = false;
                    clearInterval(this.dripTimer.interval);
                }
            }
            
            _updateDripTimerDisplay() {
                const now = Date.now();
                const totalElapsed = this.dripTimer.elapsedTime + (now - this.dripTimer.startTime);
                const secondsFloat = totalElapsed / 1000;
                const secondsInt = Math.floor(secondsFloat);
                const minutes = Math.floor(secondsInt / 60);
                const displaySeconds = secondsInt % 60;
                const tenths = Math.floor((secondsFloat * 10) % 10);
                document.getElementById('drip-timer-display').textContent = `${String(minutes).padStart(2, '0')}:${String(displaySeconds).padStart(2, '0')}.${tenths}`;

                document.querySelectorAll('#drip-timer-steps .timer-step').forEach(stepEl => stepEl.classList.remove('active'));
                const stepElements = Array.from(document.querySelectorAll('#drip-timer-steps .timer-step'));
                const currentStep = stepElements.reverse().find(stepEl => secondsFloat >= stepEl.dataset.time);
                 if (currentStep) {
                     currentStep.classList.add('active');
                 }
            }

            resetDripTimer() {
                this.dripTimer.running = false;
                clearInterval(this.dripTimer.interval);
                this.dripTimer.elapsedTime = 0;
                this.dripTimer.startTime = 0;
                document.getElementById('drip-timer-display').textContent = '00:00.0';
                const btn = document.getElementById('drip-timer-start-stop');
                btn.textContent = 'スタート';
                btn.classList.remove('btn-danger');
                document.querySelectorAll('#drip-timer-steps .timer-step').forEach(stepEl => stepEl.classList.remove('active'));
            }

            showNotification(message, type = 'success') { 
                const n = document.getElementById('notification'); 
                n.textContent = message; 
                n.className = `notification show ${type === 'warning' ? 'warning' : ''}`; 
                setTimeout(() => n.classList.remove('show'), 3000); 
            }

            // --- JSON エクスポート（ファイル保存） ---
            exportJSON() {
            const data = {
                version: 2,
                exportedAt: new Date().toISOString(),
                records: this.records,
                beans: this.beans,
                methods: this.methods
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "coffee-diary-backup.json";
            a.click();
            URL.revokeObjectURL(url);
            this.showNotification("💾 JSON を保存しました");
            }

            // --- JSON をクリップボードへ（iPhoneに優しい） ---
            async exportJSONToClipboard() {
            const data = {
                version: 2,
                exportedAt: new Date().toISOString(),
                records: this.records,
                beans: this.beans,
                methods: this.methods
            };
            const text = JSON.stringify(data, null, 2);
            try {
                await navigator.clipboard.writeText(text);
                this.showNotification("📋 JSON をクリップボードにコピーしました");
            } catch (e) {
                // クリップボード不可な環境はモーダルに貼り付けて見せる
                document.getElementById("import-data-area").value = text;
                showImportModal();
                this.showNotification("👀 テキスト欄に表示しました。ここからコピーしてください");
            }
            }

            // --- JSON インポート（モーダルのテキスト欄から） ---
            importJSONFromTextarea() {
            try {
                const text = document.getElementById("import-data-area").value.trim();
                const data = JSON.parse(text);
                if (!data.records || !data.beans || !data.methods) throw new Error("フォーマットが不正です");

                // 置き換え
                this.records = data.records;
                this.beans   = data.beans;
                this.methods = data.methods;

                // 保存
                this.saveRecords(); this.saveBeans(); this.saveMethods();

                // 再描画
                this.updateSummaryStats();
                this.updateHistoryDisplay();
                this.updateBeanManagementUI();
                this.updateBeanSelectionDropdown();
                this.updateMethodManagementUI();
                this.updateMethodSelectionDropdown();
                this.updateTasteChartFilter();
                this.generateAnalytics();
                this.renderRadarCharts();

                hideImportModal();
                this.showNotification("✅ JSON から復元しました");
            } catch (e) {
                this.showNotification("⚠️ インポート失敗: " + e.message, "warning");
            }
            }


        }

        // --- Global Helper Functions ---
        function showTab(tabName, event) {
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.nav-tab').forEach(btn => btn.classList.remove('active'));
            document.getElementById(tabName).classList.add('active');
            event.currentTarget.classList.add('active');
            if (tabName === 'analytics') setTimeout(() => coffeeLogger.generateAnalytics(), 100);
            if (tabName === 'taste-chart') setTimeout(() => coffeeLogger.renderRadarCharts(), 100);
            if (tabName === 'history') coffeeLogger.updateHistoryDisplay();
        }

        function showModal() { document.getElementById('generic-modal').style.display = 'block'; }
        function hideModal() { document.getElementById('generic-modal').style.display = 'none'; }
        
        function showBeanDetails(index) {
            const bean = coffeeLogger.beans[index];
            const contentSlot = document.getElementById('modal-content-slot');
            contentSlot.innerHTML = `
                <span class="modal-close" onclick="hideModal()">&times;</span>
                <h3>${bean.name} - 詳細</h3>
                <div class="modal-grid">
                    <p><strong>豆のURL:</strong> ${bean.url ? `<a href="${bean.url}" target="_blank">リンク</a>` : '未設定'}</p>
                    <p><strong>販売店:</strong> ${bean.storeName || '未設定'}</p>
                    <p><strong>販売店のURL:</strong> ${bean.storeUrl ? `<a href="${bean.storeUrl}" target="_blank">リンク</a>` : '未設定'}</p>
                    <p><strong>焙煎度:</strong> ${bean.roastLevel || '未設定'}</p>
                    <p><strong>焙煎日:</strong> ${bean.roastDate || '未設定'}</p>
                    <p><strong>購入形式:</strong> ${bean.purchaseType || '未設定'}</p>
                    <p><strong>価格:</strong> ${bean.price ? `${bean.price}円` : '未設定'}</p>
                    <p><strong>購入量:</strong> ${bean.weight ? `${bean.weight}g` : '未設定'}</p>
                    <p><strong>購入日:</strong> ${bean.purchaseDate || '未設定'}</p>
                </div>
            `;
            showModal();
        }

        function showRecordDetails(recordDate) {
            const record = coffeeLogger.records.find(r => r.date === recordDate);
            const contentSlot = document.getElementById('modal-content-slot');
            const ratingsHTML = Object.entries(record.ratings).map(([key, value]) => {
                const label = {satisfaction: '総合満足度', aroma: '香り', acidity: '酸味', sweetness: '甘さ', bitterness: '苦み', body: 'ボディ', aftertaste: '余韻'}[key];
                return `<p><strong>${label}:</strong> ${'★'.repeat(value)}${'☆'.repeat(5 - value)}</p>`;
            }).join('');

            contentSlot.innerHTML = `
                <span class="modal-close" onclick="hideModal()">&times;</span>
                <h3>抽出レシピ詳細</h3>
                <div class="modal-grid">
                    <fieldset>
                        <legend>抽出レシピ</legend>
                        <p><strong>抽出日時:</strong> ${new Date(record.date).toLocaleString('ja-JP')}</p>
                        <p><strong>豆の種類:</strong> ${record.recipe.beanType}</p>
                        <p><strong>豆の量:</strong> ${record.recipe.beanWeight}g</p>
                        <p><strong>比率:</strong> 1:${record.recipe.brewRatio}</p>
                        <p><strong>お湯の量:</strong> ${record.recipe.waterWeight}g</p>
                        <p><strong>挽き目:</strong> ${record.recipe.grindSize}</p>
                        <p><strong>湯温:</strong> ${record.recipe.waterTemperature}℃</p>
                        <p><strong>抽出メソッド:</strong> ${record.recipe.extractionMethod}</p>
                    </fieldset>
                    <fieldset>
                        <legend>テイスティングノート</legend>
                        ${ratingsHTML}
                    </fieldset>
                    <fieldset style="grid-column: 1 / -1;">
                        <legend>詳細</legend>
                        <p><strong>今日のテーマ:</strong> ${record.details.theme}</p>
                        <p><strong>サマリー:</strong> ${record.details.summary}</p>
                    </fieldset>
                </div>
            `;
            showModal();
        }

        function editRecordFromHistory(recordDate) {
            const record = coffeeLogger.records.find(r => r.date === recordDate);
            if (!record) return;
            coffeeLogger.applyRecipeToForm(record);
            document.getElementById('editing-record-id').value = record.date;
            document.getElementById('save-btn').textContent = '💾 記録を更新';
            showTab('record', { currentTarget: document.querySelector('.nav-tab[onclick*="record"]') });
        }
        
        function handleSaveClick() { coffeeLogger.handleSaveClick(); }
        function loadLastRecipe() { 
            const lastRecord = coffeeLogger.records[0];
            if (lastRecord) {
                coffeeLogger.applyRecipeToForm(lastRecord);
                coffeeLogger.showNotification('📋 前回のレシピを読み込みました');
            } else {
                coffeeLogger.showNotification('⚠️ 記録がまだありません', 'warning');
            }
        }
        function addOrUpdateBean() { coffeeLogger.addOrUpdateBean(); }
        function editBean(index) { coffeeLogger.editBean(index); }
        function cancelEditBean() { coffeeLogger.cancelEditBean(); }
        function deleteBean(index) { coffeeLogger.deleteBean(index); }
        function deleteRecord(recordDate) { coffeeLogger.deleteRecord(recordDate); }
        function applyRecipeById(date) {
            const record = coffeeLogger.records.find(r => r.date === date);
            if(record) coffeeLogger.applyRecipeToForm(record);
        }
        
        function addMethodStep(isInitial = false) { coffeeLogger.addMethodStep(isInitial); }
        function removeMethodStep(button) { coffeeLogger.removeMethodStep(button); }
        function saveMethod() { coffeeLogger.saveMethod(); }
        function deleteMethod(index) { coffeeLogger.deleteMethod(index); }
        function startDripTimer() { coffeeLogger.startDripTimer(); }
        function hideDripTimer() { coffeeLogger.hideDripTimer(); }
        function toggleDripTimer() { coffeeLogger.toggleDripTimer(); }
        function resetDripTimer() { coffeeLogger.resetDripTimer(); }

        let coffeeLogger;
        documeaddEventListener('DOMContentLoaded', () => { coffeeLogger = new CoffeeLogger(); });

         if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./service-worker.js').then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                }, err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
            });
        }

        function showImportModal(){
        document.getElementById('import-modal').style.display = 'block';
        }
        function hideImportModal(){
            document.getElementById('import-modal').style.display = 'none';
        }
        function importData(){
            coffeeLogger.importJSONFromTextarea();
        }
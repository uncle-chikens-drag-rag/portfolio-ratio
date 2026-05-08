document.addEventListener('DOMContentLoaded', () => {
    const csvUpload = document.getElementById('csvUpload');
    const fileNameDisplay = document.getElementById('fileName');
    const appBody = document.getElementById('appBody');
    const fundsTableBody = document.getElementById('fundsTableBody');
    const fundCardsMobile = document.getElementById('fundCardsMobile');
    const currentTotalValDisplay = document.getElementById('currentTotalVal');
    const targetPercentSumDisplay = document.getElementById('targetPercentSum');
    const alertMessage = document.getElementById('alertMessage');
    const resetTargetBtn = document.getElementById('resetTargetBtn');

    let fundsData = [];
    let currentTotal = 0;

    csvUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        fileNameDisplay.textContent = file.name;

        const reader = new FileReader();
        // 証券会社のCSVは一般的にShift_JIS
        reader.readAsText(file, "Shift_JIS");
        reader.onload = function(event) {
            const csvData = event.target.result;
            processData(csvData);
        };
    });

    function processData(csvData) {
        const lines = csvData.split(/\r?\n/);
        let isTargetSection = false;
        let isHeaderFound = false;
        
        const tempFunds = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line === '') {
                if (isHeaderFound) break; // ヘッダー発見後に空行が来たらブロック終了
                continue;
            }
            
            if (line === '投資信託（金額/NISA預り（成長投資枠））') {
                isTargetSection = true;
                continue;
            }

            if (isTargetSection) {
                if (!isHeaderFound && line.startsWith('ファンド名')) {
                    isHeaderFound = true;
                    continue;
                }

                if (isHeaderFound) {
                    const cols = parseCSVLine(line);
                    if (cols.length >= 7) {
                        const name = cols[0];
                        const evalAmount = parseInt(cols[6].replace(/,/g, ''), 10);
                        if (!isNaN(evalAmount)) {
                            tempFunds.push({
                                name: name,
                                val: evalAmount,
                                targetPct: 0
                            });
                        }
                    }
                }
            }
        }

        if (tempFunds.length === 0) {
            alert('成長投資枠のデータが見つかりませんでした。別のファイルを試すか、CSVの形式を確認してください。');
            return;
        }

        fundsData = tempFunds;
        currentTotal = fundsData.reduce((sum, f) => sum + f.val, 0);

        // 現在の割合を計算し、初期のターゲットにセット
        fundsData.forEach(f => {
            const ratio = (f.val / currentTotal) * 100;
            f.currentPct = ratio;
            f.targetPct = Math.round(ratio * 10) / 10;
        });

        // 合計がちょうど100%になるように調整
        adjustTargetSum();
        renderApp();
    }

    function adjustTargetSum() {
        if (fundsData.length === 0) return;
        const sumTarget = fundsData.reduce((sum, f) => sum + f.targetPct, 0);
        const diff = 100 - sumTarget;
        if (Math.abs(diff) > 0.01) {
            fundsData[fundsData.length - 1].targetPct += diff;
            fundsData[fundsData.length - 1].targetPct = Math.round(fundsData[fundsData.length - 1].targetPct * 10) / 10;
        }
    }

    function parseCSVLine(line) {
        // ダブルクォーテーション対応の簡易CSVパーサ
        const result = [];
        let curStr = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(curStr);
                curStr = '';
            } else {
                curStr += char;
            }
        }
        result.push(curStr);
        return result.map(s => s.trim().replace(/^"|"$/g, ''));
    }

    function renderApp() {
        appBody.classList.remove('hidden');
        renderTable();
    }

    function renderTable() {
        fundsTableBody.innerHTML = '';
        fundCardsMobile.innerHTML = '';
        
        fundsData.forEach((fund, index) => {
            const targetAmount = Math.round(currentTotal * (fund.targetPct / 100));
            const diff = targetAmount - fund.val;
            const diffFormatted = formatDiff(diff);

            // --- PC用テーブル行 ---
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${fund.name}</td>
                <td class="text-right">¥${fund.val.toLocaleString()}</td>
                <td class="text-right">${fund.currentPct.toFixed(1)}%</td>
                <td class="text-center">
                    <input type="number" min="0" max="100" step="0.1" data-index="${index}" data-target="table" value="${fund.targetPct.toFixed(1)}">
                </td>
                <td class="text-right">¥${targetAmount.toLocaleString()}</td>
                <td class="text-right">${diffFormatted}</td>
            `;
            fundsTableBody.appendChild(tr);

            // --- モバイル用カード ---
            const card = document.createElement('div');
            card.className = 'fund-card-mobile';
            card.innerHTML = `
                <div class="fund-name">${fund.name}</div>
                <div class="fc-item">
                    <span class="fc-label">現在の評価額</span>
                    <span class="fc-value">¥${fund.val.toLocaleString()}</span>
                </div>
                <div class="fc-item">
                    <span class="fc-label">現在の割合</span>
                    <span class="fc-value">${fund.currentPct.toFixed(1)}%</span>
                </div>
                <div class="fc-item target-input">
                    <span class="fc-label">目標割合 (%)</span>
                    <input type="number" min="0" max="100" step="0.1" data-index="${index}" data-target="card" value="${fund.targetPct.toFixed(1)}">
                </div>
                <div class="fc-item">
                    <span class="fc-label">目標評価額</span>
                    <span class="fc-value" id="card-target-${index}">¥${targetAmount.toLocaleString()}</span>
                </div>
                <div class="fc-item rebalance">
                    <span class="fc-label">リバランス額</span>
                    <span class="fc-value" id="card-diff-${index}">${diffFormatted}</span>
                </div>
            `;
            fundCardsMobile.appendChild(card);
        });

        // イベントリスナー（テーブル・カード両方のinputに対して）
        document.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index, 10);
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) {
                    fundsData[idx].targetPct = val;
                    // 両方のinputを同期
                    document.querySelectorAll(`input[data-index="${idx}"]`).forEach(el => {
                        if (el !== e.target) el.value = val.toFixed(1);
                    });
                    updateSumsAndDiffs();
                }
            });
        });

        currentTotalValDisplay.textContent = `¥${currentTotal.toLocaleString()}`;
        updateSumsAndDiffs();
    }

    function formatDiff(diff) {
        if (diff > 0) return `<span class="amount-plus">+¥${diff.toLocaleString()}</span>`;
        if (diff < 0) return `<span class="amount-minus">-¥${Math.abs(diff).toLocaleString()}</span>`;
        return `±¥0`;
    }

    function updateSumsAndDiffs() {
        let sum = 0;
        fundsData.forEach((fund, index) => {
            sum += fund.targetPct;
            const targetAmount = Math.round(currentTotal * (fund.targetPct / 100));
            const diff = targetAmount - fund.val;
            const diffFormatted = formatDiff(diff);

            // テーブル行の更新
            const tr = fundsTableBody.children[index];
            if (tr) {
                tr.children[4].textContent = `¥${targetAmount.toLocaleString()}`;
                tr.children[5].innerHTML = diffFormatted;
            }

            // モバイルカードの更新
            const cardTarget = document.getElementById(`card-target-${index}`);
            const cardDiff = document.getElementById(`card-diff-${index}`);
            if (cardTarget) cardTarget.textContent = `¥${targetAmount.toLocaleString()}`;
            if (cardDiff) cardDiff.innerHTML = diffFormatted;
        });

        targetPercentSumDisplay.textContent = `${sum.toFixed(1)}%`;
        
        if (Math.abs(sum - 100) > 0.01) {
            targetPercentSumDisplay.style.color = 'var(--danger)';
            alertMessage.classList.remove('hidden');
        } else {
            targetPercentSumDisplay.style.color = 'var(--primary)';
            alertMessage.classList.add('hidden');
        }
    }

    resetTargetBtn.addEventListener('click', () => {
        fundsData.forEach(f => {
            f.targetPct = Math.round(f.currentPct * 10) / 10;
        });
        adjustTargetSum();
        renderTable();
    });
});

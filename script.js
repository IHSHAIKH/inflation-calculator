/**
 * Inflation Impact Calculator
 * Handles real-time calculations, chart rendering, and UI interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const form = document.getElementById('calculatorForm');
    const resultsSection = document.getElementById('resultsSection');
    const supportBtn = document.getElementById('supportBtn');
    const closeBottomAdBtn = document.getElementById('closeBottomAd');
    const adSlots = document.querySelectorAll('.ad-slot');
    
    // Canvas Elements
    const incomeCanvas = document.getElementById('incomeChart');
    const savingsCanvas = document.getElementById('savingsChart');

    // State
    let charts = {
        income: null,
        savings: null
    };

    let isAdVisible = false;

    // Initialize
    initializeEventListeners();

    /**
     * Set up all event listeners for the application
     */
    function initializeEventListeners() {
        // Form Submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            calculateAndDisplay();
        });

        // Real-time calculation on input change (debounced)
        const inputs = form.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('input', debounce(() => {
                if (form.checkValidity()) {
                    calculateAndDisplay();
                }
            }, 500));
        });

        // Support Button (Ad Toggle)
        supportBtn.addEventListener('click', toggleAds);

        // Close Bottom Ad
        if (closeBottomAdBtn) {
            closeBottomAdBtn.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('ad-bottom').classList.add('ad-hidden');
            });
        }

        // Window Resize (Redraw charts)
        window.addEventListener('resize', debounce(() => {
            if (resultsSection.style.display !== 'none') {
                calculateAndDisplay();
            }
        }, 200));
    }

    /**
     * Main calculation and display orchestration
     */
    function calculateAndDisplay() {
        if (!validateInputs()) return;

        const data = getFormData();
        const results = calculateProjections(data);
        
        updateMetrics(results, data);
        updateInsights(results, data);
        updateComparisonTable(results);
        
        // Show results section if hidden
        if (resultsSection.style.display !== 'block') {
            resultsSection.classList.add('active');
            resultsSection.style.display = 'block';
            
            // Scroll to results on mobile
            if (window.innerWidth < 768) {
                resultsSection.scrollIntoView({ behavior: 'smooth' });
            }
        }

        // Render Charts using Vanilla Canvas
        renderIncomeChart(incomeCanvas, results.years, results.nominalIncome, results.realIncome);
        renderSavingsChart(savingsCanvas, results.years, results.realSavings);
    }

    /**
     * Get data from form inputs
     */
    function getFormData() {
        return {
            monthlyIncome: parseFloat(document.getElementById('monthlyIncome').value) || 0,
            currentSavings: parseFloat(document.getElementById('currentSavings').value) || 0,
            inflationRate: parseFloat(document.getElementById('inflationRate').value) || 0,
            incomeGrowth: parseFloat(document.getElementById('incomeGrowth').value) || 0,
            years: parseInt(document.getElementById('timePeriod').value) || 10
        };
    }

    /**
     * Validate form inputs
     */
    function validateInputs() {
        // Basic validation is handled by HTML5 attributes, 
        // this adds logical checks if needed
        return form.checkValidity();
    }

    /**
     * Perform financial projections
     */
    function calculateProjections(data) {
        let nominalIncome = [];
        let realIncome = [];
        let nominalSavings = []; // Assuming savings grow with inflation? Or just static? Let's assume static savings for simplicity unless specified differently, but usually savings have interest. 
        // The prompt asked for "Income growth rate" and "Inflation rate". It didn't ask for "Savings Interest Rate", so we assume savings are cash/uninvested.
        let realSavings = [];
        let years = [];
        
        const annualIncome = data.monthlyIncome * 12;
        let currentNominalIncome = annualIncome;
        let currentRealIncome = annualIncome; // Adjusted for purchasing power
        let currentSavingsVal = data.currentSavings;

        for (let i = 0; i <= data.years; i++) {
            years.push(i === 0 ? 'Now' : `Year ${i}`);
            
            // Income Calculations
            // Nominal: Grows by income growth rate
            // Real: Nominal / (1 + inflation)^years
            
            if (i > 0) {
                currentNominalIncome = currentNominalIncome * (1 + data.incomeGrowth / 100);
            }
            
            // Real value calculation: Nominal / (1 + inflation)^t
            let realIncomeVal = currentNominalIncome / Math.pow(1 + data.inflationRate / 100, i);
            let realSavingsVal = data.currentSavings / Math.pow(1 + data.inflationRate / 100, i);

            nominalIncome.push(Math.round(currentNominalIncome));
            realIncome.push(Math.round(realIncomeVal));
            realSavings.push(Math.round(realSavingsVal));
        }

        const purchasingPowerChange = ((realIncome[data.years] - realIncome[0]) / realIncome[0]) * 100;
        const totalPurchasingPowerLoss = 100 - (100 / Math.pow(1 + data.inflationRate / 100, data.years));

        return {
            years,
            nominalIncome,
            realIncome,
            realSavings,
            purchasingPowerChange,
            totalPurchasingPowerLoss,
            finalRealSavings: realSavings[data.years]
        };
    }

    /**
     * Update UI Metrics
     */
    function updateMetrics(results, data) {
        const annualIncome = data.monthlyIncome * 12;
        
        document.getElementById('currentAnnualIncome').textContent = formatCurrency(annualIncome);
        document.getElementById('futureNominalIncome').textContent = formatCurrency(results.nominalIncome[data.years]);
        document.getElementById('futureRealIncome').textContent = formatCurrency(results.realIncome[data.years]);
        
        const ppChangeEl = document.getElementById('purchasingPowerChange');
        const ppChangeVal = results.purchasingPowerChange;
        ppChangeEl.textContent = `${ppChangeVal >= 0 ? '+' : ''}${ppChangeVal.toFixed(1)}%`;
        ppChangeEl.className = 'metric-value ' + (ppChangeVal >= 0 ? 'positive' : 'negative');

        document.getElementById('currentSavingsDisplay').textContent = formatCurrency(data.currentSavings);
        document.getElementById('realSavingsValue').textContent = formatCurrency(results.finalRealSavings);
    }

    /**
     * Update Insights Alert
     */
    function updateInsights(results, data) {
        const alertEl = document.getElementById('insightsAlert');
        const incomeGap = data.inflationRate - data.incomeGrowth;
        const years = data.years;
        const lossPercent = results.totalPurchasingPowerLoss.toFixed(1);

        let html = '';
        let className = 'insights-alert '; // base class

        if (data.inflationRate === 0) {
             className += 'success';
             html = `<strong>Great News!</strong> With 0% inflation, your money retains its full value. However, some inflation is normal in a healthy economy.`;
        } else if (data.incomeGrowth > data.inflationRate) {
            className += 'success';
            html = `<strong>You're Winning!</strong> Your income is growing faster than inflation (${data.incomeGrowth}% vs ${data.inflationRate}%). Your purchasing power is increasing over time.`;
        } else if (data.incomeGrowth === data.inflationRate) {
            className += 'warning';
            html = `<strong>Treading Water.</strong> Your income is exactly matching inflation. You aren't losing purchasing power, but you aren't getting richer in real terms.`;
        } else {
            className += 'danger';
            html = `<strong>Warning: Purchasing Power Loss.</strong> Inflation is outpacing your income growth. In ${years} years, your savings will lose <strong>${lossPercent}%</strong> of their value in today's dollars.`;
        }

        alertEl.className = className;
        alertEl.innerHTML = html;
    }

    /**
     * Update Comparison Table
     */
    function updateComparisonTable(results) {
        const tbody = document.getElementById('comparisonTableBody');
        tbody.innerHTML = '';

        results.years.forEach((year, index) => {
            const row = document.createElement('tr');
            
            // Calculate purchasing power relative to year 0 (100%)
            // This is basically Real / Nominal * 100, but better to just use the inflation factor directly
            // PP% = 100 / (1+r)^t
            const pp = 100 * (results.realSavings[index] / results.realSavings[0]); // Using savings ratio as proxy for pure currency value retention

            row.innerHTML = `
                <td>${year}</td>
                <td>${formatCurrency(results.nominalIncome[index])}</td>
                <td>${formatCurrency(results.realIncome[index])}</td>
                <td>${formatCurrency(results.realSavings[index])}</td>
                <td>${pp.toFixed(1)}%</td>
            `;
            tbody.appendChild(row);
        });
    }

    /**
     * Toggle visibility of Ad Placeholders
     */
    function toggleAds() {
        isAdVisible = !isAdVisible;
        
        adSlots.forEach(slot => {
            if (isAdVisible) {
                slot.classList.remove('ad-hidden');
            } else {
                slot.classList.add('ad-hidden');
            }
        });

        const span = supportBtn.querySelector('span');
        if (isAdVisible) {
            supportBtn.classList.add('active');
            span.textContent = 'Hide Support';
        } else {
            supportBtn.classList.remove('active');
            span.textContent = 'Support this site';
        }
    }

    /**
     * Render Line Chart for Income
     */
    function renderIncomeChart(canvas, labels, nominalData, realData) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const padding = 40;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Find min/max for scaling
        const maxValue = Math.max(...nominalData, ...realData) * 1.1; 
        const minValue = 0;

        // Helper to map values to coordinates
        const mapX = (index) => padding + (index * (width - 2 * padding) / (labels.length - 1));
        const mapY = (val) => height - padding - ((val - minValue) / (maxValue - minValue)) * (height - 2 * padding);

        // Draw Axes
        ctx.beginPath();
        ctx.strokeStyle = '#64748b'; // slate-500
        ctx.lineWidth = 1;
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding); // Y axis
        ctx.lineTo(width - padding, height - padding); // X axis
        ctx.stroke();

        // Draw Grid lines & Y Labels (approx 5 lines)
        ctx.textAlign = 'right';
        ctx.fillStyle = '#94a3b8'; // slate-400
        ctx.font = '10px Inter, sans-serif';
        
        for(let i=0; i<=5; i++) {
            const val = minValue + (maxValue - minValue) * (i/5);
            const y = mapY(val);
            
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();

            ctx.fillText(formatK(val), padding - 5, y + 3);
        }

        // Help to draw line
        function drawLine(data, color, dash = []) {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.setLineDash(dash);
            
            data.forEach((val, i) => {
                const x = mapX(i);
                const y = mapY(val);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.setLineDash([]); // reset

            // Draw points
            ctx.fillStyle = color;
            data.forEach((val, i) => {
                const x = mapX(i);
                const y = mapY(val);
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Draw Indices
        // Nominal (Green)
        drawLine(nominalData, '#10b981');
        
        // Real (Blue)
        drawLine(realData, '#3b82f6');

        // Legend
        ctx.fillStyle = '#10b981';
        ctx.fillText('Nominal Income', width - 20, 20);
        ctx.fillStyle = '#3b82f6';
        ctx.fillText('Real Income (Adjusted)', width - 20, 35);
        ctx.textAlign = 'right';
    }

    /**
     * Render Bar Chart for Savings
     */
    function renderSavingsChart(canvas, labels, data) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const padding = 40;

        ctx.clearRect(0, 0, width, height);

        const maxValue = Math.max(...data) * 1.1;
        const minValue = 0;

        const mapX = (index) => padding + (index * (width - 2 * padding) / data.length);
        const mapY = (val) => height - padding - ((val - minValue) / (maxValue - minValue)) * (height - 2 * padding);
        const barWidth = (width - 2 * padding) / data.length * 0.6;

        // Draw Axes
        ctx.beginPath();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();

        // Draw Y Labels
        ctx.textAlign = 'right';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Inter, sans-serif';
        for(let i=0; i<=5; i++) {
            const val = minValue + (maxValue - minValue) * (i/5);
            const y = mapY(val);
            ctx.fillText(formatK(val), padding - 5, y + 3);
            
            // Grid
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();
        }

        // Draw Bars
        data.forEach((val, i) => {
            const x = mapX(i) + ((width - 2 * padding) / data.length - barWidth) / 2;
            const y = mapY(val);
            const h = height - padding - y;
            
            // Gradient fill
            const gradient = ctx.createLinearGradient(0, y, 0, height - padding);
            gradient.addColorStop(0, '#06b6d4');
            gradient.addColorStop(1, 'rgba(6, 182, 212, 0.2)');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, barWidth, h);

            // X Labels (skip some if too many)
            if (data.length > 10 && i % 2 !== 0) return; // Skip every other label if dense
            
            ctx.fillStyle = '#94a3b8';
            ctx.textAlign = 'center';
            ctx.fillText(i === 0 ? 'Now' : i, x + barWidth/2, height - padding + 15);
        });
    }

    /**
     * Utilities
     */
    function formatCurrency(num) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
    }

    function formatK(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(0) + 'k';
        return num;
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
});

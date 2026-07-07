        // Initialize dynamic AWG structures (1 to 31 AWG)
        const AWG_DATA = [];
        for (let n = 1; n <= 31; n++) {
            const d_cond = 0.127 * Math.pow(92, (36 - n) / 39.0);
            const area = Math.PI * Math.pow(d_cond / 2.0, 2);
            let t_ins;
            if (n >= 14) t_ins = 0.50;
            else if (n >= 8) t_ins = 0.90;
            else if (n >= 3) t_ins = 1.20;
            else t_ins = 1.45;
            const d_outer = d_cond + (2 * t_ins);
            const x_reactance = 0.121 + (0.0031 * n);
            
            AWG_DATA.push({
                label: `${n} AWG`,
                area: parseFloat(area.toFixed(2)),
                d_cond: parseFloat(d_cond.toFixed(2)),
                d_outer: parseFloat(d_outer.toFixed(2)),
                x: parseFloat(x_reactance.toFixed(3)),
                gauge: n
            });
        }

        const METRIC_DATA = [
            { label: '1.5 mm²', area: 1.5, d_cond: 1.38, d_outer: 2.5, x: 0.168 },
            { label: '2.5 mm²', area: 2.5, d_cond: 1.78, d_outer: 3.1, x: 0.160 },
            { label: '4 mm²', area: 4.0, d_cond: 2.26, d_outer: 3.7, x: 0.154 },
            { label: '6 mm²', area: 6.0, d_cond: 2.76, d_outer: 4.3, x: 0.148 },
            { label: '10 mm²', area: 10.0, d_cond: 3.57, d_outer: 5.4, x: 0.140 },
            { label: '16 mm²', area: 16.0, d_cond: 4.51, d_outer: 6.7, x: 0.133 },
            { label: '25 mm²', area: 25.0, d_cond: 5.64, d_outer: 8.4, x: 0.128 },
            { label: '35 mm²', area: 35.0, d_cond: 6.68, d_outer: 9.8, x: 0.122 },
            { label: '50 mm²', area: 50.0, d_cond: 7.98, d_outer: 11.5, x: 0.118 },
            { label: '70 mm²', area: 70.0, d_cond: 9.44, d_outer: 13.4, x: 0.114 },
            { label: '95 mm²', area: 95.0, d_cond: 11.00, d_outer: 15.6, x: 0.110 },
            { label: '120 mm²', area: 120.0, d_cond: 12.36, d_outer: 17.5, x: 0.106 },
            { label: '150 mm²', area: 150.0, d_cond: 13.82, d_outer: 19.4, x: 0.103 },
            { label: '185 mm²', area: 185.0, d_cond: 15.35, d_outer: 21.5, x: 0.101 },
            { label: '240 mm²', area: 240.0, d_cond: 17.48, d_outer: 24.3, x: 0.098 },
            { label: '300 mm²', area: 300.0, d_cond: 19.54, d_outer: 27.2, x: 0.095 },
            { label: '400 mm²', area: 400.0, d_cond: 22.57, d_outer: 31.0, x: 0.092 },
            { label: '500 mm²', area: 500.0, d_cond: 25.23, d_outer: 34.5, x: 0.089 }
        ];

        const MATERIALS = {
            copper: { name: 'Copper (Cu)', rho20: 1.72e-8, tempCoeff: 0.00393 },
            aluminum: { name: 'Aluminum (Al)', rho20: 2.82e-8, tempCoeff: 0.00403 }
        };

        const INSTALLATIONS = {
            freeAir: { name: 'Free Air / Well Ventilated', h: 12.0 },
            conduit: { name: 'In Conduit / Raceway', h: 6.5 },
            underground: { name: 'Underground Direct-Buried', h: 4.5 }
        };

        const INSULATIONS = {
            TW: { name: 'TW / UF (PVC) - 60°C Limit', limit: 60, kIns: 0.17 },
            THWN: { name: 'THWN / THW (PVC) - 75°C Limit', limit: 75, kIns: 0.17 },
            THHN: { name: 'THHN / XHHW (XLPE) - 90°C Limit', limit: 90, kIns: 0.22 },
            AWM_PVC: { name: 'AWM PVC - 105°C Limit', limit: 105, kIns: 0.17 },
            TEFLON_PVC: { name: 'Teflon/FEP with PVC Jacket - 105°C Limit', limit: 105, kIns: 0.24 },
            TEFLON_PURE: { name: 'Pure Teflon/FEP High-Temp - 200°C Limit', limit: 200, kIns: 0.24 },
            custom: { name: 'Custom (User-Defined)...', limit: 105, kIns: 0.17 }
        };

        // System Presets Configuration Library
        const PRESETS = {
            automotiveStarter: {
                phase: 'dc', voltage: 12.0, current: 150.0, pf: 1.0, allowableDrop: 5.0,
                distUnit: 'm', material: 'copper', insulation: 'AWM_PVC', routing: 'conduit',
                ambientTemp: 25, ambientUnit: 'C',
                segments: [
                    { standard: 'AWG', sizeIdx: 1, length: 2.2 }, // 2 AWG 
                    { standard: 'AWG', sizeIdx: 3, length: 0.8 }  // 4 AWG
                ]
            },
            aerospaceSignal: {
                phase: 'dc', voltage: 28.0, current: 3.0, pf: 1.0, allowableDrop: 2.0,
                distUnit: 'mm', material: 'copper', insulation: 'TEFLON_PURE', routing: 'freeAir',
                ambientTemp: 50, ambientUnit: 'C',
                segments: [
                    { standard: 'AWG', sizeIdx: 23, length: 1200.0 }, // 24 AWG
                    { standard: 'AWG', sizeIdx: 25, length: 150.0 },  // 26 AWG
                    { standard: 'AWG', sizeIdx: 23, length: 800.0 }   // 24 AWG
                ]
            },
            industrial3p: {
                phase: 'three', voltage: 480.0, current: 45.0, pf: 0.85, allowableDrop: 3.0,
                distUnit: 'm', material: 'aluminum', insulation: 'THHN', routing: 'conduit',
                ambientTemp: 40, ambientUnit: 'C',
                segments: [
                    { standard: 'Metric', sizeIdx: 4, length: 35.0 }, // 10 mm2
                    { standard: 'Metric', sizeIdx: 3, length: 15.0 }  // 6 mm2
                ]
            }
        };

        let activePhase = 'dc';
        let currentTab = 'dash';

        // Initialize lists & elements on DOM load
        window.addEventListener('DOMContentLoaded', () => {
            lucide.createIcons();
            
            // Populate Insulation select
            const insSelect = document.getElementById('insulation-select');
            Object.keys(INSULATIONS).forEach(key => {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = INSULATIONS[key].name;
                if (key === 'AWM_PVC') opt.selected = true;
                insSelect.appendChild(opt);
            });

            // Populate Installation select
            const instSelect = document.getElementById('install-select');
            Object.keys(INSTALLATIONS).forEach(key => {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = INSTALLATIONS[key].name;
                if (key === 'conduit') opt.selected = true;
                instSelect.appendChild(opt);
            });

            // Check if there is active persistent URL parameters to import
            const urlParams = new URLSearchParams(window.location.search);
            const stateParam = urlParams.get('state');
            if (stateParam) {
                try {
                    const decoded = JSON.parse(atob(stateParam));
                    loadStateObject(decoded);
                    // Clear the query param silently to keep URL clean
                    window.history.replaceState({}, document.title, window.location.pathname);
                } catch (e) {
                    addSegmentRow('AWG', 23, 1000.0);
                }
            } else {
                // Add default standard initial segment row if empty
                addSegmentRow('AWG', 23, 1000.0); // 24 AWG (index 23)
            }

            triggerCalculate();
        });

        // Tab selection switcher
        function switchTab(tabId) {
            currentTab = tabId;
            const tabs = ['dash', 'trace', 'theory'];
            tabs.forEach(t => {
                const btn = document.getElementById(`tab-btn-${t}`);
                const panel = document.getElementById(`tab-panel-${t}`);
                if (btn && panel) {
                    if (t === tabId) {
                        btn.className = "px-5 py-3 border-b-2 border-teal-600 dark:border-teal-400 text-teal-600 dark:text-teal-400 font-bold text-xs uppercase tracking-wider shrink-0 transition-all flex items-center gap-1.5";
                        panel.classList.remove('hidden');
                    } else {
                        btn.className = "px-5 py-3 border-b-2 border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 font-bold text-xs uppercase tracking-wider shrink-0 transition-all flex items-center gap-1.5";
                        panel.classList.add('hidden');
                    }
                }
            });
            
            // Force redrawing Lucide icons if elements are newly visible
            lucide.createIcons();
        }

        // Custom alerts instead of browser prompt alerts
        function showAlert(title, message) {
            document.getElementById('alert-title').textContent = title;
            document.getElementById('alert-message').textContent = message;
            document.getElementById('alert-modal').classList.remove('hidden');
        }

        function closeAlert() {
            document.getElementById('alert-modal').classList.add('hidden');
        }

        // Phase setting configuration
        function setPhase(phase) {
            activePhase = phase;
            const buttons = ['dc', 'single', 'three'];
            buttons.forEach(p => {
                const btn = document.getElementById(`phase-${p}`);
                if (p === phase) {
                    btn.className = "py-2 px-3 border-2 border-teal-600 dark:border-teal-500 bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 font-bold rounded-xl text-sm transition-all shadow-sm";
                } else {
                    btn.className = "py-2 px-3 border-2 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-xl text-sm transition-all";
                }
            });

            const pfInput = document.getElementById('pf-input');
            if (phase === 'dc') {
                pfInput.value = "1.0";
                pfInput.disabled = true;
                pfInput.classList.replace('bg-white', 'bg-slate-50');
                pfInput.classList.add('text-slate-400');
            } else {
                pfInput.disabled = false;
                pfInput.classList.replace('bg-slate-50', 'bg-white');
                pfInput.classList.remove('text-slate-400');
            }
            triggerCalculate();
        }

        // Insulation Preset change trigger
        function onInsulationChanged() {
            const preset = document.getElementById('insulation-select').value;
            const customBox = document.getElementById('custom-insulation-box');
            if (preset === 'custom') {
                customBox.classList.remove('hidden');
            } else {
                customBox.classList.add('hidden');
            }
            triggerCalculate();
        }

        // Ambient temperature units change handler
        let lastAmbientUnit = 'C';
        function onAmbientUnitChanged() {
            const unit = document.getElementById('ambient-unit-select').value;
            const tempInput = document.getElementById('ambient-temp-input');
            let val = parseFloat(tempInput.value);

            if (unit !== lastAmbientUnit) {
                if (unit === 'C') {
                    // F to C
                    val = (val - 32) * 5/9;
                } else {
                    // C to F
                    val = (val * 9/5) + 32;
                }
                tempInput.value = Math.round(val);
                lastAmbientUnit = unit;
            }
            triggerCalculate();
        }

        // Segment management helper functions
        function addSegmentRow(standard = 'AWG', sizeIdx = 0, length = 1000.0) {
            const tbody = document.getElementById('segments-body');
            const rowId = `segment-row-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const tr = document.createElement('tr');
            tr.id = rowId;
            tr.className = "group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors";

            tr.innerHTML = `
                <td class="py-1 px-3">
                    <select class="segment-std w-full bg-transparent font-semibold border-b border-transparent focus:border-teal-500 text-xs py-1 focus:outline-none" onchange="onSegmentStdChanged('${rowId}')">
                        <option value="AWG" ${standard === 'AWG' ? 'selected' : ''}>AWG</option>
                        <option value="Metric" ${standard === 'Metric' ? 'selected' : ''}>Metric</option>
                    </select>
                </td>
                <td class="py-1 px-3">
                    <select class="segment-size w-full bg-transparent font-medium border-b border-transparent focus:border-teal-500 text-xs py-1 focus:outline-none" onchange="triggerCalculate()">
                        <!-- Options populated by trigger -->
                    </select>
                </td>
                <td class="py-1 px-3">
                    <input type="number" step="any" min="0.0001" value="${length}" oninput="triggerCalculate()"
                           class="segment-length w-full bg-transparent font-mono text-xs border-b border-transparent focus:border-teal-500 py-1 focus:outline-none" />
                </td>
                <td class="py-1 px-3 text-center">
                    <button onclick="removeSegmentRow('${rowId}')" class="text-slate-400 hover:text-rose-600 transition-colors shrink-0">
                        <i data-lucide="trash-2" class="w-4 h-4 inline"></i>
                    </button>
                </td>
            `;

            tbody.appendChild(tr);
            populateSegmentSizes(rowId, standard, sizeIdx);
            lucide.createIcons();
            triggerCalculate();
        }

        function populateSegmentSizes(rowId, standard, selectedIdx) {
            const tr = document.getElementById(rowId);
            const sizeSelect = tr.querySelector('.segment-size');
            sizeSelect.innerHTML = '';
            
            const dataSet = standard === 'AWG' ? AWG_DATA : METRIC_DATA;
            dataSet.forEach((wire, index) => {
                const opt = document.createElement('option');
                opt.value = index;
                opt.textContent = `${wire.label} (${wire.area} mm²)`;
                if (index === selectedIdx) opt.selected = true;
                sizeSelect.appendChild(opt);
            });
        }

        function onSegmentStdChanged(rowId) {
            const tr = document.getElementById(rowId);
            const std = tr.querySelector('.segment-std').value;
            populateSegmentSizes(rowId, std, 0);
            triggerCalculate();
        }

        function removeSegmentRow(rowId) {
            const tbody = document.getElementById('segments-body');
            if (tbody.children.length <= 1) {
                showAlert('System Constraint', 'At least one dynamic conductor segment is required for calculations.');
                return;
            }
            const el = document.getElementById(rowId);
            if (el) el.remove();
            triggerCalculate();
        }

        // Core Physics Calculation Engine
        function evaluateCircuit(segmentsInfo, phase, voltage, current, powerFactor, ambTempC, material, insulation, install, customThickness) {
            let total_R = 0.0;
            let total_X = 0.0;
            let max_temp = ambTempC;
            let max_temp_rise = 0.0;
            let total_p_loss = 0.0;
            let total_r20 = 0.0;
            let bottleneck_history = [];
            let bottleneck_spec = null;

            const path_multiplier = phase === "three" ? 1.0 : 2.0;

            // Deep tracking metrics per segment for individual loss evaluations
            const segmentsCalculations = [];

            segmentsInfo.forEach((seg, sIdx) => {
                const wire = seg.wire;
                const length_m = seg.length_m;

                const d_cond_m = wire.d_cond * 1e-3;
                const area_m2 = wire.area * 1e-6;

                const d_outer_m = customThickness !== null 
                    ? d_cond_m + (2 * (customThickness * 1e-3)) 
                    : wire.d_outer * 1e-3;

                const R_ins = Math.log(d_outer_m / d_cond_m) / (2 * Math.PI * insulation.kIns);
                const R_conv = 1 / (install.h * Math.PI * d_outer_m);
                const total_thermal_r = R_ins + R_conv;

                let temp_history = [];
                let curr_temp = ambTempC;
                let r_per_m = 0.0;

                // local radial thermal iteration convergence block
                for (let iter = 1; iter <= 10; iter++) {
                    const final_resistivity = material.rho20 * (1 + material.tempCoeff * (curr_temp - 20));
                    r_per_m = final_resistivity / area_m2;
                    const p_loss_m = Math.pow(current, 2) * r_per_m;
                    const rise = p_loss_m * total_thermal_r;
                    const nxt = ambTempC + rise;

                    temp_history.push({
                        iteration: iter,
                        temperature: curr_temp,
                        resistivity: final_resistivity,
                        resistancePerMeter: r_per_m,
                        powerLossPerMeter: p_loss_m,
                        tempRise: rise
                    });

                    if (Math.abs(nxt - curr_temp) < 0.001) {
                        curr_temp = nxt;
                        break;
                    }
                    curr_temp = nxt;
                }

                const seg_R_total = r_per_m * length_m * path_multiplier;
                const seg_X_total = (wire.x / 1000.0) * length_m * path_multiplier;
                
                const seg_p_loss = phase === "three" 
                    ? 3 * Math.pow(current, 2) * (r_per_m * length_m) 
                    : 2 * Math.pow(current, 2) * (r_per_m * length_m);

                total_R += seg_R_total;
                total_X += seg_X_total;
                total_p_loss += seg_p_loss;
                total_r20 += (material.rho20 / area_m2) * (length_m * path_multiplier);

                // Segment-level voltage loss calculations
                let seg_v_drop = 0.0;
                if (phase === "dc") {
                    seg_v_drop = current * seg_R_total;
                } else {
                    const theta = Math.acos(powerFactor);
                    const sin_t = Math.sin(theta);
                    if (phase === "single") {
                        seg_v_drop = 2 * current * ((seg_R_total / 2) * powerFactor + (seg_X_total / 2) * sin_t);
                    } else {
                        seg_v_drop = Math.sqrt(3) * current * (seg_R_total * powerFactor + seg_X_total * sin_t);
                    }
                }

                segmentsCalculations.push({
                    label: wire.label,
                    length_m: length_m,
                    wire: wire,
                    temp: curr_temp,
                    rise: curr_temp - ambTempC,
                    v_drop: seg_v_drop,
                    p_loss: seg_p_loss
                });

                if (curr_temp >= max_temp) {
                    max_temp = curr_temp;
                    max_temp_rise = curr_temp - ambTempC;
                    bottleneck_history = temp_history;
                    bottleneck_spec = {
                        wire: wire,
                        R_ins: R_ins,
                        R_conv: R_conv,
                        thermal_r: total_thermal_r,
                        r_per_m: r_per_m
                    };
                }
            });

            // Global Volt Drop Calculations
            let v_drop = 0.0;
            let load_pwr = 0.0;

            if (phase === "dc") {
                v_drop = current * total_R;
                load_pwr = voltage * current;
            } else {
                const theta = Math.acos(powerFactor);
                const sin_t = Math.sin(theta);
                if (phase === "single") {
                    v_drop = 2 * current * ((total_R / 2) * powerFactor + (total_X / 2) * sin_t);
                    load_pwr = voltage * current * powerFactor;
                } else {
                    v_drop = Math.sqrt(3) * current * (total_R * powerFactor + total_X * sin_t);
                    load_pwr = Math.sqrt(3) * voltage * current * powerFactor;
                }
            }

            const v_pct = voltage > 0 ? (v_drop / voltage) * 100 : 0;
            const p_pct = load_pwr > 0 ? (total_p_loss / load_pwr) * 100 : 0;

            return {
                R_total: total_R,
                X_total: total_X,
                R_20_total: total_r20,
                v_drop: v_drop,
                v_pct: v_pct,
                load_pwr: load_pwr,
                p_loss: total_p_loss,
                p_pct: p_pct,
                max_temp: max_temp,
                max_temp_rise: max_temp_rise,
                bottle_hist: bottleneck_history,
                bottle_spec: bottleneck_spec,
                segmentsData: segmentsCalculations
            };
        }

        // Trigger dynamic calculation cycle
        function triggerCalculate() {
            const voltage = parseFloat(document.getElementById('voltage-input').value) || 0;
            const current = parseFloat(document.getElementById('current-input').value) || 0;
            const pf = parseFloat(document.getElementById('pf-input').value) || 1.0;
            const dropLimit = parseFloat(document.getElementById('vdrop-limit-input').value) || 3.0;

            const ambTemp = parseFloat(document.getElementById('ambient-temp-input').value) || 30;
            const ambUnit = document.getElementById('ambient-unit-select').value;
            const ambC = ambUnit === 'F' ? (ambTemp - 32) * 5/9 : ambTemp;

            const matKey = document.getElementById('material-select').value;
            const material = MATERIALS[matKey];

            const insKey = document.getElementById('insulation-select').value;
            let insulation;
            let customThickness = null;

            if (insKey === 'custom') {
                insulation = {
                    name: 'Custom',
                    limit: parseInt(document.getElementById('custom-temp-input').value) || 105,
                    kIns: parseFloat(document.getElementById('custom-k-input').value) || 0.17
                };
                customThickness = parseFloat(document.getElementById('custom-thickness-input').value) || 0.8;
            } else {
                insulation = INSULATIONS[insKey];
            }

            const instKey = document.getElementById('install-select').value;
            const install = INSTALLATIONS[instKey];

            // Parse and gather dynamic segments
            const segmentsList = [];
            let total_dist_raw = 0.0;
            const distUnit = document.getElementById('dist-unit-select').value;

            const tbody = document.getElementById('segments-body');
            Array.from(tbody.children).forEach(tr => {
                const std = tr.querySelector('.segment-std').value;
                const sizeIdx = parseInt(tr.querySelector('.segment-size').value) || 0;
                const len_raw = parseFloat(tr.querySelector('.segment-length').value) || 0.0;

                total_dist_raw += len_raw;

                let l_m = 0.0;
                if (distUnit === 'ft') {
                    l_m = len_raw * 0.3048;
                } else if (distUnit === 'm') {
                    l_m = len_raw;
                } else {
                    l_m = len_raw * 0.001; // mm to m
                }

                const wire = std === 'AWG' ? AWG_DATA[sizeIdx] : METRIC_DATA[sizeIdx];
                segmentsList.push({
                    wire: wire,
                    length_m: l_m,
                    std: std,
                    idx: sizeIdx,
                    length_raw: len_raw
                });
            });

            document.getElementById('total-dist-display').textContent = total_dist_raw.toFixed(2);

            if (segmentsList.length === 0) return;

            // Execute core physical equations
            const res = evaluateCircuit(segmentsList, activePhase, voltage, current, pf, ambC, material, insulation, install, customThickness);

            const is_t_safe = res.max_temp <= insulation.limit;
            const is_v_safe = res.v_pct <= dropLimit;

            // Update Dashboards KPIs with smooth warnings states
            const kpiTempCard = document.getElementById('kpi-temp-card');
            const kpiTempCardVal = document.getElementById('kpi-temp-val');
            const kpiTempCardSub = document.getElementById('kpi-temp-sub');
            
            kpiTempCardVal.textContent = `${res.max_temp.toFixed(1)} °C`;
            kpiTempCardSub.textContent = `Rise: +${res.max_temp_rise.toFixed(1)}°C | Limit ${insulation.limit}°C`;
            if (!is_t_safe) {
                kpiTempCard.className = "bg-rose-50 dark:bg-rose-950/20 p-5 rounded-2xl border-2 border-rose-500 shadow-md transition-all flex flex-col justify-between";
                kpiTempCardVal.className = "text-2xl font-extrabold text-rose-950 dark:text-rose-200 font-mono tracking-tight my-1";
            } else if (res.max_temp > insulation.limit * 0.85) {
                kpiTempCard.className = "bg-amber-50 dark:bg-amber-950/20 p-5 rounded-2xl border-2 border-amber-500 shadow-md transition-all flex flex-col justify-between";
                kpiTempCardVal.className = "text-2xl font-extrabold text-amber-950 dark:text-amber-200 font-mono tracking-tight my-1";
            } else {
                kpiTempCard.className = "bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all flex flex-col justify-between";
                kpiTempCardVal.className = "text-2xl font-extrabold text-slate-950 dark:text-slate-100 font-mono tracking-tight my-1";
            }

            const kpiVDropCard = document.getElementById('kpi-vdrop-card');
            const kpiVDropCardVal = document.getElementById('kpi-vdrop-val');
            const kpiVDropCardSub = document.getElementById('kpi-vdrop-sub');
            
            kpiVDropCardVal.textContent = `${res.v_pct.toFixed(2)} %`;
            kpiVDropCardSub.textContent = `-${res.v_drop.toFixed(2)} V | Target <${dropLimit}%`;
            if (!is_v_safe) {
                kpiVDropCard.className = "bg-rose-50 dark:bg-rose-950/20 p-5 rounded-2xl border-2 border-rose-500 shadow-md transition-all flex flex-col justify-between";
                kpiVDropCardVal.className = "text-2xl font-extrabold text-rose-950 dark:text-rose-200 font-mono tracking-tight my-1";
            } else {
                kpiVDropCard.className = "bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all flex flex-col justify-between";
                kpiVDropCardVal.className = "text-2xl font-extrabold text-slate-950 dark:text-slate-100 font-mono tracking-tight my-1";
            }

            const kpiLossCard = document.getElementById('kpi-ploss-card');
            const kpiLossCardVal = document.getElementById('kpi-ploss-val');
            const kpiLossCardSub = document.getElementById('kpi-ploss-sub');
            
            const pUnit = res.p_loss >= 1000 ? `${(res.p_loss / 1000.0).toFixed(3)} kW` : `${res.p_loss.toFixed(3)} W`;
            kpiLossCardVal.textContent = pUnit;
            kpiLossCardSub.textContent = `${res.p_pct.toFixed(2)}% of system feed`;

            // Progress Indicators update
            const tempPct = Math.min(100, Math.max(0, (res.max_temp / insulation.limit) * 100));
            const vdropPct = Math.min(100, Math.max(0, (res.v_pct / (dropLimit * 1.5)) * 100));

            document.getElementById('temp-progress-lbl').textContent = `Peak Bottleneck: ${res.max_temp.toFixed(1)}°C / ${insulation.limit}°C Limit`;
            document.getElementById('temp-progress-val').textContent = `${Math.round(tempPct)}%`;
            const tempBar = document.getElementById('temp-progress-bar');
            tempBar.style.width = `${tempPct}%`;
            if (tempPct > 100) tempBar.className = "h-full bg-rose-600";
            else if (tempPct > 85) tempBar.className = "h-full bg-amber-500";
            else tempBar.className = "h-full bg-emerald-500";

            document.getElementById('vdrop-progress-lbl').textContent = `Voltage Drop Margin: ${res.v_pct.toFixed(2)}% (Target < ${dropLimit}%)`;
            document.getElementById('vdrop-progress-val').textContent = `${Math.round(vdropPct)}%`;
            const vdropBar = document.getElementById('vdrop-progress-bar');
            vdropBar.style.width = `${vdropPct}%`;
            if (res.v_pct > dropLimit) vdropBar.className = "h-full bg-rose-600";
            else vdropBar.className = "h-full bg-emerald-500";

            // Draw Dynamic SVG Heat Map Diagram
            drawSplicingHeatMap(res.segmentsData, insulation.limit);

            // Populate Segment Losses table dynamically
            const lossBody = document.getElementById('loss-breakdown-body');
            lossBody.innerHTML = '';
            res.segmentsData.forEach((segData, index) => {
                const tr = document.createElement('tr');
                tr.className = "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors";
                const segVDropPct = voltage > 0 ? (segData.v_drop / voltage) * 100 : 0;
                const formatLoss = segData.p_loss >= 1000 ? `${(segData.p_loss/1000).toFixed(3)} kW` : `${segData.p_loss.toFixed(3)} W`;
                tr.innerHTML = `
                    <td class="py-2 px-3 font-semibold text-slate-700">Seg #${index + 1}</td>
                    <td class="py-2 px-3 font-bold text-slate-900">${segData.label}</td>
                    <td class="py-2 px-3 text-right text-slate-500 font-medium">${segmentsList[index].length_raw.toFixed(1)} ${distUnit}</td>
                    <td class="py-2 px-3 text-right text-slate-900 font-medium">${segData.v_drop.toFixed(4)} V</td>
                    <td class="py-2 px-3 text-right text-teal-600 font-bold">${segVDropPct.toFixed(2)}%</td>
                    <td class="py-2 px-3 text-right text-rose-600 font-medium">${formatLoss}</td>
                `;
                lossBody.appendChild(tr);
            });

            // Synthesis specifications sheet writeup
            const bspec = res.bottle_spec;
            if (bspec) {
                document.getElementById('spec-output').innerHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                        <div><span class="text-teal-400">Section Count :</span> ${segmentsList.length} distinct segments</div>
                        <div><span class="text-teal-400">Critical Bottleneck:</span> ${bspec.wire.label} (${bspec.wire.area} mm²)</div>
                        <div><span class="text-teal-400">Insulation Limit:</span> ${insulation.limit}°C</div>
                        <div><span class="text-teal-400">Sys Resistance :</span> ${res.R_20_total.toFixed(5)} Ω @ 20°C</div>
                    </div>
                `;

                // Solver trace tab updates
                const traceBody = document.getElementById('trace-table-body');
                traceBody.innerHTML = '';
                res.bottle_hist.forEach(stp => {
                    const tr = document.createElement('tr');
                    tr.className = "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors";
                    tr.innerHTML = `
                        <td class="py-2 px-3 font-semibold text-slate-500">#${stp.iteration}</td>
                        <td class="py-2 px-3 font-bold text-slate-800">${stp.temperature.toFixed(4)} °C</td>
                        <td class="py-2 px-3 text-slate-500">${stp.resistivity.toExponential(4)}</td>
                        <td class="py-2 px-3 text-slate-600">${(stp.resistancePerMeter * 1000).toFixed(4)}</td>
                        <td class="py-2 px-3 text-teal-600 font-medium">${stp.powerLossPerMeter.toFixed(4)}</td>
                        <td class="py-2 px-3 text-rose-600 font-bold">+${stp.tempRise.toFixed(4)} °C</td>
                    `;
                    traceBody.appendChild(tr);
                });

                document.getElementById('thermal-details-block').innerHTML = `
                    <p class="font-bold text-teal-700 mb-1.5 flex items-center gap-1">
                        <i data-lucide="microscope" class="w-4 h-4"></i> Segment Thermodynamic Synthesis
                    </p>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div><span class="text-slate-400 font-medium">R_ins:</span> ${bspec.R_ins.toFixed(5)} K·m/W</div>
                        <div><span class="text-slate-400 font-medium">R_conv:</span> ${bspec.R_conv.toFixed(5)} K·m/W</div>
                        <div><span class="text-slate-400 font-medium">Total:</span> ${bspec.thermal_r.toFixed(5)} K·m/W</div>
                    </div>
                    <p class="mt-2 text-slate-500">Heat output equilibrates at <strong class="text-teal-600">${(Math.pow(current, 2) * bspec.r_per_m).toFixed(3)} W/m</strong>.</p>
                `;
                lucide.createIcons();
            }

            // Populate Optimization Sizing Matrix Table
            const optBody = document.getElementById('opt-matrix-body');
            optBody.innerHTML = '';
            
            [-2, -1, 0, 1, 2, 3].forEach(offset => {
                let valid = true;
                const optSegments = [];

                for (let s of segmentsList) {
                    const newIdx = s.idx + offset;
                    const dataset = s.std === 'AWG' ? AWG_DATA : METRIC_DATA;
                    if (newIdx < 0 || newIdx >= dataset.length) {
                        valid = false;
                        break;
                    }
                    optSegments.push({
                        wire: dataset[newIdx],
                        length_m: s.length_m,
                        std: s.std,
                        idx: newIdx
                    });
                }

                if (!valid) return;

                const optRes = evaluateCircuit(optSegments, activePhase, voltage, current, pf, ambC, material, insulation, install, customThickness);

                const tr = document.createElement('tr');
                const isActive = offset === 0;
                tr.className = isActive 
                    ? "bg-teal-50 dark:bg-teal-950/20 border-y-2 border-teal-200 dark:border-teal-800 font-semibold" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors";

                const shiftLabel = offset > 0 ? `+${offset} Size` : (offset < 0 ? `${offset} Size` : "Active Base");
                
                const avgArea = optSegments.reduce((sum, os) => sum + os.wire.area, 0) / optSegments.length;

                const tempColor = optRes.max_temp > insulation.limit ? "text-rose-600 font-bold" : "text-emerald-600 font-bold";
                const dropColor = optRes.v_pct > dropLimit ? "text-amber-600 font-bold" : "text-slate-900 dark:text-slate-100";

                tr.innerHTML = `
                    <td class="py-2.5 px-3 text-slate-900 dark:text-slate-100 font-bold">${shiftLabel}</td>
                    <td class="py-2.5 px-3 text-slate-500 dark:text-slate-400">~${avgArea.toFixed(2)} mm²</td>
                    <td class="py-2.5 px-3 ${tempColor}">${optRes.max_temp.toFixed(1)}°C</td>
                    <td class="py-2.5 px-3 text-slate-400 dark:text-slate-500">+${optRes.max_temp_rise.toFixed(1)}°C</td>
                    <td class="py-2.5 px-3 ${dropColor}">${optRes.v_pct.toFixed(2)}%</td>
                    <td class="py-2.5 px-3 text-slate-600 dark:text-slate-300">${optRes.p_loss >= 1000 ? (optRes.p_loss / 1000).toFixed(2) + ' kW' : optRes.p_loss.toFixed(1) + ' W'}</td>
                `;

                optBody.appendChild(tr);
            });
        }

        // Draw Interactive SVG heat map
        function drawSplicingHeatMap(segmentsCalculated, limitTemp) {
            const container = document.getElementById('svg-visualization-container');
            container.innerHTML = '';

            const width = 600;
            const height = 100;
            const paddingX = 20;

            const totalMeters = segmentsCalculated.reduce((sum, seg) => sum + seg.length_m, 0);
            if (totalMeters <= 0) return;

            // Maximum diameter for scaling wire thickness representation
            const maxDOuter = Math.max(...segmentsCalculated.map(seg => seg.wire.d_outer));

            let currentX = paddingX;
            const drawWidth = width - (paddingX * 2);

            let svgContent = `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" class="overflow-visible font-sans">`;

            // Draw terminal blocks on either end
            svgContent += `<circle cx="${paddingX - 8}" cy="${height/2}" r="6" fill="#475569" />`;
            svgContent += `<line x1="${paddingX - 14}" y1="${height/2}" x2="${paddingX - 2}" y2="${height/2}" stroke="#475569" stroke-width="2" />`;
            
            svgContent += `<circle cx="${width - paddingX + 8}" cy="${height/2}" r="6" fill="#475569" />`;
            svgContent += `<line x1="${width - paddingX + 2}" y1="${height/2}" x2="${width - paddingX + 14}" y2="${height/2}" stroke="#475569" stroke-width="2" />`;

            segmentsCalculated.forEach((seg, i) => {
                const segWidth = (seg.length_m / totalMeters) * drawWidth;
                
                // Wire visual diameter representation scaled proportionally
                const relativeD = (seg.wire.d_outer / maxDOuter) * 30 + 8; // min 8px, max 38px
                const segY = (height / 2) - (relativeD / 2);

                // Thermal color mapping: Slate Blue (Cool) to Crimson Red (Hot)
                const tempRatio = Math.min(1, Math.max(0, seg.temp / limitTemp));
                let color;
                if (tempRatio < 0.5) {
                    // Interpolate between cool slate #64748b (R:100 G:116 B:139) and amber-orange #f59e0b (R:245 G:158 B:11)
                    const r = Math.round(100 + (245 - 100) * (tempRatio * 2));
                    const g = Math.round(116 + (158 - 116) * (tempRatio * 2));
                    const b = Math.round(139 + (11 - 139) * (tempRatio * 2));
                    color = `rgb(${r}, ${g}, ${b})`;
                } else {
                    // Interpolate between amber-orange #f59e0b (R:245 G:158 B:11) and crimson-red #e11d48 (R:225 G:29 B:72)
                    const factor = (tempRatio - 0.5) * 2;
                    const r = Math.round(245 + (225 - 245) * factor);
                    const g = Math.round(158 + (29 - 158) * factor);
                    const b = Math.round(11 + (72 - 11) * factor);
                    color = `rgb(${r}, ${g}, ${b})`;
                }

                // Spliced Cable Segment block
                svgContent += `
                    <rect x="${currentX}" y="${segY}" width="${segWidth}" height="${relativeD}" 
                          fill="${color}" rx="3" stroke="#ffffff" stroke-width="1.5" class="transition-all duration-300">
                        <title>Segment ${i+1}: ${seg.label} | Temp: ${seg.temp.toFixed(1)}°C</title>
                    </rect>
                `;

                // Text Annotations for Gauge sizes
                svgContent += `
                    <text x="${currentX + (segWidth/2)}" y="${(height/2) - (relativeD/2) - 8}" 
                          font-size="9" font-weight="bold" fill="${document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#334155'}" text-anchor="middle">
                        ${seg.label}
                    </text>
                    <text x="${currentX + (segWidth/2)}" y="${(height/2) + (relativeD/2) + 12}" 
                          font-size="9" font-weight="bold" fill="${seg.temp > limitTemp ? '#ef4444' : (document.documentElement.classList.contains('dark') ? '#94a3b8' : '#475569')}" text-anchor="middle">
                        ${seg.temp.toFixed(1)}°C
                    </text>
                `;

                // Segment partition indicator dots inside the series
                if (i > 0) {
                    svgContent += `
                        <line x1="${currentX}" y1="2" x2="${currentX}" y2="${height - 2}" 
                              stroke="#cbd5e1" stroke-dasharray="2 3" stroke-width="1" />
                        <circle cx="${currentX}" cy="${height/2}" r="3" fill="#cbd5e1" />
                    `;
                }

                currentX += segWidth;
            });

            svgContent += `</svg>`;
            container.innerHTML = svgContent;
        }

        // Apply pre-configured library scenarios
        function applyPreset(presetKey) {
            const config = PRESETS[presetKey];
            if (!config) return;
            loadStateObject(config);
        }

        // Load complete data setup structure
        function loadStateObject(state) {
            // Unblock signals while reloading to let standard routines settle smoothly
            document.getElementById('voltage-input').value = state.voltage;
            document.getElementById('current-input').value = state.current;
            document.getElementById('pf-input').value = state.pf || 1.0;
            document.getElementById('vdrop-limit-input').value = state.allowableDrop || 3.0;
            document.getElementById('dist-unit-select').value = state.distUnit || 'mm';
            document.getElementById('material-select').value = state.material || 'copper';
            document.getElementById('insulation-select').value = state.insulation || 'AWM_PVC';
            document.getElementById('install-select').value = state.routing || 'conduit';
            document.getElementById('ambient-temp-input').value = state.ambientTemp !== undefined ? state.ambientTemp : 30;
            document.getElementById('ambient-unit-select').value = state.ambientUnit || 'C';

            // Set lastAmbientUnit globally
            lastAmbientUnit = state.ambientUnit || 'C';

            // Phase
            setPhase(state.phase || 'dc');
            onInsulationChanged();

            // Populate table segments
            const tbody = document.getElementById('segments-body');
            tbody.innerHTML = '';
            
            const segs = state.segments || [];
            segs.forEach(seg => {
                addSegmentRow(seg.standard, seg.sizeIdx, seg.length);
            });

            triggerCalculate();
        }

        // Export active model to local JSON File download
        function exportStateJSON() {
            const state = captureCurrentState();
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", `cable-solver-spec-${Date.now()}.json`);
            dlAnchorElem.click();
        }

        // Import model configuration from JSON file
        function importStateJSON(event) {
            const input = event.target;
            const reader = new FileReader();
            reader.onload = function() {
                try {
                    const parsed = JSON.parse(reader.result);
                    loadStateObject(parsed);
                    input.value = ''; // Clear file input field
                } catch (e) {
                    showAlert('File Error', 'The uploaded file is not a valid Cable Solver JSON scheme.');
                }
            };
            if (input.files[0]) {
                reader.readAsText(input.files[0]);
            }
        }

        // Create shareable state payload
        function captureCurrentState() {
            const segments = [];
            const tbody = document.getElementById('segments-body');
            Array.from(tbody.children).forEach(tr => {
                segments.push({
                    standard: tr.querySelector('.segment-std').value,
                    sizeIdx: parseInt(tr.querySelector('.segment-size').value) || 0,
                    length: parseFloat(tr.querySelector('.segment-length').value) || 0
                });
            });

            return {
                phase: activePhase,
                voltage: parseFloat(document.getElementById('voltage-input').value) || 12.0,
                current: parseFloat(document.getElementById('current-input').value) || 1.0,
                pf: parseFloat(document.getElementById('pf-input').value) || 1.0,
                allowableDrop: parseFloat(document.getElementById('vdrop-limit-input').value) || 3.0,
                distUnit: document.getElementById('dist-unit-select').value,
                material: document.getElementById('material-select').value,
                insulation: document.getElementById('insulation-select').value,
                routing: document.getElementById('install-select').value,
                ambientTemp: parseInt(document.getElementById('ambient-temp-input').value) || 30,
                ambientUnit: document.getElementById('ambient-unit-select').value,
                segments: segments
            };
        }

        // Generate dynamic hash URL for team sharing configurations
        function shareState() {
            const state = captureCurrentState();
            const stringified = JSON.stringify(state);
            const encoded = btoa(stringified);
            const shareUrl = `${window.location.origin}${window.location.pathname}?state=${encoded}`;

            // robust copying to clipboard supporting frames/sandboxes via traditional text area injection fallback
            const tempTextArea = document.createElement("textarea");
            tempTextArea.value = shareUrl;
            document.body.appendChild(tempTextArea);
            tempTextArea.select();
            
            try {
                document.execCommand('copy');
                showAlert('Link Copied!', 'A shareable link containing your exact active parameters and spliced segments has been copied to your clipboard.');
            } catch (err) {
                showAlert('Share link ready', `Copy this URL to share: ${shareUrl}`);
            }
            
            document.body.removeChild(tempTextArea);
        }


    
        // Theme Toggle Event Listener
        document.addEventListener('DOMContentLoaded', () => {
            const themeToggleBtn = document.getElementById("theme-toggle");
            if (themeToggleBtn) {
                themeToggleBtn.addEventListener("click", () => {
                    const isDark = document.documentElement.classList.contains('dark');
                    const newTheme = isDark ? 'light' : 'dark';
                    if (newTheme === 'dark') {
                        document.documentElement.classList.add('dark');
                        document.documentElement.setAttribute('data-theme', 'dark');
                    } else {
                        document.documentElement.classList.remove('dark');
                        document.documentElement.setAttribute('data-theme', 'light');
                    }
                    localStorage.setItem('theme', newTheme);
                    
                    // Trigger calculate to update SVG text colors
                    triggerCalculate();
                });
            }
        });

        // Register project manager hooks
        window.projectManagerConfig = {
            toolId: "wire-gauge",
            getInputs: () => captureCurrentState(),
            setInputs: (data) => loadStateObject(data)
        };

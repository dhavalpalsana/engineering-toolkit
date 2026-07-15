// Default framework structures
        const PRESETS = {
            manufacturing: {
                effect: "High rate of surface paint defect in motor housing assembly line 3",
                categories: [
                    { name: "Manpower (People)", causes: ["Lack of experience in sprayer gun speed", "Operator fatigue from double shift", "Inadequate inspection training"] },
                    { name: "Machine (Equipment)", causes: ["Nozzle pressure fluctuation on Line 3", "Clogged intake filters in dry chamber", "Spray arm alignment out of specs"] },
                    { name: "Material", causes: ["Paint batch viscosity inconsistency", "Storage shelf moisture saturation", "Solvent contamination in drum"] },
                    { name: "Method (Process)", causes: ["Oven drying time shorted in schedule", "Incorrect pre-wash chemistry mix", "Wipe-down stage done too quickly"] },
                    { name: "Measurement", causes: ["Wet-film thickness gauge uncalibrated", "Visual check has ambient light variance", "Inspector records incomplete data"] },
                    { name: "Milieu (Environment)", causes: ["Humidity surges during rainy days", "Drafts bringing dust from loading dock", "Temperature cooling section swings"] }
                ]
            },
            software: {
                effect: "High count of post-release bugs and memory leaks in Version 4.1",
                categories: [
                    { name: "People", causes: ["Devs rushed to meet fixed-deadline", "QA team lacks stress test experience", "Communication gap on API contract"] },
                    { name: "Process", causes: ["No mandatory secondary code reviews", "Lack of automated integration testing", "Incomplete unit testing coverage"] },
                    { name: "Product (Software)", causes: ["Memory leaks in third-party graph library", "Database indexes missing on user ID query", "Async events lack fallback timeout"] },
                    { name: "Platform (Infra)", causes: ["Staging environment mismatch", "Connection pool limit set too low", "Heavy logs filling root volume"] },
                    { name: "Place (Local Vars)", causes: ["Local node version disparity", "Mismatched environment configuration files", "Different docker file caching levels"] }
                ]
            },
            marketing: {
                effect: "Drop in customer conversion rates on premium subscription checkout",
                categories: [
                    { name: "Product", causes: ["Slow loading time on checkout button", "Confusing 3-step checkout flow", "Mobile rendering cuts price tier text"] },
                    { name: "Price", causes: ["High initial sign-up barrier", "Mismatched localization currency conversion", "No pricing transparency page"] },
                    { name: "Place", causes: ["Broken deep links from newsletter promotion", "CDN latency spikes on images", "Checkout button below fold on mobile"] },
                    { name: "Promotion", causes: ["Inconsistent coupon code duration", "Landing page highlights wrong feature set", "Retargeting ads link to main homepage"] },
                    { name: "People", causes: ["No live chat assistance for checkouts", "Long wait times on payment queries", "Support lacks access to retry transactions"] },
                    { name: "Process", causes: ["Payment processor throws obscure declines", "Password recovery loop on register", "No email reminder for abandoned carts"] }
                ]
            },
            blank: {
                effect: "State the problem statement or visual effect here",
                categories: [
                    { name: "Category A", causes: ["Primary cause 1", "Primary cause 2"] },
                    { name: "Category B", causes: ["Primary cause 3"] },
                    { name: "Category C", causes: [] }
                ]
            }
        };

        // Palette definitions
        const PALETTES = {
            teal: {
                primary: '#0d9488', // teal-600
                primaryLight: '#2dd4bf', // teal-400
                primaryDeep: '#0f766e', // teal-700
                primaryGlow: 'rgba(13, 148, 136, 0.12)',
                accent: '#0284c7', // sky-600
                textOnPrimary: '#ffffff',
                bgGradient: ['#0f766e', '#115e59']
            },
            blue: {
                primary: '#2563eb', // blue-600
                primaryLight: '#60a5fa', // blue-400
                primaryDeep: '#1d4ed8', // blue-700
                primaryGlow: 'rgba(37, 99, 235, 0.12)',
                accent: '#db2777', // rose-600
                textOnPrimary: '#ffffff',
                bgGradient: ['#1d4ed8', '#1e40af']
            },
            crimson: {
                primary: '#db2777', // rose-600
                primaryLight: '#f472b6', // pink-400
                primaryDeep: '#be185d', // rose-700
                primaryGlow: 'rgba(219, 39, 119, 0.12)',
                accent: '#7c3aed', // violet-600
                textOnPrimary: '#ffffff',
                bgGradient: ['#be185d', '#9d174d']
            },
            emerald: {
                primary: '#059669', // emerald-600
                primaryLight: '#34d399', // emerald-400
                primaryDeep: '#047857', // emerald-700
                primaryGlow: 'rgba(5, 150, 105, 0.12)',
                accent: '#d97706', // amber-600
                textOnPrimary: '#ffffff',
                bgGradient: ['#047857', '#065f46']
            },
            amber: {
                primary: '#d97706', // amber-600
                primaryLight: '#fbbf24', // amber-400
                primaryDeep: '#b45309', // amber-700
                primaryGlow: 'rgba(217, 119, 6, 0.12)',
                accent: '#dc2626', // red-600
                textOnPrimary: '#ffffff',
                bgGradient: ['#b45309', '#92400e']
            },
            slate: {
                primary: '#475569', // slate-600
                primaryLight: '#94a3b8', // slate-400
                primaryDeep: '#334155', // slate-700
                primaryGlow: 'rgba(71, 85, 105, 0.12)',
                accent: '#0d9488', // teal-600
                textOnPrimary: '#ffffff',
                bgGradient: ['#334155', '#1e293b']
            }
        };

        // Status definitions and styling configs
        const STATUS_CONFIG = {
            'todo': {
                label: 'To-Do',
                bgLight: 'rgba(241, 245, 249, 0.65)',
                textLight: '#475569',
                borderLight: '#cbd5e1',
            },
            'under-investigation': {
                label: 'Under Investigation',
                bgLight: 'rgba(254, 243, 199, 0.7)',
                textLight: '#b45309',
                borderLight: '#f59e0b',
            },
            'ruled-out': {
                label: 'Ruled Out',
                bgLight: 'rgba(254, 226, 226, 0.7)',
                textLight: '#b91c1c',
                borderLight: '#f87171',
            },
            'confirmed-cause': {
                label: 'Confirmed Cause',
                bgLight: 'rgba(209, 250, 229, 0.75)',
                textLight: '#047857',
                borderLight: '#34d399',
            }
        };

        function getCauseObj(cause) {
            if (!cause) {
                return { text: '', status: '', comment: '' };
            }
            if (typeof cause === 'string') {
                return { text: cause, status: '', comment: '' };
            }
            return {
                text: cause.text || '',
                status: cause.status || '',
                comment: cause.comment || ''
            };
        }

        function normalizeState() {
            if (!state.categories) state.categories = [];
            state.categories.forEach(cat => {
                if (!cat.causes) cat.causes = [];
                cat.causes = cat.causes.map(cause => getCauseObj(cause));
            });
        }

        function showCauseTooltip(event, catIdx, causeIdx) {
            const cause = state.categories[catIdx].causes[causeIdx];
            const causeObj = getCauseObj(cause);
            const text = causeObj.text || '';
            const status = causeObj.status || '';
            const comment = causeObj.comment || '';

            if (!status && !comment) return;

            const tooltip = document.getElementById('cause-tooltip');
            const tooltipStatus = document.getElementById('tooltip-status');
            const tooltipText = document.getElementById('tooltip-text');
            const tooltipComment = document.getElementById('tooltip-comment');
            
            tooltipText.textContent = text;

            if (status) {
                const config = STATUS_CONFIG[status];
                tooltipStatus.textContent = config ? config.label : status;
                
                let colorClass = 'text-slate-400';
                if (status === 'todo') colorClass = 'text-slate-400';
                else if (status === 'under-investigation') colorClass = 'text-amber-400';
                else if (status === 'ruled-out') colorClass = 'text-rose-400';
                else if (status === 'confirmed-cause') colorClass = 'text-emerald-400';
                
                tooltipStatus.className = `font-bold text-[10px] uppercase tracking-wider ${colorClass}`;
                tooltipStatus.classList.remove('hidden');
            } else {
                tooltipStatus.classList.add('hidden');
            }

            if (comment) {
                tooltipComment.textContent = `Comment: ${comment}`;
                tooltipComment.classList.remove('hidden');
            } else {
                tooltipComment.classList.add('hidden');
            }

            tooltip.classList.remove('hidden');
            
            const mouseX = event.clientX;
            const mouseY = event.clientY;
            
            let posX = mouseX + 15;
            let posY = mouseY + 15;
            
            if (posX + 200 > window.innerWidth) {
                posX = mouseX - 220;
            }
            if (posY + 100 > window.innerHeight) {
                posY = mouseY - 110;
            }
            
            tooltip.style.left = `${posX}px`;
            tooltip.style.top = `${posY}px`;
        }

        function hideCauseTooltip() {
            const tooltip = document.getElementById('cause-tooltip');
            if (tooltip) tooltip.classList.add('hidden');
        }

        // Application State
        let state = {
            effect: PRESETS.software.effect,
            categories: JSON.parse(JSON.stringify(PRESETS.software.categories)),
            theme: 'teal',
            shapeStyle: 'rounded',
            lineStyle: 'solid',
            layout: {
                branchWidth: 110,
                boneOffset: 110,
                fontScale: 1.0
            }
        };

        // Viewport Transformation State (Zoom & Pan)
        let translateX = 0;
        let translateY = 0;
        let scale = 1.0;
        let isDragging = false;
        let startX = 0;
        let startY = 0;

        // Current active editor tab
        let activeTab = 'structure';

        // Undo/Redo Stacks
        const historyLimit = 30;
        let undoStack = [];
        let redoStack = [];

        // Inline Editor Tracking State
        let inlineEditingTarget = null; // { type: 'effect' } or { type: 'category', index } or { type: 'cause', catIndex, causeIndex }

        // DOM Elements
        const svgElement = document.getElementById('fishbone-svg');
        const viewportGroup = document.getElementById('viewport-group');
        const fishboneContent = document.getElementById('fishbone-content');
        const categoriesEditorList = document.getElementById('categories-editor-list');
        const effectInput = document.getElementById('effect-input');
        const inlineEditorContainer = document.getElementById('inline-editor-container');
        const inlineEditorTextarea = document.getElementById('inline-editor-textarea');

        // Document Load Init
        window.addEventListener('DOMContentLoaded', () => {
            // Check for compressed state in shareable link
            const urlParams = new URLSearchParams(window.location.search);
            const dataParam = urlParams.get('data');
            if (dataParam) {
                try {
                    const decompressed = JSON.parse(atob(dataParam));
                    if (decompressed.effect && decompressed.categories) {
                        state = decompressed;
                    }
                } catch (e) {
                    console.error("Could not decompress state from URL parameter", e);
                }
            }



            // Initialize zoom/pan event listeners
            initZoomPanListeners();

            // Apply loaded config parameters to sliders
            initSliders();

            // Set UI according to loaded values
            pushHistory(); // first history state
            switchTab('structure');
            syncThemeUI();
            updateUI();
            // Fit canvas initially and after layout settles
            fitCanvas();
            setTimeout(fitCanvas, 50);
            setTimeout(fitCanvas, 250);

            // Use ResizeObserver to automatically fit canvas when its container size changes
            const canvasContainer = document.getElementById('canvas-container');
            if (canvasContainer && window.ResizeObserver) {
                const resizeObserver = new ResizeObserver(() => {
                    fitCanvas();
                });
                resizeObserver.observe(canvasContainer);
            } else {
                window.addEventListener('resize', fitCanvas);
                window.addEventListener('load', fitCanvas);
            }

            // Lucide initialize
            lucide.createIcons();
        });

        function initSliders() {
            document.getElementById('slider-branch-width').value = state.layout?.branchWidth || 110;
            document.getElementById('slider-bone-offset').value = state.layout?.boneOffset || 110;
            document.getElementById('slider-font-scale').value = state.layout?.fontScale || 1.0;

            document.getElementById('label-val-branch-width').textContent = (state.layout?.branchWidth || 110) + 'px';
            document.getElementById('label-val-bone-offset').textContent = (state.layout?.boneOffset || 110) + 'px';
            document.getElementById('label-val-font-scale').textContent = (state.layout?.fontScale || 1.0).toFixed(2);
        }

        // --- HISTORY MANAGEMENT ---
        function syncUndoRedoUI() {
            const undoBtn = document.getElementById('undo-btn');
            const redoBtn = document.getElementById('redo-btn');
            if (undoBtn) undoBtn.disabled = undoStack.length <= 1;
            if (redoBtn) redoBtn.disabled = redoStack.length === 0;
        }

        function pushHistory() {
            const stateClone = JSON.stringify(state);
            // Don't push duplicates
            if (undoStack.length > 0 && undoStack[undoStack.length - 1] === stateClone) return;
            
            undoStack.push(stateClone);
            if (undoStack.length > historyLimit) {
                undoStack.shift();
            }
            redoStack = []; // Clear redo on action
            syncUndoRedoUI();
        }

        function triggerUndo() {
            if (undoStack.length > 1) {
                const current = undoStack.pop();
                redoStack.push(current);
                const prev = undoStack[undoStack.length - 1];
                state = JSON.parse(prev);
                initSliders();
                updateUI();
                syncUndoRedoUI();
            }
        }

        function triggerRedo() {
            if (redoStack.length > 0) {
                const next = redoStack.pop();
                undoStack.push(next);
                state = JSON.parse(next);
                initSliders();
                updateUI();
                syncUndoRedoUI();
            }
        }

        // Handle global keys (Undo, Redo, Esc, Save)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    triggerRedo();
                } else {
                    triggerUndo();
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                triggerRedo();
            }
        });

        // --- PALETTE UI SYNC ---
        function syncThemeUI() {
            // Colors update of options
            document.querySelectorAll('.palette-option').forEach(btn => {
                const pid = btn.id.replace('palette-btn-', '');
                if (pid === state.theme) {
                    btn.classList.add('border-teal-600');
                    btn.classList.remove('border-transparent');
                } else {
                    btn.classList.remove('border-teal-600');
                    btn.classList.add('border-transparent');
                }
            });

            document.querySelectorAll('.shape-option').forEach(btn => {
                const sid = btn.id.replace('shape-btn-', '');
                if (sid === state.shapeStyle) {
                    btn.classList.add('bg-teal-600', 'text-white', 'border-teal-600');
                    btn.classList.remove('border-slate-200', 'text-slate-700');
                } else {
                    btn.classList.remove('bg-teal-600', 'text-white', 'border-teal-600');
                    btn.classList.add('border-slate-200', 'text-slate-700');
                }
            });

            document.querySelectorAll('.line-option').forEach(btn => {
                const lid = btn.id.replace('line-btn-', '');
                if (lid === state.lineStyle) {
                    btn.classList.add('bg-teal-600', 'text-white', 'border-teal-600');
                    btn.classList.remove('border-slate-200', 'text-slate-700');
                } else {
                    btn.classList.remove('bg-teal-600', 'text-white', 'border-teal-600');
                    btn.classList.add('border-slate-200', 'text-slate-700');
                }
            });
        }

        function setPalette(pid) {
            pushHistory();
            state.theme = pid;
            syncThemeUI();
            updateUI();
        }

        function setShapeStyle(sid) {
            pushHistory();
            state.shapeStyle = sid;
            syncThemeUI();
            updateUI();
        }

        function setLineStyle(lid) {
            pushHistory();
            state.lineStyle = lid;
            syncThemeUI();
            updateUI();
        }

        function updateLayoutParam(key, val) {
            if (!state.layout) state.layout = {};
            
            let floatVal = parseFloat(val);
            state.layout[key] = floatVal;

            if (key === 'branchWidth') {
                document.getElementById('label-val-branch-width').textContent = floatVal + 'px';
            } else if (key === 'boneOffset') {
                document.getElementById('label-val-bone-offset').textContent = floatVal + 'px';
            } else if (key === 'fontScale') {
                document.getElementById('label-val-font-scale').textContent = floatVal.toFixed(2);
            }
            
            updateUI();
        }

        // --- TABS SWITCHING ---
        function switchTab(tabId) {
            activeTab = tabId;
            document.querySelectorAll("[id^='tab-btn-']").forEach(btn => {
                btn.classList.remove('tab-active', 'border-teal-600');
                btn.classList.add('text-slate-500');
            });
            document.querySelectorAll("[id^='tab-content-']").forEach(content => {
                content.classList.add('hidden');
            });

            const activeBtn = document.getElementById('tab-btn-' + tabId);
            if (activeBtn) {
                activeBtn.classList.add('tab-active', 'border-teal-600');
                activeBtn.classList.remove('text-slate-500');
            }
            const activeContent = document.getElementById('tab-content-' + tabId);
            if (activeContent) {
                activeContent.classList.remove('hidden');
            }
        }

        // --- PRESETS APPLY ---
        function applyPreset(presetId) {
            if (presetId === 'blank' || PRESETS[presetId]) {
                pushHistory();
                state.effect = PRESETS[presetId].effect;
                state.categories = JSON.parse(JSON.stringify(PRESETS[presetId].categories));
                updateUI();
                fitCanvas();
                setTimeout(fitCanvas, 50);
            }
        }
        window.applyPreset = applyPreset;

        // --- DATA STATE MODIFICATIONS ---
        function updateEffect(val) {
            pushHistory();
            state.effect = val;
            renderFishbone();
        }

        function updateCategoryName(index, name) {
            pushHistory();
            state.categories[index].name = name;
            updateUI();
        }

        function addCategory() {
            pushHistory();
            state.categories.push({
                name: `Category ${state.categories.length + 1}`,
                causes: []
            });
            updateUI();
        }

        function deleteCategory(index) {
            pushHistory();
            state.categories.splice(index, 1);
            updateUI();
        }

        function toggleCategoryCollapse(index) {
            const cat = state.categories[index];
            cat.collapsed = !cat.collapsed;
            renderSidebar();
        }

        function addCause(categoryIndex, causeVal = "") {
            pushHistory();
            const causeText = causeVal.trim() || `New Cause`;
            state.categories[categoryIndex].causes.push({
                text: causeText,
                status: '',
                comment: ''
            });
            updateUI();
            
            if (causeVal === "") {
                const causeIndex = state.categories[categoryIndex].causes.length - 1;
                setTimeout(() => {
                    triggerInlineEdit({ type: 'cause', catIndex: categoryIndex, causeIndex: causeIndex });
                }, 100);
            }
        }

        function updateCauseText(categoryIndex, causeIndex, val) {
            pushHistory();
            const cause = state.categories[categoryIndex].causes[causeIndex];
            if (typeof cause === 'string') {
                state.categories[categoryIndex].causes[causeIndex] = { text: val, status: '', comment: '' };
            } else {
                cause.text = val;
            }
            updateUI();
        }

        function updateCauseStatus(categoryIndex, causeIndex, status) {
            pushHistory();
            const cause = state.categories[categoryIndex].causes[causeIndex];
            if (typeof cause === 'string') {
                state.categories[categoryIndex].causes[causeIndex] = { text: cause, status: status, comment: '' };
            } else {
                cause.status = status;
            }
            updateUI();
        }

        function updateCauseComment(categoryIndex, causeIndex, comment) {
            pushHistory();
            const cause = state.categories[categoryIndex].causes[causeIndex];
            if (typeof cause === 'string') {
                state.categories[categoryIndex].causes[causeIndex] = { text: cause, status: '', comment: comment };
            } else {
                cause.comment = comment;
            }
            updateUI();
        }

        function deleteCause(categoryIndex, causeIndex) {
            pushHistory();
            state.categories[categoryIndex].causes.splice(causeIndex, 1);
            updateUI();
        }

        // --- SIDEBAR UI RENDERER ---
        function renderSidebar() {
            effectInput.value = state.effect;

            categoriesEditorList.innerHTML = "";
            state.categories.forEach((cat, catIdx) => {
                const catCard = document.createElement("div");
                catCard.className = "border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50";
                
                const isCollapsed = !!cat.collapsed;
                const chevronIcon = isCollapsed ? 'chevron-right' : 'chevron-down';

                catCard.innerHTML = `
                    <div class="bg-slate-100/50 p-2 flex items-center justify-between gap-2 border-b border-slate-100">
                        <div class="flex items-center gap-1 w-full">
                            <button onclick="toggleCategoryCollapse(${catIdx})" class="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-950 rounded-lg transition-all shrink-0" title="${isCollapsed ? 'Expand' : 'Collapse'} Category">
                                <i data-lucide="${chevronIcon}" class="w-4 h-4"></i>
                            </button>
                            <input type="text" value="${escapeHtml(cat.name)}" 
                                   onchange="updateCategoryName(${catIdx}, this.value)"
                                   class="bg-transparent border-0 hover:bg-white focus:bg-white text-xs font-bold text-slate-800 px-1.5 py-0.5 rounded focus:ring-1 focus:ring-teal-500 w-full focus:outline-none font-semibold" />
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                            <button onclick="addCause(${catIdx})" class="p-1 hover:bg-slate-200 text-slate-500 hover:text-slate-950 rounded-lg transition-all" title="Add Cause">
                                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                            </button>
                            <button onclick="deleteCategory(${catIdx})" class="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all" title="Delete Category">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </div>
                    <div class="p-2.5 space-y-1.5 ${isCollapsed ? 'hidden' : ''}" id="cat-causes-${catIdx}">
                    </div>
                `;

                const causesContainer = catCard.querySelector(`#cat-causes-${catIdx}`);
                if (cat.causes.length === 0) {
                    causesContainer.innerHTML = `<p class="text-[10px] text-slate-400 font-medium italic p-1">No causes registered. Click plus icon to add.</p>`;
                } else {
                    cat.causes.forEach((cause, causeIdx) => {
                        const causeObj = getCauseObj(cause);
                        const causeCard = document.createElement("div");
                        causeCard.className = "border border-slate-200 rounded-xl p-2 bg-white space-y-1.5 group shadow-sm transition-all hover:border-slate-300";
                        
                        causeCard.innerHTML = `
                            <!-- Cause Text Row -->
                            <div class="flex items-start gap-1.5">
                                <textarea rows="1" onchange="updateCauseText(${catIdx}, ${causeIdx}, this.value)"
                                          class="w-full bg-transparent border-0 hover:bg-slate-50 focus:bg-slate-50 focus:ring-1 focus:ring-teal-500 rounded px-1.5 py-0.5 text-xs text-slate-700 focus:outline-none font-medium resize-none leading-normal overflow-hidden">${escapeHtml(causeObj.text)}</textarea>
                                <button onclick="deleteCause(${catIdx}, ${causeIdx})" class="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100" title="Delete Cause">
                                    <i data-lucide="x" class="w-3.5 h-3.5"></i>
                                </button>
                            </div>
                            <!-- Status & Comment Row -->
                            <div class="flex items-center gap-1.5 text-[10px] pt-1.5 border-t border-slate-100">
                                <select onchange="updateCauseStatus(${catIdx}, ${causeIdx}, this.value)" 
                                        class="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500 shrink-0 cursor-pointer max-w-[110px]">
                                    <option value="" ${causeObj.status === '' ? 'selected' : ''}>No Status</option>
                                    <option value="todo" ${causeObj.status === 'todo' ? 'selected' : ''}>To-Do</option>
                                    <option value="under-investigation" ${causeObj.status === 'under-investigation' ? 'selected' : ''}>Under Investigation</option>
                                    <option value="ruled-out" ${causeObj.status === 'ruled-out' ? 'selected' : ''}>Ruled Out</option>
                                    <option value="confirmed-cause" ${causeObj.status === 'confirmed-cause' ? 'selected' : ''}>Confirmed Cause</option>
                                </select>
                                <input type="text" placeholder="Add comments/notes..." value="${escapeHtml(causeObj.comment)}" 
                                       onchange="updateCauseComment(${catIdx}, ${causeIdx}, this.value)" 
                                       class="w-full bg-slate-50/50 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] text-slate-600 focus:outline-none focus:border-teal-500 focus:bg-white" />
                            </div>
                        `;

                        const textarea = causeCard.querySelector('textarea');
                        textarea.addEventListener('input', function() {
                            this.style.height = 'auto';
                            this.style.height = this.scrollHeight + 'px';
                        });
                        setTimeout(() => {
                            textarea.style.height = 'auto';
                            textarea.style.height = textarea.scrollHeight + 'px';
                        }, 10);

                        causesContainer.appendChild(causeCard);
                    });
                }

                categoriesEditorList.appendChild(catCard);
            });

            lucide.createIcons({
                attrs: {
                    class: "w-3.5 h-3.5"
                }
            });
        }

        function escapeHtml(text) {
            return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        // --- DYNAMIC SVG RENDERING ---
        function updateUI() {
            normalizeState();
            renderSidebar();
            renderDefs();
            renderFishbone();
        }

        function renderDefs() {
            const defs = document.getElementById('svg-defs');
            const pal = PALETTES[state.theme] || PALETTES.teal;
            const gridColor = '#cbd5e1';
            const shadowColor = 'rgba(15,23,42,0.08)';

            defs.innerHTML = `
                <pattern id="grid-pattern" width="30" height="30" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1.2" fill="${gridColor}" />
                </pattern>
                
                <filter id="box-shadow" x="-10%" y="-10%" width="120%" height="130%" filterUnits="userSpaceOnUse">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="${shadowColor}" flood-opacity="0.8" />
                </filter>

                <marker id="spine-arrow" markerWidth="12" markerHeight="12" refX="2" refY="6" orient="auto" markerUnits="strokeWidth">
                    <path d="M2,2 L10,6 L2,10 L4,6 Z" fill="${pal.primary}" />
                </marker>

                <linearGradient id="head-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="${pal.primary}" />
                    <stop offset="100%" stop-color="${pal.primaryDeep}" />
                </linearGradient>
            `;
        }

        function svgWrapText(text, maxWidth, fontSize) {
            const words = text.split(/\s+/);
            const lines = [];
            let currentLine = "";

            const maxCharsPerLine = Math.floor(maxWidth / (fontSize * 0.52));

            words.forEach(word => {
                if (currentLine.length + word.length + 1 <= maxCharsPerLine) {
                    currentLine += (currentLine === "" ? "" : " ") + word;
                } else {
                    if (currentLine !== "") {
                        lines.push(currentLine);
                    }
                    currentLine = word;
                }
            });
            if (currentLine !== "") {
                lines.push(currentLine);
            }

            return lines;
        }        // Stores dynamically-computed SVG canvas dimensions for fitCanvas()
        let _svgW = 1000, _svgH = 600;

        function renderFishbone() {
            const pal = PALETTES[state.theme] || PALETTES.teal;
            const fontScale = state.layout?.fontScale || 1.0;
            const branchWidth = state.layout?.branchWidth || 110;
            const boneOffset = state.layout?.boneOffset || 110;

            const textPrimaryColor = '#0f172a';
            const textMutedColor   = '#475569';
            const boneColor        = '#cbd5e1';

            const C           = state.categories.length;
            const causeFontSz = Math.round(10 * fontScale);
            const LINE_H      = causeFontSz + 3.5;   // px per wrapped line
            const CAUSE_PAD   = 11;                   // vertical gap between successive cause blocks
            const START_PAD   = 18;                   // gap from bone tip to first cause
            const USABLE_FRAC = 0.82;                 // causes use this fraction of bone span

            // Layout constants.
            // xMin=300  → leftmost bone tip at x=190, giving ≥branchWidth of cause space
            //             at every attachment point on that bone.
            // MIN_CAT_SPACING=165 → same-side bones are 330 px apart, so even the
            //             second same-side category has 220 px of cause room at its tip.
            const spineStart      = 60;
            const xMin            = 300;
            const MIN_CAT_SPACING = 165;
            const headW           = 180;
            const headMargin      = 20;

            // ── PHASE 1: compute minBoneVSpan from actual wrapped-text heights ──────
            // We use branchWidth as a conservative estimate of cause width; for most
            // categories the real available width will be ≥ this, so wrapping produces
            // ≤ lines ⟹ actual height ≤ estimated ⟹ no overflow.
            const maxBoneTextH = C === 0 ? 0 : Math.max(...state.categories.map(cat =>
                cat.causes.reduce((sum, cause) => {
                    const obj   = getCauseObj(cause);
                    const lines = svgWrapText(obj.text, branchWidth - 6, causeFontSz);
                    return sum + lines.length * LINE_H + CAUSE_PAD;
                }, START_PAD)   // begin accumulation with the initial gap from bone tip
            ));

            const minBoneVSpan = Math.max(225, Math.ceil(maxBoneTextH / USABLE_FRAC));
            const SVG_PAD_V    = 90;
            const svgHeight    = Math.max(600, 2 * (minBoneVSpan + SVG_PAD_V));
            const spineY       = svgHeight / 2;
            const yOuterTop    = spineY - minBoneVSpan;
            const yOuterBottom = spineY + minBoneVSpan;

            // ── Width: expand to fit all categories without crowding ─────────────────
            const minCatSpread = C > 1 ? (C - 1) * MIN_CAT_SPACING : 0;
            const xMax         = Math.max(720, xMin + minCatSpread);
            const spineEnd     = xMax + boneOffset + headMargin;
            const svgWidth     = Math.max(1000, spineEnd + headW + 30);
            const spineSpacing = C > 1 ? (xMax - xMin) / (C - 1) : 0;

            _svgW = svgWidth;
            _svgH = svgHeight;
            svgElement.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

            let g = '';

            // ── 1. SPINE ─────────────────────────────────────────────────────────────
            g += `
                <g class="spine-group">
                    <line x1="${spineStart}" y1="${spineY}" x2="${spineEnd}" y2="${spineY}"
                          stroke="${pal.primary}" stroke-width="4.5" stroke-linecap="round" />
                    <path d="M${spineEnd},${spineY} L${spineEnd-16},${spineY-10} L${spineEnd-12},${spineY} L${spineEnd-16},${spineY+10} Z"
                          fill="${pal.primary}" />
                </g>
            `;

            // ── 2. EFFECT (HEAD) ─────────────────────────────────────────────────────
            const headX        = spineEnd + 15;
            const headH        = 90;
            const effectFontSz = Math.round(13 * fontScale);
            const wrappedEff   = svgWrapText(state.effect, headW - 20, effectFontSz);
            const effBoxY      = spineY - headH / 2;

            let headShape = '';
            if (state.shapeStyle === 'hexagon') {
                headShape = `<polygon points="${headX},${spineY} ${headX+30},${effBoxY} ${headX+headW-30},${effBoxY} ${headX+headW},${spineY} ${headX+headW-30},${effBoxY+headH} ${headX+30},${effBoxY+headH}"
                                       fill="url(#head-gradient)" stroke="${pal.primaryDeep}" stroke-width="2.5" filter="url(#box-shadow)" />`;
            } else if (state.shapeStyle === 'sharp') {
                headShape = `<rect x="${headX}" y="${effBoxY}" width="${headW}" height="${headH}"
                                   fill="url(#head-gradient)" stroke="${pal.primaryDeep}" stroke-width="2" filter="url(#box-shadow)" />`;
            } else {
                headShape = `<rect x="${headX}" y="${effBoxY}" width="${headW}" height="${headH}" rx="16" ry="16"
                                   fill="url(#head-gradient)" stroke="${pal.primaryDeep}" stroke-width="2.5" filter="url(#box-shadow)" />`;
            }

            const effLineSp  = effectFontSz + 4;
            const effTotalH  = wrappedEff.length * effLineSp;
            const effStartY  = spineY - effTotalH / 2 + effectFontSz - 2;

            g += `<g class="head-group cursor-pointer select-none" onclick="triggerInlineEdit({type:'effect'},event)">
                      ${headShape}
                      <text font-family="'Plus Jakarta Sans',sans-serif" font-size="${effectFontSz}" font-weight="700" fill="${pal.textOnPrimary}">`;
            wrappedEff.forEach((line, i) => {
                g += `<tspan x="${headX + headW/2}" y="${effStartY + i * effLineSp}" text-anchor="middle">${escapeHtml(line)}</tspan>`;
            });
            g += `</text>
                  <rect x="${headX}" y="${effBoxY}" width="${headW}" height="${headH}"
                        fill="transparent" stroke="transparent" class="hover:stroke-teal-300 hover:stroke-[2] transition-all" />
                </g>`;

            // ── 3. CATEGORIES & CAUSES ───────────────────────────────────────────────
            if (C > 0) {
                state.categories.forEach((cat, idx) => {
                    const isTop  = idx % 2 === 0;
                    const yDir   = isTop ? 1 : -1;   // +1 = downward for top bones, -1 = upward for bottom
                    const yOuter = isTop ? yOuterTop : yOuterBottom;
                    const xConn  = C > 1 ? xMin + idx * spineSpacing : (xMin + xMax) / 2;
                    const xOuter = xConn - boneOffset;

                    // Left boundary for causes.
                    // For the FIRST same-side bone there's no previous bone to the left;
                    // we set xLeft so that at EVERY attachment on this bone there is at
                    // least branchWidth px of usable cause space.
                    // For later same-side bones, xLeft = right edge of the previous bone.
                    const prevSameIdx = idx - 2;
                    const xLeft = prevSameIdx < 0
                        ? Math.max(spineStart + 5, xOuter - branchWidth - 10)
                        : (xMin + prevSameIdx * spineSpacing) + 20;

                    // Main bone line
                    g += `<line x1="${xOuter}" y1="${yOuter}" x2="${xConn}" y2="${spineY}"
                                stroke="${pal.primary}" stroke-width="3" stroke-linecap="round" />`;

                    // ── Category label box ───────────────────────────────────────────
                    const catW   = 145;
                    const catH   = 42;
                    const catBX  = xOuter - catW / 2;
                    const catBY  = isTop ? yOuter - catH : yOuter;
                    const catFSz = Math.round(11 * fontScale);
                    const bdrClr = pal.primary;
                    const fillClr= '#ffffff';

                    let catShape = '';
                    if (state.shapeStyle === 'hexagon') {
                        catShape = `<polygon points="${catBX},${catBY+catH/2} ${catBX+12},${catBY} ${catBX+catW-12},${catBY} ${catBX+catW},${catBY+catH/2} ${catBX+catW-12},${catBY+catH} ${catBX+12},${catBY+catH}"
                                             fill="${fillClr}" stroke="${bdrClr}" stroke-width="2" filter="url(#box-shadow)" />`;
                    } else if (state.shapeStyle === 'sharp') {
                        catShape = `<rect x="${catBX}" y="${catBY}" width="${catW}" height="${catH}"
                                          fill="${fillClr}" stroke="${bdrClr}" stroke-width="1.5" filter="url(#box-shadow)" />`;
                    } else {
                        catShape = `<rect x="${catBX}" y="${catBY}" width="${catW}" height="${catH}" rx="10" ry="10"
                                          fill="${fillClr}" stroke="${bdrClr}" stroke-width="2" filter="url(#box-shadow)" />`;
                    }

                    const wrCat    = svgWrapText(cat.name, catW - 12, catFSz);
                    const catTSp   = catFSz + 3;
                    const catTH    = wrCat.length * catTSp;
                    const catTY    = catBY + catH/2 - catTH/2 + catFSz - 2;
                    const plusX    = catBX + catW - 18;
                    const plusY    = catBY + 4;

                    g += `<g class="category-box group/cat cursor-pointer select-none" onclick="triggerInlineEdit({type:'category',index:${idx}},event)">
                              ${catShape}
                              <text font-family="'Plus Jakarta Sans',sans-serif" font-size="${catFSz}" font-weight="700" fill="${textPrimaryColor}">`;
                    wrCat.forEach((line, li) => {
                        g += `<tspan x="${xOuter}" y="${catTY + li * catTSp}" text-anchor="middle">${escapeHtml(line)}</tspan>`;
                    });
                    g += `</text>
                          <!-- Delete button -->
                          <g class="opacity-0 group-hover/cat:opacity-100 transition-opacity" onclick="event.stopPropagation();deleteCategory(${idx});">
                              <circle cx="${catBX+10}" cy="${catBY+10}" r="7.5" fill="#ef4444"/>
                              <line x1="${catBX+7.5}" y1="${catBY+7.5}" x2="${catBX+12.5}" y2="${catBY+12.5}" stroke="#fff" stroke-width="1.5"/>
                              <line x1="${catBX+12.5}" y1="${catBY+7.5}" x2="${catBX+7.5}" y2="${catBY+12.5}" stroke="#fff" stroke-width="1.5"/>
                          </g>
                          <!-- Add cause button -->
                          <g class="opacity-0 group-hover/cat:opacity-100 transition-opacity" onclick="event.stopPropagation();addCause(${idx});">
                              <circle cx="${plusX}" cy="${plusY+6}" r="7.5" fill="${pal.primary}"/>
                              <line x1="${plusX-4.5}" y1="${plusY+6}" x2="${plusX+4.5}" y2="${plusY+6}" stroke="#fff" stroke-width="1.5"/>
                              <line x1="${plusX}" y1="${plusY+1.5}" x2="${plusX}" y2="${plusY+10.5}" stroke="#fff" stroke-width="1.5"/>
                          </g>
                      </g>`;

                    // ── 3B. CAUSES – height-aware stacking ──────────────────────────
                    // Unlike the old uniform-t formula, we accumulate actual rendered
                    // text heights so that the attachment line of cause[i+1] always sits
                    // below the top edge of cause[i]'s text block, guaranteeing zero overlap.
                    const M = cat.causes.length;
                    if (M > 0) {
                        // Pass 1 – estimate heights (conservative: wrap at branchWidth)
                        const estHeights = cat.causes.map(cause => {
                            const obj   = getCauseObj(cause);
                            const lines = svgWrapText(obj.text, branchWidth - 6, causeFontSz);
                            return lines.length * LINE_H;
                        });

                        const totalEstH = estHeights.reduce((s, h) => s + h + CAUSE_PAD, START_PAD);
                        const usableSpan = minBoneVSpan * USABLE_FRAC;
                        // If all causes together need more space than the usable bone span,
                        // compress everything uniformly so nothing falls off the bone.
                        const hScale = totalEstH > usableSpan ? usableSpan / totalEstH : 1.0;

                        // Pass 2 – render, using the actual available width per attachment
                        let accumY = START_PAD * hScale;   // distance from yOuter along bone

                        cat.causes.forEach((cause, causeIdx) => {
                            const scaledH   = estHeights[causeIdx] * hScale;
                            const scaledPad = CAUSE_PAD * hScale;

                            accumY += scaledH; // accumY is now at the LINE (bottom of text block)

                            // Y of the horizontal tick line on the diagram
                            const yTick = yOuter + yDir * accumY;

                            // Fraction t along the bone (0 = tip, 1 = spine junction)
                            const t = Math.min(0.93, Math.max(0.04, accumY / minBoneVSpan));
                            const xAttach = xOuter + t * (xConn - xOuter);

                            // Horizontal space available to the left of the attachment:
                            // from xAttach to xLeft, capped at branchWidth + 40 px.
                            // The xLeft guarantee above means availW ≥ branchWidth here.
                            const availW = Math.max(branchWidth, xAttach - xLeft - 5);
                            const useW   = Math.min(branchWidth + 40, availW);
                            const xLineL = Math.max(xLeft + 4, xAttach - useW); // left end of tick line

                            // Re-wrap with the real available width
                            const obj         = getCauseObj(cause);
                            const finalLines  = svgWrapText(obj.text, useW - 6, causeFontSz);
                            const textSp      = causeFontSz + 3.5;
                            const triggerY    = yTick - 3 - finalLines.length * textSp;
                            const triggerH    = finalLines.length * textSp + 6;

                            // Status colour coding
                            const status = obj.status;
                            const cfg    = STATUS_CONFIG[status];
                            let textClr  = textMutedColor;
                            let sRect    = '';
                            let strikeT  = '';

                            if (cfg) {
                                const bgFill = cfg.bgLight;
                                const bgStrk = cfg.borderLight;
                                textClr = cfg.textLight;
                                sRect   = `<rect x="${xLineL-4}" y="${triggerY+2}" width="${useW+8}" height="${triggerH-4}"
                                                 rx="6" ry="6" fill="${bgFill}" stroke="${bgStrk}" stroke-width="1.2"/>`;
                                if (status === 'ruled-out') {
                                    strikeT = `<line x1="${xLineL+2}" y1="${triggerY+triggerH/2}"
                                                     x2="${xAttach-4}" y2="${triggerY+triggerH/2}"
                                                     stroke="${textClr}" stroke-width="1.5" opacity="0.6"/>`;
                                }
                            }

                            const lineDashed = state.lineStyle === 'dashed' ? 'stroke-dasharray="4,3"' : '';

                            // Tick line from bone to left edge of text area
                            g += `<line x1="${xAttach}" y1="${yTick}" x2="${xLineL}" y2="${yTick}"
                                        stroke="${boneColor}" stroke-width="1.5" ${lineDashed}/>`;

                            g += `<g class="cause-text-group group/cause cursor-pointer select-none"
                                     onclick="triggerInlineEdit({type:'cause',catIndex:${idx},causeIndex:${causeIdx}},event)"
                                     onmouseenter="showCauseTooltip(event,${idx},${causeIdx})"
                                     onmousemove="showCauseTooltip(event,${idx},${causeIdx})"
                                     onmouseleave="hideCauseTooltip()">
                                      ${sRect}`;

                            finalLines.forEach((cLine, li) => {
                                const yLine = yTick - 3 - (finalLines.length - 1 - li) * textSp;
                                g += `<text x="${xLineL+2}" y="${yLine}"
                                            font-family="'Plus Jakarta Sans',sans-serif"
                                            font-size="${causeFontSz}" font-weight="600"
                                            fill="${textClr}">${escapeHtml(cLine)}</text>`;
                            });

                            if (strikeT) g += strikeT;

                            g += `<g class="opacity-0 group-hover/cause:opacity-100 transition-opacity"
                                     onclick="event.stopPropagation();deleteCause(${idx},${causeIdx});">
                                      <circle cx="${xLineL-8}" cy="${yTick-6}" r="5.5" fill="#ef4444"/>
                                      <line x1="${xLineL-10}" y1="${yTick-8}" x2="${xLineL-6}" y2="${yTick-4}" stroke="#fff" stroke-width="1.2"/>
                                      <line x1="${xLineL-6}" y1="${yTick-8}" x2="${xLineL-10}" y2="${yTick-4}" stroke="#fff" stroke-width="1.2"/>
                                  </g>
                                  <rect x="${xLineL}" y="${triggerY}" width="${useW}" height="${triggerH}"
                                        fill="transparent" class="hover:stroke-teal-400 hover:stroke-[1]"/>
                              </g>`;

                            accumY += scaledPad; // advance to next cause slot
                        });
                    }
                });
            }
            fishboneContent.innerHTML = g;
        }

        // --- ZOOM & PAN LOGIC ---
        function initZoomPanListeners() {
            const container = document.getElementById('canvas-container');

            container.addEventListener('mousedown', (e) => {
                if (e.target.closest('button') || e.target.closest('#inline-editor-container')) return;
                
                isDragging = true;
                container.style.cursor = 'grabbing';
                startX = e.clientX - translateX;
                startY = e.clientY - translateY;
            });

            window.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                translateX = e.clientX - startX;
                translateY = e.clientY - startY;
                applyTransform();
            });

            window.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    container.style.cursor = 'grab';
                }
            });

            container.addEventListener('mouseleave', () => {
                if (isDragging) {
                    isDragging = false;
                    container.style.cursor = 'grab';
                }
            });

            container.addEventListener('wheel', (e) => {
                e.preventDefault();
                const rect = svgElement.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const svgX = (mouseX - translateX) / scale;
                const svgY = (mouseY - translateY) / scale;

                const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
                const newScale = Math.min(Math.max(scale * zoomFactor, 0.25), 4.0);

                translateX = mouseX - svgX * newScale;
                translateY = mouseY - svgY * newScale;
                scale = newScale;

                applyTransform();
            }, { passive: false });
        }

        function applyTransform() {
            viewportGroup.setAttribute('transform', `translate(${translateX}, ${translateY}) scale(${scale})`);
            document.getElementById('zoom-indicator').textContent = Math.round(scale * 100) + '%';
        }

        function zoomIn() {
            scale = Math.min(scale * 1.15, 4.0);
            applyTransform();
        }

        // Zoom out
        function zoomOut() {
            scale = Math.max(scale * 0.85, 0.25);
            applyTransform();
        }

        function resetZoom() {
            translateX = 0;
            translateY = 0;
            scale = 1.0;
            applyTransform();
        }

        function fitCanvas() {
            const container = document.getElementById('canvas-container');
            const contW = container.clientWidth;
            const contH = container.clientHeight;

            // Use the dynamically computed SVG dimensions (updated each renderFishbone call)
            const scaleW = contW / (_svgW + 20);
            const scaleH = contH / (_svgH + 20);

            scale = Math.min(scaleW, scaleH, 1.2);
            scale = Math.max(scale, 0.25);

            translateX = (contW - _svgW * scale) / 2;
            translateY = (contH - _svgH * scale) / 2;

            applyTransform();
        }

        // --- INLINE EDITING INTERACTIVES ---
        function triggerInlineEdit(target, event) {
            if (event) event.stopPropagation();
            
            inlineEditingTarget = target;
            let currentText = "";

            if (target.type === 'effect') {
                currentText = state.effect;
            } else if (target.type === 'category') {
                currentText = state.categories[target.index].name;
            } else if (target.type === 'cause') {
                const cause = state.categories[target.catIndex].causes[target.causeIndex];
                currentText = getCauseObj(cause).text;
            }

            const container = document.getElementById('canvas-container');
            const containerRect = container.getBoundingClientRect();
            
            let clickX, clickY;
            if (event) {
                clickX = event.clientX - containerRect.left;
                clickY = event.clientY - containerRect.top;
            } else {
                clickX = containerRect.width / 2 - 100;
                clickY = containerRect.height / 2 - 40;
            }

            inlineEditorTextarea.value = currentText;
            inlineEditorContainer.style.left = `${clickX}px`;
            inlineEditorContainer.style.top = `${clickY}px`;
            inlineEditorContainer.classList.remove('hidden');

            setTimeout(() => {
                inlineEditorTextarea.focus();
                inlineEditorTextarea.select();
                adjustInlineEditorHeight();
            }, 10);

            inlineEditorTextarea.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveInlineEdit();
                } else if (e.key === 'Escape') {
                    closeInlineEdit();
                }
            };

            inlineEditorTextarea.oninput = adjustInlineEditorHeight;

            setTimeout(() => {
                document.addEventListener('click', closeInlineEditOnClickOutside);
            }, 150);
        }

        function adjustInlineEditorHeight() {
            inlineEditorTextarea.style.height = 'auto';
            inlineEditorTextarea.style.height = (inlineEditorTextarea.scrollHeight) + 'px';
        }

        function saveInlineEdit() {
            if (!inlineEditingTarget) return;

            const newVal = inlineEditorTextarea.value.trim();
            if (newVal !== "") {
                pushHistory();
                if (inlineEditingTarget.type === 'effect') {
                    state.effect = newVal;
                } else if (inlineEditingTarget.type === 'category') {
                    state.categories[inlineEditingTarget.index].name = newVal;
                } else if (inlineEditingTarget.type === 'cause') {
                    const cause = state.categories[inlineEditingTarget.catIndex].causes[inlineEditingTarget.causeIndex];
                    if (typeof cause === 'string') {
                        state.categories[inlineEditingTarget.catIndex].causes[inlineEditingTarget.causeIndex] = {
                            text: newVal,
                            status: '',
                            comment: ''
                        };
                    } else {
                        cause.text = newVal;
                    }
                }
                updateUI();
            }

            closeInlineEdit();
        }

        function closeInlineEdit() {
            inlineEditorContainer.classList.add('hidden');
            inlineEditingTarget = null;
            document.removeEventListener('click', closeInlineEditOnClickOutside);
        }

        function closeInlineEditOnClickOutside(e) {
            if (!inlineEditorContainer.contains(e.target)) {
                saveInlineEdit();
            }
        }

        // --- IMPORTS & EXPORTS ---
        function exportJSON() {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            
            const cleanEffect = state.effect.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 30);
            downloadAnchor.setAttribute("download", `fishbone-${cleanEffect || "export"}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
        }

        function importJSON(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const parsed = JSON.parse(e.target.result);
                    if (parsed.effect && Array.isArray(parsed.categories)) {
                        pushHistory();
                        state.effect = parsed.effect;
                        state.categories = parsed.categories;
                        if (parsed.theme) state.theme = parsed.theme;
                        if (parsed.shapeStyle) state.shapeStyle = parsed.shapeStyle;
                        if (parsed.lineStyle) state.lineStyle = parsed.lineStyle;
                        if (parsed.layout) state.layout = parsed.layout;

                        initSliders();
                        syncThemeUI();
                        updateUI();
                        fitCanvas();
                        showAlert("Import Successful", "Your fishbone diagram configuration was loaded successfully.");
                    } else {
                        throw new Error("Invalid structure. Must contain 'effect' and 'categories'.");
                    }
                } catch (err) {
                    showAlert("Import Failed", "Failed to parse JSON configuration file: " + err.message);
                }
            };
            reader.readAsText(file);
            event.target.value = "";
        }

        function shareLink() {
            try {
                const compressed = btoa(JSON.stringify(state));
                const shareUrl = window.location.origin + window.location.pathname + "?data=" + compressed;
                
                navigator.clipboard.writeText(shareUrl).then(() => {
                    showAlert("Link Copied", "A compressed shareable link containing your current diagram configuration has been copied to your clipboard!");
                }).catch(() => {
                    showAlert("Share Link", `Could not write to clipboard. Copy this URL manually:<br/><input type="text" readonly value="${shareUrl}" class="w-full text-xs p-2 bg-slate-100 rounded border border-slate-300 mt-2 font-mono" onclick="this.select()" />`);
                });
            } catch (err) {
                showAlert("Error", "Could not generate sharing link: " + err.message);
            }
        }

        function downloadSVG() {
            const svgContentCopy = svgElement.cloneNode(true);
            const viewGroup = svgContentCopy.querySelector('#viewport-group');
            if (viewGroup) {
                viewGroup.removeAttribute('transform');
            }

            const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
            style.textContent = `
                text { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; }
                line, path, polygon, rect { transition: none !important; }
            `;
            svgContentCopy.appendChild(style);

            const svgString = new XMLSerializer().serializeToString(svgContentCopy);
            const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const downloadAnchor = document.createElement('a');
            downloadAnchor.href = url;
            const cleanEffect = state.effect.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 30);
            downloadAnchor.download = `fishbone-${cleanEffect || "diagram"}.svg`;
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            URL.revokeObjectURL(url);
        }

        function downloadPNG() {
            const svgContentCopy = svgElement.cloneNode(true);
            const viewGroup = svgContentCopy.querySelector('#viewport-group');
            if (viewGroup) {
                viewGroup.removeAttribute('transform');
            }

            const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
            style.textContent = `
                text { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; }
            `;
            svgContentCopy.appendChild(style);

            const svgString = new XMLSerializer().serializeToString(svgContentCopy);
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const reader = new FileReader();

            reader.onload = function() {
                const img = new Image();
                img.onload = function() {
                    const scaleFactor = 2;
                    const canvas = document.createElement('canvas');
                    canvas.width = 1000 * scaleFactor;
                    canvas.height = 600 * scaleFactor;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#fcfdfe';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    ctx.scale(scaleFactor, scaleFactor);
                    ctx.drawImage(img, 0, 0);

                    canvas.toBlob(function(blob) {
                        const url = URL.createObjectURL(blob);
                        const downloadAnchor = document.createElement('a');
                        downloadAnchor.href = url;
                        const cleanEffect = state.effect.toLowerCase().replace(/[^a-z0-9]+/g, "-").substring(0, 30);
                        downloadAnchor.download = `fishbone-${cleanEffect || "diagram"}.png`;
                        document.body.appendChild(downloadAnchor);
                        downloadAnchor.click();
                        downloadAnchor.remove();
                        URL.revokeObjectURL(url);
                    }, 'image/png');
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(svgBlob);
        }



        // --- CUSTOM ALERT DIALOGS ---
        function showAlert(title, message) {
            document.getElementById('alert-title').innerHTML = title;
            document.getElementById('alert-message').innerHTML = message;
            document.getElementById('alert-modal').classList.remove('hidden');
        }

        function closeAlert() {
            document.getElementById('alert-modal').classList.add('hidden');
        }

        // Register project manager hooks
        window.projectManagerConfig = {
            toolId: "fishbone-diagram",
            getInputs: () => JSON.parse(JSON.stringify(state)),
            setInputs: (data) => {
                if (data.effect && Array.isArray(data.categories)) {
                    pushHistory();
                    state.effect = data.effect;
                    state.categories = data.categories;
                    if (data.theme) state.theme = data.theme;
                    if (data.shapeStyle) state.shapeStyle = data.shapeStyle;
                    if (data.lineStyle) state.lineStyle = data.lineStyle;
                    if (data.layout) state.layout = data.layout;

                    initSliders();
                    syncThemeUI();
                    updateUI();
                    fitCanvas();
                }
            }
        };

        window.shareLink = shareLink;
        window.exportJSON = exportJSON;
        window.importJSON = importJSON;

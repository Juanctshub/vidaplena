(function () {
    'use strict';

    // ===== INIT LUCIDE ICONS =====
    lucide.createIcons();

    // ===== APPLE LOADER SEQUENCE & REVEAL =====
    function revealDashboard() {
        const loader = document.getElementById('apple-loader');
        const body = document.body;
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.remove();
                body.classList.add('auth-ready');
                body.style.opacity = '1';
            }, 1000);
        } else {
            body.style.opacity = '1';
            body.classList.add('auth-ready');
        }
    }

    // Auto-reveal after the animation finishes (faster reveal for better UX)
    setTimeout(revealDashboard, 1500);

    // ===== AUTH & ROLES CHECK =====
    const session = JSON.parse(localStorage.getItem('adminSession'));
    if (!session || !session.loggedIn) {
        window.location.replace('index.html');
        return;
    }

    // Role setup
    let currentRole = session.role || 'Pastor';
    // If they were Super Admin before, normalize to Pastor
    if (currentRole === 'Super Admin') currentRole = 'Pastor';
    const roleDisplay = document.getElementById('roleDisplay');
    if (roleDisplay) roleDisplay.textContent = currentRole;

    applyRoleRestrictions(currentRole);

    function applyRoleRestrictions(role) {
        try {
            const navAlerts = document.getElementById('navAlerts');
            const dashAlerts = document.getElementById('dashAlertsBox');
            const navSettings = document.getElementById('navSettings');

            if (role === 'Secretaria') {
                if(navAlerts) navAlerts.style.display = 'none';
                if(dashAlerts) dashAlerts.style.display = 'none';
            }
            if (role === 'Lider') {
                if(navAlerts) navAlerts.style.display = 'none';
                if(navSettings) navSettings.style.display = 'none';
                if(dashAlerts) dashAlerts.style.display = 'none';
            }
        } catch(e) { console.warn("UI Restrict Error:", e); }
    }

    // ===== FIREBASE DATA INIT =====
    window.localDB = [];
    
    function getDB() { return window.localDB; }
    
    // Calendar State
    let currentCalendarDate = new Date();
    
    // Initial sync
    dbFirestore.collection('miembros').onSnapshot((snapshot) => {
        window.localDB = [];
        snapshot.forEach(doc => {
            let data = doc.data();
            data.id = doc.id;

            // Auto-adaptation for old members
            if (data.psychData && data.psychData.spiritualAlert === undefined) {
                // If they have certain spiritual interests or high commitment in other areas, 
                // we infer their spiritualAlert status as true (Comprometido)
                if (data.areaServicio && data.areaServicio.length > 0) data.psychData.spiritualAlert = true;
                else if (data.grupoVida === 'Sí') data.psychData.spiritualAlert = true;
                else data.psychData.spiritualAlert = false;
            }

            window.localDB.push(data);
        });
        
        // v1.0 and v2.0 Local Migration logic (Run once)
        const oldDBData = localStorage.getItem('miembrosIglesia');
        const v2LocalData = localStorage.getItem('censoVidaPlenaDB');
        let migratedCount = 0;
        
        const migrateArray = (arr) => {
            if (Array.isArray(arr)) {
                arr.forEach(member => {
                    if (!window.localDB.find(m => m.id === member.id)) {
                        if (!member.psychData) member.psychData = { anxietyAlert: false, depressionAlert: false, tocAlert: false };
                        dbFirestore.collection('miembros').doc(member.id).set(member);
                        migratedCount++;
                    }
                });
            }
        };

        if (oldDBData) {
            try { migrateArray(JSON.parse(oldDBData)); } catch(e) { console.error("Error migrando DB v1", e); }
            localStorage.removeItem('miembrosIglesia');
        }
        
        if (v2LocalData) {
            try { migrateArray(JSON.parse(v2LocalData)); } catch(e) { console.error("Error migrando DB v2", e); }
            // No eliminamos censoVidaPlenaDB porque sirve como backup local
        }

        if (migratedCount > 0) console.log(`Migrados ${migratedCount} registros locales a Firebase`);

        // Re-render UI upon data change
        const section = document.querySelector('.nav-item.active')?.dataset.section || 'dashboard';
        
        // Filter DB based on scope if role is Lider
        window.filteredDB = [...window.localDB];
        if (currentRole === 'Lider' && session.scope && session.scope !== 'Todos') {
            window.filteredDB = window.localDB.filter(m => 
                (m.areaServicio && m.areaServicio.includes(session.scope)) || 
                (m.grupoVida === session.scope)
            );
        }

        // Apply UI Restrictions based on Role
        applyRoleSecurityUI();

        if (section === 'dashboard') renderDashboard();
        if (section === 'members') renderMembers();
        if (section === 'alerts') renderAlerts();
        if (section === 'reminders') renderReminders();
        if (section === 'map') renderMap();
        if (section === 'generations') renderGenerations();
        if (section === 'calendar') renderCalendar();
        if (section === 'ministry') filterTalents();
    });

    function getRoles() { 
        let r = JSON.parse(localStorage.getItem('adminUsers')); 
        if (!r) {
            // Default setup from old credentials
            const old = JSON.parse(localStorage.getItem('adminCredentials')) || { username: 'Admin', password: 'Vidaplena' };
            r = [{ user: old.username, pass: old.password, role: 'Pastor' }];
            localStorage.setItem('adminUsers', JSON.stringify(r));
        }
        return r;
    }
    function saveRoles(r) { localStorage.setItem('adminUsers', JSON.stringify(r)); }

    const db = getDB();

    // ===== NAVIGATION (TOPBAR & BOTTOM MOBILE) =====
    const navItems = document.querySelectorAll('.nav-item, .mobile-nav-item');
    const sections = document.querySelectorAll('.section');

    navItems.forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const sec = item.dataset.section;
            
            navItems.forEach(n => n.classList.remove('active'));
            
            // Activate both desktop and mobile versions of the link
            document.querySelectorAll(`[data-section="${sec}"]`).forEach(n => n.classList.add('active'));
            
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById('section-' + sec).classList.add('active');
            document.querySelector('.topbar-title').textContent = item.textContent.trim().replace(/\d+$/, '').trim();
            
            // Close mobile nav if open
            const mobileNav = document.getElementById('mobileNav');
            if(!mobileNav.classList.contains('hidden')) {
                toggleMobileNav();
            }

            // Render specific sections
            if (sec === 'dashboard') renderDashboard();
            if (sec === 'members') renderMembers();
            if (sec === 'alerts') renderAlerts();
            if (sec === 'reminders') renderReminders();
            if (sec === 'ai') {} // AI doesn't need initial render
            if (sec === 'map') renderMap();
            if (sec === 'generations') renderGenerations();
            if (sec === 'calendar') renderCalendar();
            if (sec === 'ministry') filterTalents();
            if (sec === 'settings') renderSettings();
            if (sec === 'broadcast') generateBroadcastList();
            if (sec === 'events') renderEvents();
            if (sec === 'library') renderLibrary();
        });
    });

    // ===== MOBILE NAV TOGGLE =====
    window.toggleMobileNav = function() {
        const mobileNav = document.getElementById('mobileNav');
        mobileNav.classList.toggle('hidden');
        mobileNav.classList.toggle('flex');
    };

    window.logout = function () {
        localStorage.removeItem('adminSession');
        window.location.href = 'index.html';
    };

    // Global Chart instances
    const charts = {};

    // ===== 1. DASHBOARD & 7. COMPARATIVE GROWTH =====
    function renderDashboard() {
        const db = getDB();
        
        // Stats
        const baptized = db.filter(m => m.bautizadoAguas === 'Sí').length;
        const groups = db.filter(m => m.grupoVida === 'Sí').length;
        const alerts = db.filter(m => m.psychData && (m.psychData.anxietyAlert || m.psychData.depressionAlert || m.psychData.tocAlert)).length;
        
        document.getElementById('sTotalMembers').textContent = db.length;
        document.getElementById('sGroups').textContent = groups;
        document.getElementById('sAlertsMain').textContent = alerts;
        document.getElementById('alertBadge').textContent = alerts;

        // Growth Calculation (This month vs Last month)
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();
        const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
        const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

        let currMCount = 0; let lastMCount = 0;
        db.forEach(m => {
            const d = new Date(m.fechaRegistro);
            if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) currMCount++;
            if (d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear) lastMCount++;
        });
        
        let growthStr = '0';
        if (lastMCount === 0 && currMCount > 0) growthStr = `+${currMCount}`;
        else if (lastMCount > 0) {
            const pct = Math.round(((currMCount - lastMCount) / lastMCount) * 100);
            growthStr = (pct >= 0 ? '+' : '') + pct + '%';
        }
        document.getElementById('sGrowth').textContent = growthStr;

        // Render mini charts with varied types
        renderChart('chartCivil', countBy(db, 'estadoCivil'), 'bar', ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b']);
        renderChart('chartSede', countBy(db, 'sede'), 'pie', ['#ec4899', '#06b6d4', '#8b5cf6', '#10b981']); // Switched to pie for better stability
        renderChart('chartBautismo', countBy(db, 'bautizadoAguas'), 'doughnut', ['#3b82f6', '#64748b']);

        // Comparative Growth Chart (Feature 7)
        const monthsData = {};
        for(let i=5; i>=0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            monthsData[d.toLocaleString('es-ES', { month: 'short' })] = 0;
        }
        db.forEach(m => {
            const d = new Date(m.fechaRegistro);
            const mStr = d.toLocaleString('es-ES', { month: 'short' });
            if (monthsData[mStr] !== undefined) monthsData[mStr]++;
        });

        renderChart('chartComparative', monthsData, 'line', ['#10b981'], true);
    }

    // ===== 2. MAPA DE CALOR (Geolocation) =====
    let map;
    function renderMap() {
        if (!map) {
            // Default center Barquisimeto
            map = L.map('map').setView([10.0678, -69.3474], 12);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
            }).addTo(map);
        }

        // We simulate coordinates based on the user's address hash so it scatters slightly around Barquisimeto or Acarigua
        const db = getDB();
        // Clear old markers
        map.eachLayer(layer => { if(layer instanceof L.CircleMarker) map.removeLayer(layer); });

        db.forEach(m => {
            if(!m.direccion) return;
            // Generate deterministic pseudo-random coords based on address string length and char codes
            let baseLat = 10.0678; let baseLng = -69.3474; // Barquisimeto
            if (m.sede && m.sede.includes('Acarigua')) { baseLat = 9.5597; baseLng = -69.2014; }
            
            let hash = 0;
            for(let i=0; i<m.direccion.length; i++) hash = m.direccion.charCodeAt(i) + ((hash << 5) - hash);
            
            // Random offset within ~5km
            const latOffset = ((hash % 100) / 10000) * (hash % 2 === 0 ? 1 : -1);
            const lngOffset = (((hash >> 2) % 100) / 10000) * (hash % 3 === 0 ? 1 : -1);

            L.circleMarker([baseLat + latOffset, baseLng + lngOffset], {
                radius: 8, fillColor: '#3b82f6', color: '#60a5fa', weight: 2, opacity: 0.8, fillOpacity: 0.5
            }).addTo(map).bindPopup(`<b>${m.nombreCompleto}</b><br>${m.direccion}`);
        });

        setTimeout(() => map.invalidateSize(), 300);
    }

    // ===== 3. GENERATIONS =====
    function renderGenerations() {
        const db = getDB();
        const groups = { 'Niños (0-12)': 0, 'Jóvenes (13-25)': 0, 'Adultos (26-59)': 0, 'Edad de Oro (60+)': 0 };
        const lists = { 'Niños (0-12)': [], 'Jóvenes (13-25)': [], 'Adultos (26-59)': [], 'Edad de Oro (60+)': [] };

        db.forEach(m => {
            const a = calcAge(m.fechaNacimiento);
            let k = '';
            if (a <= 12) k = 'Niños (0-12)';
            else if (a <= 25) k = 'Jóvenes (13-25)';
            else if (a <= 59) k = 'Adultos (26-59)';
            else k = 'Edad de Oro (60+)';
            
            groups[k]++;
            lists[k].push(m);
        });

        renderChart('chartGenerations', groups, 'pie', ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b']);

        const listHTML = Object.keys(lists).map(k => {
            const pct = db.length ? Math.round((groups[k]/db.length)*100) : 0;
            return `
            <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="font-bold text-white">${k}</h4>
                    <span class="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300">${groups[k]} personas (${pct}%)</span>
                </div>
                <div class="w-full bg-slate-800 rounded-full h-2">
                    <div class="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full" style="width: ${pct}%"></div>
                </div>
            </div>`;
        }).join('');
        document.getElementById('generationsList').innerHTML = listHTML;
    }

    // ===== 4. CALENDAR =====
    function renderCalendar() {
        const db = getDB();
        const now = new Date();
        now.setHours(0,0,0,0);
        const events = [];

        db.forEach(m => {
            if (m.fechaNacimiento) {
                const parts = m.fechaNacimiento.split('-');
                if (parts.length === 3) {
                    let nextB = new Date(now.getFullYear(), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    if (nextB < now) nextB.setFullYear(now.getFullYear() + 1);
                    
                    const diffDays = Math.ceil((nextB - now) / (1000 * 60 * 60 * 24));
                    if (diffDays >= 0 && diffDays <= 30) {
                        events.push({ type: 'Cumpleaños', days: diffDays, date: nextB, member: m });
                    }
                }
            }
            if (m.fechaRegistro) {
                const parts = m.fechaRegistro.split('T')[0].split('-');
                if(parts.length === 3) {
                    let nextA = new Date(now.getFullYear(), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    if (nextA < now) nextA.setFullYear(now.getFullYear() + 1);
                    const diffDays = Math.ceil((nextA - now) / (1000 * 60 * 60 * 24));
                    const yearsInChurch = nextA.getFullYear() - parseInt(parts[0]);
                    if (diffDays >= 0 && diffDays <= 30 && yearsInChurch > 0) {
                        events.push({ type: 'Aniversario', days: diffDays, date: nextA, member: m, years: yearsInChurch });
                    }
                }
            }
        });

        events.sort((a,b) => a.days - b.days);
        const badge = document.getElementById('calendarBadge');
        if (badge) badge.textContent = events.length;

        const container = document.getElementById('calendarList');
        const empty = document.getElementById('calendarEmpty');

        if (events.length === 0) {
            container.innerHTML = '';
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');
            container.innerHTML = events.map(e => {
                const isToday = e.days === 0;
                const badgeClass = isToday ? 'bg-pink-500 text-white animate-pulse' : 'bg-slate-800 text-slate-300';
                const icon = e.type === 'Cumpleaños' ? 'cake' : 'award';
                const color = e.type === 'Cumpleaños' ? 'pink' : 'blue';
                const subtitle = e.type === 'Cumpleaños' ? e.date.toLocaleDateString('es-ES', { day:'numeric', month:'long' }) : `${e.years} año(s) sirviendo`;
                
                return `
                <div class="bg-slate-900/50 p-5 rounded-2xl border ${isToday ? 'border-' + color + '-500/50' : 'border-slate-700'} flex gap-4 items-center transition-all hover:bg-slate-800/80">
                    <div class="w-12 h-12 rounded-full ${isToday ? 'bg-' + color + '-500/20 text-' + color + '-400' : 'bg-slate-800 text-slate-400'} flex items-center justify-center flex-shrink-0">
                        <i data-lucide="${icon}"></i>
                    </div>
                    <div>
                        <strong class="block text-white mb-1">${e.member.nombreCompleto}</strong>
                        <span class="text-xs text-slate-400 block mb-2">${e.type} • ${subtitle}</span>
                        <span class="text-xs font-bold px-2 py-1 rounded-md ${badgeClass}">${isToday ? '¡Es Hoy!' : `En ${e.days} días`}</span>
                    </div>
                </div>`;
            }).join('');
            lucide.createIcons();
        }
    }

    // ===== 5. MINISTRY FILTER =====
    window.filterTalents = function() {
        const query = document.getElementById('talentSelect').value;
        const container = document.getElementById('talentResults');
        if (!query) {
            container.innerHTML = '<div class="text-slate-500 py-12 text-center col-span-full border-2 border-dashed border-slate-700 rounded-xl">Selecciona un talento y presiona Buscar.</div>';
            return;
        }

        const db = getDB();
        // Step 5 of census saves 'areaServicio' which is an array or string.
        const results = db.filter(m => {
            if(!m.areaServicio) return false;
            if(Array.isArray(m.areaServicio)) return m.areaServicio.some(a => a.toLowerCase().includes(query.toLowerCase().split('/')[0]));
            return m.areaServicio.toLowerCase().includes(query.toLowerCase().split('/')[0]);
        });

        if (results.length === 0) {
            container.innerHTML = `<div class="text-slate-500 py-12 text-center col-span-full bg-slate-900/50 rounded-xl border border-slate-700">No se encontraron hermanos interesados en ${query}.</div>`;
            return;
        }

        container.innerHTML = results.map(m => `
            <div class="bg-slate-900/50 p-5 rounded-xl border border-slate-700 flex items-center justify-between">
                <div>
                    <strong class="block text-white mb-1">${m.nombreCompleto}</strong>
                    <span class="text-xs text-slate-400 flex items-center gap-1"><i data-lucide="phone" class="w-3 h-3"></i> ${m.telefono}</span>
                </div>
                <button onclick="viewMember('${m.id}')" class="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20"><i data-lucide="eye" class="w-4 h-4"></i></button>
            </div>
        `).join('');
        lucide.createIcons();
    };

    // ===== NOTIFICACIONES =====
    function requestNotificationPermission() {
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }
    requestNotificationPermission();

    function showReminderNotification(title, body) {
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification(title, { body: body });
        }
    }

    // ===== RECORDATORIOS =====
    window.localReminders = [];
    dbFirestore.collection('recordatorios').onSnapshot((snapshot) => {
        window.localReminders = [];
        snapshot.forEach(doc => {
            let r = doc.data();
            r.id = doc.id;
            window.localReminders.push(r);
        });
        
        const todayStr = new Date().toISOString().split('T')[0];
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const r = change.doc.data();
                // Check if the reminder is for today or it was just created
                const isRecent = new Date() - new Date(r.createdAt) < 5000;
                if (r.date === todayStr && !isRecent) {
                    showReminderNotification("¡Recordatorio para hoy!", r.title);
                }
            }
        });

        const activeSec = document.querySelector('.nav-item.active')?.dataset.section;
        if (activeSec === 'reminders') {
            renderReminders();
        }
    });

    window.saveReminder = function() {
        const title = document.getElementById('remTitle').value.trim();
        const date = document.getElementById('remDate').value;
        const priority = document.getElementById('remPriority').value;
        
        if (!title || !date) {
            Swal.fire({ icon: 'warning', title: 'Faltan datos' });
            return;
        }

        // Request permission if they haven't granted it yet
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

        dbFirestore.collection('recordatorios').add({
            title, date, priority, createdAt: new Date().toISOString()
        }).then(() => {
            document.getElementById('reminderModal').classList.remove('flex');
            document.getElementById('reminderModal').classList.add('hidden');
            document.getElementById('remTitle').value = '';
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Recordatorio guardado', showConfirmButton: false, timer: 1500 });
        });
    }

    window.deleteReminder = function(id) {
        dbFirestore.collection('recordatorios').doc(id).delete();
    }

    function renderReminders() {
        const container = document.getElementById('remindersList');
        if (!container) return;
        if (window.localReminders.length === 0) {
            container.innerHTML = `<div class="col-span-1 md:col-span-3 text-center py-12 text-slate-400"><i data-lucide="check-circle" class="w-12 h-12 text-emerald-500 mx-auto mb-3"></i>No hay recordatorios pendientes.</div>`;
            lucide.createIcons();
            return;
        }

        const sorted = [...window.localReminders].sort((a,b) => new Date(a.date) - new Date(b.date));

        container.innerHTML = sorted.map(r => {
            const isLate = new Date(r.date) < new Date(new Date().setHours(0,0,0,0));
            const colorClass = r.priority === 'Alta' ? 'bg-red-500/20 text-red-400' : r.priority === 'Media' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400';
            
            return `
            <div class="bg-slate-900/50 border border-slate-700 p-5 rounded-2xl relative group hover:border-blue-500/50 transition-colors">
                <div class="flex justify-between items-start mb-3 pr-8">
                    <h4 class="font-bold text-white text-lg leading-tight">${r.title}</h4>
                    <span class="${colorClass} text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider">${r.priority}</span>
                </div>
                <p class="text-sm ${isLate ? 'text-red-400 font-bold' : 'text-slate-400'} flex items-center gap-2"><i data-lucide="calendar" class="w-4 h-4"></i> ${r.date}</p>
                
                <button onclick="deleteReminder('${r.id}')" title="Marcar como Completado" class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-slate-800 text-slate-400 rounded-full hover:bg-emerald-500 hover:text-white transition-all transform hover:scale-110">
                    <i data-lucide="check" class="w-4 h-4"></i>
                </button>
            </div>
            `;
        }).join('');
        lucide.createIcons();
    }

    // ===== IA PASTORAL (El Chat de Pedro) =====
    window.runAITask = async function(taskType) {
        if (!window.localDB || window.localDB.length === 0) {
            Swal.fire({ icon: 'warning', title: 'Sin datos', text: 'No hay miembros en la base de datos para analizar.' });
            return;
        }

        const btnTextMap = {
            'salud': 'Analista de Salud...',
            'ministerios': 'Matchmaker...',
            'resumen': 'Generando Brief...',
            'crecimiento': 'Prediciendo...',
            'oracion': 'Clasificando...'
        };
        
        appendChatMessage('system', `Generando reporte de <b>${taskType}</b>... Por favor espera.`);
        
        let prompt = "";
        let sysPrompt = "Eres Pedro, asistente de IA Pastoral de Vida Plena. REGLA DE ORO: Responde de forma ultra-concisa, directa y ejecutiva. No des introducciones largas. Ve directo al grano. Eres un experto analista de datos ministeriales. Muestra tablas o listas cortas.";

        // Compact DB for AI to save tokens
        const dbCompact = window.localDB.map(m => ({
            n: m.nombreCompleto,
            e: m.edad || (m.fechaNacimiento ? (new Date().getFullYear() - new Date(m.fechaNacimiento).getFullYear()) : '?'),
            t: m.psychData?.temperament,
            p: m.profesion,
            s: m.areaServicio,
            r: m.rutaCrecimiento,
            nr: m.nombreRutaCrecimiento,
            gv: m.grupoVida,
            psi: {
                ans: m.psychData?.anxietyAlert,
                dep: m.psychData?.depressionAlert,
                crec: m.psychData?.crecimientoEspiritual,
                apo: m.psychData?.areasApoyo,
                ora: m.psychData?.necesidadOracion
            }
        }));

        const dbStr = JSON.stringify(dbCompact);

        if (taskType === 'salud') {
            prompt = `Analiza los siguientes miembros de la iglesia y genera un "Resumen de Salud de la Congregación". Enfócate en tendencias de ansiedad (ans), depresión (dep), estado espiritual (crec) y peticiones de apoyo (apo). Da métricas y al final una 'Sugerencia Pastoral' práctica para la iglesia. Datos: ${dbStr}`;
        } else if (taskType === 'ministerios') {
            prompt = `Actúa como un "Matchmaker de Ministerios". Revisa el temperamento (t), profesión (p), y áreas actuales (s) de los miembros. Sugiere a 3 personas específicas que tienen un perfil oculto ideal para otra área en la que no están (ej. Un colérico gerente para logística). Datos: ${dbStr}`;
        } else if (taskType === 'resumen') {
            prompt = `Genera 'The Morning Brief' para el Pastor Principal. Resume el total de miembros, cuántos están en riesgo de alejamiento (crec='alejado' o 'estancado'), y qué grupo demográfico requiere más atención urgente basado en las alertas. Sé conciso y ejecutivo. Datos: ${dbStr}`;
        } else if (taskType === 'crecimiento') {
            prompt = `Analiza la 'Ruta de Crecimiento' (nr). Identifica a 3 personas que ya completaron ciertos pasos y sugiérele al pastor a qué paso específico deberían ser invitados esta semana para no estancarse. Datos: ${dbStr}`;
        } else if (taskType === 'oracion') {
            prompt = `Clasifica las peticiones de oración (psi.ora). Agrúpalas por categorías: Salud, Finanzas, Familia, Espiritual. Dime cuál es el porcentaje o área que más le duele a la iglesia hoy y menciona un par de peticiones críticas de forma anónima. Datos: ${dbStr}`;
        }

        callGroqAPI(prompt, sysPrompt);
    };

    window.sendChatMessage = function() {
        const input = document.getElementById('aiChatInput');
        const text = input.value.trim();
        if (!text) return;

        appendChatMessage('user', text);
        input.value = '';

        const dbCompact = window.localDB.map(m => {
            return { 
                id: m.id, 
                nombre: m.nombreCompleto, 
                ministerio: m.areaServicio, 
                gv: m.grupoVida, 
                tel: m.telefono,
                nacimiento: m.fechaNacimiento,
                registro: m.fechaRegistro,
                profesion: m.profesion,
                intereses: m.intereses,
                sede: m.sede,
                estadoCivil: m.estadoCivil,
                bautizado: m.bautizadoAguas,
                perfil: m.psychData
            };
        });
        
        const sysPrompt = `Eres Pedro, la IA pastoral de Vida Plena. Tienes acceso a la base de datos COMPLETA actual en formato JSON: ${JSON.stringify(dbCompact)}. 
Puedes buscar y cruzar datos de cumpleaños (nacimiento), ministerios, intereses, profesiones y el perfil psicológico/espiritual de los hermanos.
Si el usuario te pide modificar o eliminar algo en la base de datos, DEBES responder EXCLUSIVAMENTE con un bloque JSON al final de tu respuesta en este formato exacto (con corchetes):
Para borrar: [ACTION: {"type": "DELETE", "id": "ID_DEL_MIEMBRO"}]
Para actualizar: [ACTION: {"type": "UPDATE", "id": "ID_DEL_MIEMBRO", "field": "CAMPO", "value": "NUEVO_VALOR"}] (Campos soportados: grupoVida, telefono, profesion, nombreRutaCrecimiento)
ESTRICTO: REGLA DE ORO: Tus respuestas deben ser ULTRA-CONCISAS, DIRECTAS y EJECUTIVAS. No escribas introducciones ni despedidas largas. Ve al grano inmediatamente. Usa viñetas y tablas para que tu análisis sea rápido de leer. Nunca inventes información. Si te piden una lista de cumpleaños, da solo la lista y ya.`;

        callGroqAPI(text, sysPrompt);
    };

    async function callGroqAPI(prompt, sysPrompt) {
        appendChatMessage('typing', '<i data-lucide="loader" class="w-4 h-4 animate-spin inline"></i> Pedro está analizando...');
        
        try {
            // Check if we are running locally without vercel server
            if (window.location.protocol === 'file:') {
                removeTypingIndicator();
                appendChatMessage('system', '<b>Aviso de Seguridad:</b> Estás abriendo el archivo localmente. Para proteger las llaves de la API (Keys de Groq) de los hackers, estas han sido guardadas en el backend seguro de Vercel. Por favor, sube el proyecto a Vercel para que Pedro despierte.');
                return;
            }

            const res = await fetch('/api/groq', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, systemPrompt: sysPrompt })
            });

            removeTypingIndicator();

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Error de conexión');
            }

            const data = await res.json();
            const reply = data.choices[0].message.content;

            // Check for ACTION JSON
            const actionMatch = reply.match(/\[ACTION:\s*({.*})\s*\]/);
            let cleanReply = reply;
            if (actionMatch) {
                cleanReply = reply.replace(actionMatch[0], '').trim();
                try {
                    const action = JSON.parse(actionMatch[1]);
                    if (action.type === 'DELETE' && action.id) {
                        dbFirestore.collection('miembros').doc(action.id).delete();
                        cleanReply += `\n\n<span class="text-emerald-400 font-bold"><i data-lucide="check" class="w-4 h-4 inline"></i> He eliminado el registro ${action.id} de la base de datos como solicitaste.</span>`;
                    } else if (action.type === 'UPDATE' && action.id && action.field) {
                        const updateData = {};
                        updateData[action.field] = action.value;
                        dbFirestore.collection('miembros').doc(action.id).update(updateData);
                        cleanReply += `\n\n<span class="text-blue-400 font-bold"><i data-lucide="check" class="w-4 h-4 inline"></i> He actualizado el campo '${action.field}' a '${action.value}' para el usuario ${action.id}.</span>`;
                    }
                } catch(e) { console.error('Parse action failed', e); }
            }

            // Convert Markdown to HTML using marked.js if available
            let htmlReply = cleanReply;
            if (typeof marked !== 'undefined') {
                htmlReply = marked.parse(cleanReply);
            } else {
                htmlReply = cleanReply.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
            }
            
            appendChatMessage('bot', htmlReply);
            
        } catch (error) {
            removeTypingIndicator();
            console.error('Groq Error:', error);
            appendChatMessage('system', 'Hubo un error al contactar al servidor de Inteligencia Artificial. Asegúrate de estar en Vercel.');
        }
    }

    function appendChatMessage(type, text) {
        const box = document.getElementById('aiChatBox');
        const div = document.createElement('div');
        div.className = 'flex gap-3 ' + (type === 'user' ? 'justify-end' : '');
        
        let content = '';
        if (type === 'user') {
            content = `<div class="bg-purple-600 text-white p-3 rounded-2xl rounded-tr-none text-sm max-w-[85%] leading-relaxed shadow-lg">${text}</div>
                       <div class="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center"><i data-lucide="user" class="w-4 h-4 text-white"></i></div>`;
        } else if (type === 'bot') {
            content = `<div class="w-8 h-8 rounded-full bg-purple-600 flex-shrink-0 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.4)]"><i data-lucide="bot" class="w-4 h-4 text-white"></i></div>
                       <div class="bg-slate-800/80 backdrop-blur-sm text-slate-200 p-4 rounded-3xl rounded-tl-none text-sm max-w-[85%] leading-relaxed border border-slate-700 shadow-md prose prose-invert prose-p:my-1 prose-ul:my-1">${text}</div>`;
        } else if (type === 'system') {
            content = `<div class="w-full text-center text-xs text-slate-500 my-2">${text}</div>`;
        } else if (type === 'typing') {
            div.id = 'aiTyping';
            content = `<div class="w-8 h-8 rounded-full bg-purple-600 flex-shrink-0 flex items-center justify-center animate-pulse"><i data-lucide="bot" class="w-4 h-4 text-white"></i></div>
                       <div class="bg-slate-800/50 text-slate-400 p-3 rounded-2xl rounded-tl-none text-sm border border-slate-700/50">${text}</div>`;
        }
        
        div.innerHTML = content;
        box.appendChild(div);
        lucide.createIcons();
        box.scrollTop = box.scrollHeight;
    }

    function removeTypingIndicator() {
        const typing = document.getElementById('aiTyping');
        if (typing) typing.remove();
    }

    // ===== ALERTS (Feature 1) =====
    function renderAlerts() {
        const db = getDB();
        const container = document.getElementById('alertsList');
        const empty = document.getElementById('alertsEmpty');
        
        const alerts = db.filter(m => {
            if (!m.psychData) return false;
            const p = m.psychData;
            return p.anxietyAlert || p.depressionAlert || p.tocAlert || 
                   p.crecimientoEspiritual === 'Me he alejado' || p.crecimientoEspiritual === 'Siento que estoy estancado/a' ||
                   (p.necesidadOracion && p.necesidadOracion.trim().length > 0);
        });
        
        if (alerts.length === 0) {
            container.innerHTML = '';
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');
            container.innerHTML = alerts.map(m => {
                const p = m.psychData;
                const hasStagnation = p.crecimientoEspiritual === 'Me he alejado' || p.crecimientoEspiritual === 'Siento que estoy estancado/a';
                const hasPrayer = p.necesidadOracion && p.necesidadOracion.trim().length > 0;
                
                return `
                <div class="bg-red-500/10 border border-red-500/30 p-5 rounded-2xl relative overflow-hidden group">
                    <div class="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full -z-10 group-hover:scale-150 transition-transform duration-500"></div>
                    <div class="flex justify-between items-start mb-3">
                        <strong class="text-white text-lg">${m.nombreCompleto}</strong>
                        <span class="bg-red-500/20 text-red-400 text-[10px] font-black uppercase px-2 py-1 rounded border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.3)] animate-pulse">Urgente</span>
                    </div>
                    <p class="text-xs text-slate-400 mb-4 flex items-center gap-1"><i data-lucide="phone" class="w-3 h-3"></i> ${m.telefono}</p>
                    <div class="space-y-2 mb-4">
                        ${p.depressionAlert ? `<div class="text-xs bg-slate-900/50 text-slate-300 px-2 py-1.5 rounded border border-slate-700 font-medium">⚠️ Bajo estado anímico / Salud</div>` : ''}
                        ${p.anxietyAlert ? `<div class="text-xs bg-slate-900/50 text-slate-300 px-2 py-1.5 rounded border border-slate-700 font-medium">⚠️ Signos de ansiedad</div>` : ''}
                        ${hasStagnation ? `<div class="text-xs bg-orange-500/10 text-orange-400 px-2 py-1.5 rounded border border-orange-500/30 font-medium">📉 Riesgo Espiritual (${p.crecimientoEspiritual})</div>` : ''}
                        ${hasPrayer ? `<div class="text-xs bg-purple-500/10 text-purple-300 px-2 py-2 rounded border border-purple-500/30 italic">"Petición de Oración: ${p.necesidadOracion.substring(0, 50)}${p.necesidadOracion.length > 50 ? '...' : ''}"</div>` : ''}
                    </div>
                    <button onclick="viewMember('${m.id}')" class="w-full py-2.5 bg-red-500/20 text-red-400 font-bold text-sm rounded-lg hover:bg-red-500/30 transition-colors border border-red-500/20 shadow-lg">Intervenir Pastoralmente</button>
                </div>
            `;
            }).join('');
            lucide.createIcons();
        }
    }

    // ===== MEMBERS & BITACORA (Feature 6) =====
    function renderMembers() {
        const db = getDB();
        const tbody = document.getElementById('membersBody');
        const empty = document.getElementById('membersEmpty');
        
        let filtered = db;
        const search = document.getElementById('searchInput')?.value.toLowerCase() || '';
        if (search) {
            filtered = filtered.filter(m => 
                (m.nombreCompleto||'').toLowerCase().includes(search) || 
                (m.telefono||'').includes(search) || 
                (m.email||'').toLowerCase().includes(search)
            );
        }

        const fCivil = document.getElementById('fCivil')?.value;
        const fSede = document.getElementById('fSede')?.value;
        if (fCivil) filtered = filtered.filter(m => m.estadoCivil === fCivil);
        if (fSede && fSede !== 'Sedes (Todas)') filtered = filtered.filter(m => m.sede === fSede);

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');
            empty.classList.add('hidden');
            tbody.innerHTML = filtered.map(m => {
                const nombre = m.nombreCompleto && m.nombreCompleto !== 'undefined' ? m.nombreCompleto : 'Usuario Desconocido / Corrupto';
                const id_str = m.id || 'missing_id';
                return `
                <tr class="hover:bg-white/5 transition-colors group">
                    <td class="py-3 px-4">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-blue-500/20">
                            ${getInitials(nombre)}
                        </div>
                    </td>
                    <td class="py-3 px-4">
                        <strong class="block text-slate-200">${nombre}</strong>
                        <span class="text-xs text-slate-500">${m.email && m.email !== 'undefined' ? m.email : 'Sin email'}</span>
                        <span class="text-[10px] text-red-500 block">ID: ${id_str}</span>
                    </td>
                    <td class="py-3 px-4 text-slate-300 text-sm">${m.telefono && m.telefono !== 'undefined' ? m.telefono : 'N/A'}</td>
                    <td class="py-3 px-4 text-slate-300 text-sm">${calcAge(m.fechaNacimiento)} años</td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-1 text-xs rounded-md border ${m.sede?.includes('Acarigua') ? 'border-purple-500/30 text-purple-400 bg-purple-500/10' : 'border-blue-500/30 text-blue-400 bg-blue-500/10'}">${m.sede && m.sede !== 'undefined' ? m.sede : 'N/A'}</span>
                    </td>
                    <td class="py-3 px-4 text-right">
                        <button onclick="viewMember('${id_str}')" class="p-2 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors tooltip" data-tippy-content="Ver Ficha"><i data-lucide="eye" class="w-4 h-4"></i></button>
                        <button onclick="deleteMember('${id_str}')" class="btn-delete-member p-2 bg-red-500/10 text-red-400 hover:text-white hover:bg-red-500 rounded-lg transition-colors ml-1 tooltip" data-tippy-content="Eliminar"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </td>
                </tr>
                `;
            }).join('');
            lucide.createIcons();
            if(typeof tippy !== 'undefined') tippy('.tooltip');
            applyRoleSecurityUI();
        }
    }

    document.getElementById('searchInput')?.addEventListener('input', renderMembers);
    document.getElementById('fCivil')?.addEventListener('change', renderMembers);
    document.getElementById('fSede')?.addEventListener('change', renderMembers);

    window.clearFilters = function() {
        document.getElementById('searchInput').value = '';
        document.getElementById('fCivil').value = '';
        document.getElementById('fSede').value = '';
        renderMembers();
    };

    window.viewMember = function(id) {
        const db = getDB();
        const m = db.find(x => x.id === id);
        if (!m) return;

        const html = `
            <div class="col-span-1 lg:col-span-2">
                <div class="flex items-center gap-4 mb-6">
                    <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-500/20">
                        ${getInitials(m.nombreCompleto)}
                    </div>
                    <div>
                        <h3 class="text-2xl font-bold text-white">${m.nombreCompleto}</h3>
                        <p class="text-slate-400 text-sm flex items-center gap-1"><i data-lucide="calendar" class="w-3 h-3"></i> Miembro desde: ${new Date(m.fechaRegistro).toLocaleDateString()}</p>
                    </div>
                </div>

                <button onclick="openQRModal('${m.id}', '${m.nombreCompleto.replace(/'/g, "\\'")}')" class="w-full bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white py-3 rounded-xl text-sm font-bold transition-colors mb-6 border border-blue-500/20 shadow-lg flex justify-center items-center gap-2">
                    <i data-lucide="qr-code" class="w-5 h-5"></i> Generar Credencial Digital QR
                </button>                 <p class="text-slate-400 flex items-center gap-2"><i data-lucide="map-pin" class="w-4 h-4"></i> ${m.sede || 'N/A'}</p>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4 mt-6">
                <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50"><span class="block text-xs text-slate-500 uppercase font-bold mb-1">Teléfono</span><span class="text-slate-200">${m.telefono}</span></div>
                <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50"><span class="block text-xs text-slate-500 uppercase font-bold mb-1">Email</span><span class="text-slate-200">${m.email || '—'}</span></div>
                <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50"><span class="block text-xs text-slate-500 uppercase font-bold mb-1">Edad</span><span class="text-slate-200">${calcAge(m.fechaNacimiento)} años</span></div>
                <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50"><span class="block text-xs text-slate-500 uppercase font-bold mb-1">Estado Civil</span><span class="text-slate-200">${m.estadoCivil}</span></div>
                <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 col-span-2"><span class="block text-xs text-slate-500 uppercase font-bold mb-1">Dirección</span><span class="text-slate-200">${m.direccion}</span></div>
                
                <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50"><span class="block text-xs text-slate-500 uppercase font-bold mb-1">Bautizado</span><span class="text-slate-200">${m.bautizadoAguas}</span></div>
                <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                    <span class="block text-xs text-slate-500 uppercase font-bold mb-1">Grupo Vida</span>
                    <span class="text-slate-200">${m.grupoVida}</span>
                    ${m.deseaGrupoVida === 'Sí' ? '<span class="block text-xs text-emerald-400 font-bold mt-1">Desea Unirse</span>' : ''}
                </div>
                
                <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 col-span-2">
                    <span class="block text-xs text-slate-500 uppercase font-bold mb-1">Ruta de Crecimiento</span>
                    <span class="text-slate-200">${m.rutaCrecimiento}</span>
                    ${m.deseaRuta === 'Sí' ? '<span class="block text-xs text-emerald-400 font-bold mt-1">Desea Participar</span>' : ''}
                    ${m.nombreRutaCrecimiento ? `<div class="mt-2 text-sm text-blue-400 bg-blue-500/10 p-2 rounded border border-blue-500/20">${m.nombreRutaCrecimiento}</div>` : ''}
                </div>
                
                <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 col-span-2"><span class="block text-xs text-slate-500 uppercase font-bold mb-1">Áreas de Servicio de Interés</span><span class="text-slate-200">${Array.isArray(m.areaServicio) ? m.areaServicio.join(', ') : (m.areaServicio||'—')}</span></div>
                
                ${m.psychData && Array.isArray(m.psychData.areasApoyo) && m.psychData.areasApoyo.length > 0 ? `<div class="bg-purple-900/20 p-4 rounded-xl border border-purple-500/30 col-span-2"><span class="block text-xs text-purple-400 uppercase font-bold mb-1">Solicita Acompañamiento en:</span><span class="text-purple-200 font-medium">${m.psychData.areasApoyo.join(', ')}</span></div>` : ''}
                
                ${m.psychData && m.psychData.crecimientoEspiritual ? `<div class="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 col-span-2"><span class="block text-xs text-slate-500 uppercase font-bold mb-1">Estado Espiritual</span><span class="${m.psychData.crecimientoEspiritual.includes('alejado') || m.psychData.crecimientoEspiritual.includes('estancado') ? 'text-red-400 font-bold' : 'text-emerald-400'}">${m.psychData.crecimientoEspiritual}</span></div>` : ''}
                
                ${m.psychData && m.psychData.necesidadOracion ? `<div class="bg-purple-900/20 p-4 rounded-xl border border-purple-500/30 col-span-2"><span class="block text-xs text-purple-400 uppercase font-bold mb-1">Petición Pastoral / Oración</span><div class="text-purple-200 italic mt-1">"${m.psychData.necesidadOracion}"</div></div>` : ''}

                <!-- New Insight Cards -->
                <div class="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                    <div class="bg-slate-900/80 p-4 rounded-xl border border-slate-700/50">
                        <span class="block text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-widest">Diagnóstico Espiritual</span>
                        <div class="flex items-center gap-2">
                            <div class="w-2 h-2 rounded-full ${m.psychData?.spiritualAlert ? 'bg-emerald-500' : 'bg-slate-600'}"></div>
                            <span class="text-sm font-bold ${m.psychData?.spiritualAlert ? 'text-emerald-400' : 'text-slate-400'}">
                                ${m.psychData?.spiritualAlert ? 'MIEMBRO COMPROMETIDO' : 'EN CRECIMIENTO'}
                            </span>
                        </div>
                    </div>
                    <div class="bg-slate-900/80 p-4 rounded-xl border border-slate-700/50">
                        <span class="block text-[10px] text-slate-500 uppercase font-bold mb-2 tracking-widest">Temperamento</span>
                        <span class="text-sm font-bold text-white uppercase">${m.psychData?.temperament || 'No determinado'}</span>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('memberDetailHTML').innerHTML = html;
        lucide.createIcons();

        // Bitácora logic
        if (currentRole === 'Secretaria') {
            document.getElementById('bitacoraSection').style.display = 'none';
            document.getElementById('memberDetailHTML').classList.remove('lg:col-span-3');
            document.getElementById('memberDetailHTML').classList.add('lg:col-span-5');
        } else {
            document.getElementById('bitacoraSection').style.display = 'flex';
            document.getElementById('memberDetailHTML').classList.add('lg:col-span-3');
            document.getElementById('memberDetailHTML').classList.remove('lg:col-span-5');
            document.getElementById('bitacoraMemberId').value = m.id;
            renderBitacora(m.bitacora || []);
        }

        const modal = document.getElementById('memberModal');
        const content = document.getElementById('memberModalContent');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        // reflow
        void modal.offsetWidth;
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    };

    window.closeModal = function() {
        const modal = document.getElementById('memberModal');
        const content = document.getElementById('memberModalContent');
        modal.classList.add('opacity-0');
        content.classList.remove('scale-100');
        content.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }, 300);
    };

    function renderBitacora(notes) {
        const list = document.getElementById('bitacoraList');
        if (notes.length === 0) {
            list.innerHTML = '<div class="text-slate-500 text-xs italic text-center py-8">No hay notas pastorales registradas.</div>';
            return;
        }
        list.innerHTML = notes.map(n => `
            <div class="bg-slate-800/80 p-3 rounded-lg border border-slate-700/50">
                <span class="text-[10px] text-emerald-400 font-bold block mb-1">${new Date(n.date).toLocaleString()}</span>
                <p class="text-sm text-slate-200 leading-relaxed">${n.text}</p>
            </div>
        `).join('');
        list.scrollTop = list.scrollHeight;
    }

    window.addBitacoraNote = function() {
        const textObj = document.getElementById('bitacoraText');
        const text = textObj.value.trim();
        const id = document.getElementById('bitacoraMemberId').value;
        if (!text || !id) return;

        dbFirestore.collection('miembros').doc(id).update({
            bitacora: firebase.firestore.FieldValue.arrayUnion({ date: new Date().toISOString(), text: text })
        }).then(() => {
            textObj.value = '';
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Nota guardada', showConfirmButton: false, timer: 1500 });
            // Local view update just to be fast, but onSnapshot will handle the true update
            const idx = window.localDB.findIndex(x => x.id === id);
            if (idx !== -1) {
                if (!window.localDB[idx].bitacora) window.localDB[idx].bitacora = [];
                window.localDB[idx].bitacora.push({ date: new Date().toISOString(), text: text });
                renderBitacora(window.localDB[idx].bitacora);
            }
        });
    };

    window.cleanupDuplicates = function() {
        if (currentRole !== 'Pastor') {
            Swal.fire({ icon: 'error', title: 'Acceso Denegado', text: 'Solo el Pastor puede limpiar duplicados.'});
            return;
        }

        const db = getDB();
        const toDelete = [];
        const seen = new Set();
        let corruptCount = 0;
        let duplicateCount = 0;
        
        db.forEach(m => {
            const normName = m.nombreCompleto ? m.nombreCompleto.toLowerCase().trim() : 'desconocido';
            
            // Detect corrupt data
            if (normName === 'desconocido' || normName === 'undefined' || normName === '') {
                if (m.id && m.id !== 'missing_id') {
                    toDelete.push(m.id);
                    corruptCount++;
                }
                return;
            }

            // Signal 1, 2 & 3: Name, Birthdate, Interests
            const normDate = m.fechaNacimiento || '';
            const normInterests = m.intereses || '';
            // We use name + birthdate + interests as a strong duplicate signature
            const sig = `${normName}_${normDate}_${normInterests}`;
            
            if (seen.has(sig)) {
                if (m.id && m.id !== 'missing_id') {
                    toDelete.push(m.id);
                    duplicateCount++;
                }
            } else {
                seen.add(sig);
            }
        });
        
        const total = corruptCount + duplicateCount;
        
        if (total > 0) {
            Swal.fire({
                title: 'Auditoría de Datos',
                text: `He encontrado ${duplicateCount} registros duplicados y ${corruptCount} corruptos. ¿Deseas eliminarlos automáticamente?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                confirmButtonText: 'Sí, limpiar base de datos'
            }).then(res => {
                if(res.isConfirmed) {
                    Swal.fire({ title: 'Limpiando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
                    let promises = toDelete.map(id => dbFirestore.collection('miembros').doc(id).delete());
                    Promise.all(promises).then(() => {
                        Swal.fire('¡Limpio!', 'Los registros duplicados y corruptos han sido eliminados.', 'success');
                    }).catch(err => {
                        Swal.fire('Error', err.message, 'error');
                    });
                }
            });
        } else {
            Swal.fire('Base de datos sana', 'No se detectaron duplicados ni registros corruptos.', 'success');
        }
    };

    window.deleteMember = function(id) {
        if (currentRole !== 'Pastor') {
            Swal.fire({ icon: 'error', title: 'Acceso Denegado', text: 'Solo el Pastor puede eliminar.'});
            return;
        }
        if (!id || id === 'missing_id') {
            Swal.fire({ icon: 'error', title: 'Registro Corrupto', text: 'Este registro no tiene ID válido. Utiliza el botón de "Limpieza de Duplicados" para eliminarlo.'});
            return;
        }
        Swal.fire({
            title: '¿Eliminar miembro?', text: 'Se borrará toda su información y bitácora.', icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#334155', confirmButtonText: 'Sí, eliminar'
        }).then(res => {
            if (res.isConfirmed) {
                dbFirestore.collection('miembros').doc(id).delete().then(() => {
                    Swal.fire({ toast:true, position:'top-end', icon:'success', title:'Eliminado', showConfirmButton:false, timer:1500 });
                }).catch(err => {
                    if (err.code === 'permission-denied') {
                        Swal.fire({ icon: 'error', title: 'Permiso Denegado', text: 'Tienes que actualizar las reglas de Firestore.'});
                    } else {
                        Swal.fire({ icon: 'error', title: 'Error', text: err.message });
                    }
                });
            }
        });
    };

    window.exportToCSV = function() {
        if (!window.localDB || window.localDB.length === 0) {
            Swal.fire('No hay datos', 'La base de datos está vacía.', 'info');
            return;
        }
        
        let csvContent = "data:text/csv;charset=utf-8,";
        
        // Define Headers
        const headers = ["ID", "Nombre Completo", "Edad", "Teléfono", "Email", "Sede", "Estado Civil", "Profesión", "Grupo Vida", "Ruta Crecimiento", "Temperamento", "Área Servicio"];
        csvContent += headers.join(",") + "\n";
        
        window.localDB.forEach(m => {
            const age = m.edad || (m.fechaNacimiento ? (new Date().getFullYear() - new Date(m.fechaNacimiento).getFullYear()) : 'N/A');
            const row = [
                m.id,
                `"${m.nombreCompleto}"`,
                age,
                `"${m.telefono || ''}"`,
                `"${m.email || ''}"`,
                `"${m.sede || ''}"`,
                `"${m.estadoCivil || ''}"`,
                `"${m.profesion || ''}"`,
                `"${m.grupoVida || ''}"`,
                `"${m.nombreRutaCrecimiento || ''}"`,
                `"${m.psychData?.temperament || ''}"`,
                `"${(m.areaServicio || []).join(' / ')}"`
            ];
            csvContent += row.join(",") + "\n";
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Censo_Vida_Plena_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ===== 8. SETTINGS & ROLES =====
    function renderSettings() {
        const roles = getRoles();
        const list = document.getElementById('rolesList');
        list.innerHTML = roles.map((r, i) => `
            <div class="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                <div>
                    <strong class="text-white block">${r.user}</strong>
                    <div class="flex gap-2 items-center">
                        <span class="text-[10px] text-blue-400 font-bold uppercase">${r.role}</span>
                        ${r.scope ? `<span class="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-white/5">${r.scope}</span>` : ''}
                    </div>
                </div>
                <button onclick="deleteRole(${i})" class="text-red-400 hover:text-red-300 p-2"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
        `).join('');
        lucide.createIcons();
    }

    window.toggleRoleScope = function(role) {
        const container = document.getElementById('scopeContainer');
        if (role === 'Lider') container.classList.remove('hidden');
        else container.classList.add('hidden');
    };

    window.saveRole = function(e) {
        e.preventDefault();
        const u = document.getElementById('roleUser').value.trim();
        const p = document.getElementById('rolePass').value.trim();
        const rt = document.getElementById('roleType').value;
        const rs = rt === 'Lider' ? document.getElementById('roleScope').value : 'Todos';

        if (!u || !p) return;

        const roles = getRoles();
        const existingIdx = roles.findIndex(x => x.user.toLowerCase() === u.toLowerCase());
        if (existingIdx !== -1) {
            roles[existingIdx].pass = p;
            roles[existingIdx].role = rt;
            roles[existingIdx].scope = rs;
        } else {
            roles.push({ user: u, pass: p, role: rt, scope: rs });
        }
        saveRoles(roles);
        Swal.fire({ toast:true, position:'top-end', icon:'success', title:'Cuenta guardada', showConfirmButton:false, timer:2000 });
        document.getElementById('roleUser').value = '';
        document.getElementById('rolePass').value = '';
        renderSettings();
    };

    window.deleteRole = function(idx) {
        const roles = getRoles();
        if (roles[idx].user.toLowerCase() === 'admin') {
            Swal.fire({ icon: 'error', title: 'Acción inválida', text: 'No puedes eliminar la cuenta de administrador principal.' });
            return;
        }
        roles.splice(idx, 1);
        saveRoles(roles);
        renderSettings();
    };

    window.clearAllData = function() {
        if (currentRole !== 'Pastor') {
            Swal.fire({ icon: 'error', title: 'Acceso Denegado', text: 'Solo el Pastor Principal puede purgar la base de datos.'});
            return;
        }
        Swal.fire({
            title: '¿ELIMINAR TODO EL CENSO?',
            text: 'Esta acción borrará PERMANENTEMENTE todos los miembros, bitácoras y registros. Escribe "CONFIRMAR" para proceder.',
            icon: 'warning', input: 'text', showCancelButton: true,
            confirmButtonColor: '#ef4444', confirmButtonText: 'ELIMINAR TODO',
            preConfirm: (val) => { if (val !== 'CONFIRMAR') Swal.showValidationMessage('Texto incorrecto'); }
        }).then(async res => {
            if (res.isConfirmed) {
                // Delete all from Firestore (simple approach via iteration)
                window.localDB.forEach(m => {
                    dbFirestore.collection('miembros').doc(m.id).delete();
                });
                localStorage.removeItem('censoVidaPlenaDB');
                Swal.fire({ toast:true, position:'top-end', icon:'success', title:'Base de datos purgada', showConfirmButton:false, timer:2000 });
            }
        });
    };

    // ===== EXPORT =====
    window.exportCSV = function() {
        const db = getDB();
        if (db.length === 0) return;
        const headers = "Nombre,Telefono,Email,Edad,EstadoCivil,Sede,Bautizado,GrupoVida\n";
        const rows = db.map(m => `"${m.nombreCompleto}","${m.telefono}","${m.email||''}","${calcAge(m.fechaNacimiento)}","${m.estadoCivil}","${m.sede}","${m.bautizadoAguas}","${m.grupoVida}"`).join('\n');
        const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Censo_Vida_Plena.csv";
        link.click();
    };

    // ===== UTILS =====
    function getInitials(n) { return (n||'A').substring(0,2).toUpperCase(); }
    function calcAge(d) {
        if (!d) return 0;
        const b = new Date(d), t = new Date();
        let a = t.getFullYear() - b.getFullYear();
        if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
        return a;
    }
    function countBy(arr, key) {
        const c = {};
        arr.forEach(m => { const v = m[key] || 'Sin datos'; c[v] = (c[v] || 0) + 1; });
        return c;
    }

    // Chart Helper
    function renderChart(id, data, type, colorsArr, isLine = false) {
        const el = document.getElementById(id);
        if (!el) return;
        const entries = Object.entries(data);
        if (entries.length === 0) return;

        if (charts[id]) {
            charts[id].destroy();
            charts[id] = null;
        }

        const isCircular = (type === 'pie' || type === 'doughnut' || type === 'polarArea');

        const config = {
            type: type,
            data: {
                labels: entries.map(e => e[0]),
                datasets: [{
                    data: entries.map(e => e[1]),
                    backgroundColor: isLine ? colorsArr[0] + '33' : colorsArr.slice(0, entries.length).map(c => isCircular ? c + 'CC' : c),
                    borderColor: isLine ? colorsArr[0] : (isCircular ? '#0B1120' : colorsArr.slice(0, entries.length)),
                    borderWidth: isLine ? 3 : 2,
                    fill: isLine,
                    tension: 0.4 // Smooth lines
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: isCircular, position: 'bottom', labels: { color: '#cbd5e1' } } },
                scales: isCircular ? {} : {
                    y: { ticks: { color: '#94a3b8', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                }
            }
        };
        charts[id] = new Chart(el, config);
    }


    // ===== 2. BROADCAST (DIFUSIÓN) =====
    window.generateBroadcastList = function() {
        const type = document.getElementById('bcFilterType').value;
        const val = document.getElementById('bcFilterValue').value;
        const db = getDB();
        
        let filtered = db;
        if (type === 'ministerio' && val) filtered = db.filter(m => Array.isArray(m.areaServicio) && m.areaServicio.includes(val));
        else if (type === 'temperamento' && val) filtered = db.filter(m => m.psychData?.temperament === val);
        else if (type === 'sede' && val) filtered = db.filter(m => m.sede === val);
        else if (type === 'cumple') filtered = db.filter(m => m.fechaNacimiento && new Date(m.fechaNacimiento).getMonth() === new Date().getMonth());
        else if (type === 'ruta' && val) filtered = db.filter(m => m.nombreRutaCrecimiento === val);
        else if (type === 'riesgo') filtered = db.filter(m => m.psychData?.anxietyAlert || m.psychData?.depressionAlert || m.psychData?.tocAlert);

        document.getElementById('bcCount').textContent = filtered.length;
        window.currentBroadcastList = filtered;
        document.getElementById('bcResultsArea').classList.remove('hidden');

        const listContainer = document.getElementById('bcList');
        const template = document.getElementById('bcTemplate').value;

        listContainer.innerHTML = filtered.map(m => {
            const phone = m.telefono ? m.telefono.replace(/\D/g, '') : '';
            return `
            <div class="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 flex justify-between items-center group">
                <div class="truncate mr-2">
                    <p class="text-white text-sm font-bold truncate">${m.nombreCompleto}</p>
                    <p class="text-xs text-slate-500">${m.telefono || 'Sin Tlf'}</p>
                </div>
                ${phone ? `
                <button onclick="openWhatsApp('${phone}', '${m.nombreCompleto}')" class="w-10 h-10 rounded-xl bg-green-600/20 text-green-500 flex items-center justify-center flex-shrink-0 hover:bg-green-600 hover:text-white transition-all shadow-lg hover:shadow-green-600/20">
                    <i data-lucide="send" class="w-4 h-4"></i>
                </button>` : ''}
            </div>
            `;
        }).join('');
        lucide.createIcons();
    };

    window.setTemplate = function(type) {
        const t = document.getElementById('bcTemplate');
        if (type === 'birthday') t.value = "¡Hola [Nombre]! 👋 Desde Iglesia Vida Plena queremos desearte un muy feliz cumpleaños. 🎂 Que Dios te bendiga grandemente en este día tan especial. ¡Te mandamos un abrazo!";
        else if (type === 'event') t.value = "Hola [Nombre], te escribimos para invitarte a nuestro próximo evento: [Nombre del Evento]. 📅 ¡No te lo puedes perder! Dios tiene algo especial para ti.";
        else if (type === 'welcome') t.value = "¡Bienvenido [Nombre]! 👋 Qué alegría que nos acompañaras hoy. Estamos para servirte y caminar juntos en fe. ¡Dios te bendiga!";
    };

    window.openWhatsApp = function(phone, name) {
        let text = document.getElementById('bcTemplate').value;
        text = text.replace(/\[Nombre\]/g, name.split(' ')[0]); // Use first name
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    document.getElementById('bcFilterType')?.addEventListener('change', (e) => {
        const valSelect = document.getElementById('bcFilterValue');
        const db = getDB();
        if (e.target.value === 'all') { valSelect.classList.add('hidden'); return; }
        
        valSelect.classList.remove('hidden');
        valSelect.innerHTML = '';
        let options = [];
        if (e.target.value === 'ministerio') options = ["Alabanza", "Vida Kids", "Conexión", "Anfitriones", "Equipo de Producción", "Oración", "Multimedia"];
        else if (e.target.value === 'temperamento') options = ["Sanguíneo", "Colérico", "Melancólico", "Flemático", "No determinado"];
        else if (e.target.value === 'sede') options = [...new Set(db.map(m => m.sede).filter(Boolean))];
        else if (e.target.value === 'ruta') options = ["Vida Plena (Inicio)", "Fase 1: Encuentro", "Fase 2: Consolidación", "Fase 3: Discipulado", "Fase 4: Liderazgo", "Fase 5: Ministerio", "Fase 6: Enviado"];
        
        if (options.length === 0) { valSelect.classList.add('hidden'); return; }

        options.forEach(o => {
            const opt = document.createElement('option'); opt.value = o; opt.textContent = o; valSelect.appendChild(opt);
        });
    });

    window.copyEmails = function() {
        if(!window.currentBroadcastList) return;
        const emails = window.currentBroadcastList.map(m => m.email).filter(Boolean).join(', ');
        navigator.clipboard.writeText(emails);
        Swal.fire({toast: true, position: 'top-end', icon: 'success', title: 'Emails copiados para CCO', showConfirmButton: false, timer: 2000});
    };
    window.copyPhones = function() {
        if(!window.currentBroadcastList) return;
        const phones = window.currentBroadcastList.map(m => m.telefono).filter(Boolean).join('\n');
        navigator.clipboard.writeText(phones);
        Swal.fire({toast: true, position: 'top-end', icon: 'success', title: 'Teléfonos copiados', showConfirmButton: false, timer: 2000});
    };

    // --- WhatsApp Groups Sub-module ---
    let localWAGroups = [];
    dbFirestore.collection('whatsappGroups').onSnapshot(snapshot => {
        localWAGroups = [];
        snapshot.forEach(doc => { let d = doc.data(); d.gid = doc.id; localWAGroups.push(d); });
        renderWAGroups();
    });

    window.openGroupModal = function() {
        document.getElementById('groupName').value = ''; document.getElementById('groupLink').value = '';
        const modal = document.getElementById('groupModal');
        modal.classList.remove('hidden'); modal.classList.add('flex');
        setTimeout(() => { modal.classList.remove('opacity-0'); document.getElementById('groupModalContent').classList.remove('scale-95'); }, 10);
    };
    window.closeGroupModal = function() {
        const modal = document.getElementById('groupModal');
        modal.classList.add('opacity-0'); document.getElementById('groupModalContent').classList.add('scale-95');
        setTimeout(() => { modal.classList.remove('flex'); modal.classList.add('hidden'); }, 300);
    };

    window.saveWhatsAppGroup = function() {
        const name = document.getElementById('groupName').value;
        const link = document.getElementById('groupLink').value;
        if (!name || !link) return Swal.fire('Error', 'Todos los campos son obligatorios', 'warning');
        
        dbFirestore.collection('whatsappGroups').add({
            name: name,
            link: link,
            createdAt: new Date().toISOString()
        }).then(() => {
            closeGroupModal();
            Swal.fire({toast: true, position: 'top-end', icon: 'success', title: 'Grupo Registrado', showConfirmButton: false, timer: 2000});
        });
    };

    window.deleteWAGroup = function(gid) {
        Swal.fire({
            title: '¿Eliminar acceso?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí'
        }).then(res => { if(res.isConfirmed) dbFirestore.collection('whatsappGroups').doc(gid).delete(); });
    };

    function renderWAGroups() {
        const container = document.getElementById('waGroupsList');
        if (!container) return;
        if (localWAGroups.length === 0) {
            container.innerHTML = '<p class="text-[10px] text-slate-500 italic text-center py-4">No hay grupos registrados.</p>';
            return;
        }
        container.innerHTML = localWAGroups.map(g => `
            <div class="flex items-center justify-between bg-white/5 p-2 rounded-xl border border-white/5 group">
                <div class="truncate">
                    <p class="text-white text-xs font-bold truncate">${g.name}</p>
                    <a href="${g.link}" target="_blank" class="text-[9px] text-blue-400 hover:underline truncate block">Abrir Link del Grupo</a>
                </div>
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <a href="${g.link}" target="_blank" class="w-7 h-7 bg-green-500/20 text-green-400 rounded-lg flex items-center justify-center hover:bg-green-500 hover:text-white transition-all"><i data-lucide="external-link" class="w-3.5 h-3.5"></i></a>
                    <button onclick="deleteWAGroup('${g.gid}')" class="w-7 h-7 bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    }

    // ===== 3. EVENTOS =====
    let localEvents = [];
    dbFirestore.collection('eventos').onSnapshot(snapshot => {
        localEvents = [];
        snapshot.forEach(doc => { let d = doc.data(); d.eid = doc.id; localEvents.push(d); });
        renderEvents();
    });

    window.openEventModal = function() {
        document.getElementById('evName').value = ''; document.getElementById('evDate').value = ''; document.getElementById('evCost').value = '';
        const modal = document.getElementById('eventModal');
        modal.classList.remove('hidden'); modal.classList.add('flex');
        void modal.offsetWidth; modal.classList.remove('opacity-0'); document.getElementById('eventModalContent').classList.remove('scale-95');
    };
    window.closeEventModal = function() {
        const modal = document.getElementById('eventModal');
        modal.classList.add('opacity-0'); document.getElementById('eventModalContent').classList.add('scale-95');
        setTimeout(() => { modal.classList.remove('flex'); modal.classList.add('hidden'); }, 300);
    };

    window.saveEvent = function() {
        const n = document.getElementById('evName').value, 
              d = document.getElementById('evDate').value, 
              c = document.getElementById('evCost').value,
              a = document.getElementById('evAudience').value;

        if(!n || !d) return Swal.fire('Error', 'Nombre y fecha requeridos', 'warning');
        
        dbFirestore.collection('eventos').add({ 
            nombre: n, 
            fecha: d, 
            costo: c, 
            audience: a,
            createdAt: new Date().toISOString() 
        }).then(() => {
            closeEventModal(); 
            Swal.fire({toast:true, position:'top-end', icon:'success', title:'Evento creado', showConfirmButton:false, timer:2000});
            renderCalendar();
        });
    };

    window.deleteEvent = function(eid) {
        dbFirestore.collection('eventos').doc(eid).delete();
    };

    function renderEvents() {
        const container = document.getElementById('eventsList');
        if(!container) return;
        container.innerHTML = localEvents.map(e => `
            <div class="bg-slate-900 border border-slate-700 p-5 rounded-2xl relative overflow-hidden group">
                <div class="absolute top-0 right-0 bg-purple-600/20 text-purple-400 text-[10px] px-3 py-1 rounded-bl-lg font-bold">${e.costo || 'Gratis'}</div>
                <div class="mb-2">
                    <span class="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full uppercase font-bold tracking-widest">${e.audience || 'Todos'}</span>
                </div>
                <h4 class="text-lg font-bold text-white mb-2 pr-12">${e.nombre}</h4>
                <p class="text-sm text-slate-400 mb-4"><i data-lucide="calendar" class="inline w-4 h-4 mr-1"></i> ${new Date(e.fecha).toLocaleString()}</p>
                <div class="flex flex-col gap-2">
                    <button class="w-full bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white py-2 rounded-lg text-sm transition-all border border-blue-500/20 flex items-center justify-center gap-2" onclick="notifyEventAudience('${e.audience}', '${e.nombre}', '${e.fecha}')">
                        <i data-lucide="send" class="w-4 h-4"></i> Notificar a ${e.audience || 'Todos'}
                    </button>
                    <div class="flex gap-2">
                        <button class="flex-1 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white py-2 rounded-lg text-sm transition-colors border border-emerald-500/20 flex items-center justify-center gap-2" onclick="viewEventRegistrations('${e.eid}', '${e.nombre}')">
                            <i data-lucide="users" class="w-4 h-4"></i> Ver Inscritos
                        </button>
                        <button class="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm transition-colors border border-slate-600" onclick="navigator.clipboard.writeText(window.location.origin + '/evento.html?id=' + '${e.eid}'); Swal.fire({toast:true, position:'top-end', icon:'success', title:'Enlace Copiado', showConfirmButton:false, timer:1500});">Link</button>
                        <button class="w-10 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center transition-colors" onclick="deleteEvent('${e.eid}')"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
        renderCalendar();
    }

    window.viewEventRegistrations = function(eid, eventName) {
        Swal.fire({
            title: 'Inscritos: ' + eventName,
            width: '800px',
            html: `
                <div class="overflow-x-auto custom-scrollbar" style="max-height: 400px;">
                    <table class="w-full text-left text-sm">
                        <thead class="border-b border-slate-700 text-slate-400">
                            <tr>
                                <th class="py-2">Nombre</th>
                                <th class="py-2">Teléfono</th>
                                <th class="py-2">Sede</th>
                                <th class="py-2">Fecha</th>
                            </tr>
                        </thead>
                        <tbody id="registrationsList">
                            <tr><td colspan="4" class="py-10 text-center">Cargando...</td></tr>
                        </tbody>
                    </table>
                </div>
            `,
            showConfirmButton: false,
            showCloseButton: true,
            background: '#0B1120',
            color: '#fff',
            didOpen: () => {
                dbFirestore.collection('inscripciones_evento')
                    .where('eventId', '==', eid)
                    .orderBy('fechaRegistro', 'desc')
                    .get().then(snap => {
                        const list = document.getElementById('registrationsList');
                        if (snap.empty) {
                            list.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-slate-500">No hay inscritos aún.</td></tr>';
                            return;
                        }
                        list.innerHTML = snap.docs.map(doc => {
                            const d = doc.data();
                            return `
                                <tr class="border-b border-white/5">
                                    <td class="py-3 font-bold">${d.nombre}</td>
                                    <td class="py-3"><a href="https://wa.me/${d.telefono.replace(/\D/g,'')}" target="_blank" class="text-blue-400 hover:underline">${d.telefono}</a></td>
                                    <td class="py-3 text-slate-400">${d.sede}</td>
                                    <td class="py-3 text-slate-400">${new Date(d.fechaRegistro).toLocaleDateString()}</td>
                                </tr>
                            `;
                        }).join('');
                    }).catch(err => {
                        console.error(err);
                        document.getElementById('registrationsList').innerHTML = '<tr><td colspan="4" class="py-10 text-center text-red-400">Error al cargar (Asegúrate de crear el índice en Firebase).</td></tr>';
                    });
            }
        });
    };

    window.notifyEventAudience = function(audience, eventName, date) {
        // Switch to Broadcast section and pre-filter
        const navItem = document.querySelector('.nav-item[data-section="broadcast"]');
        if (navItem) {
            navItem.click();
            setTimeout(() => {
                const typeSelect = document.getElementById('bcFilterType');
                const valSelect = document.getElementById('bcFilterValue');
                
                if (audience === 'Todos') {
                    typeSelect.value = 'all';
                } else {
                    typeSelect.value = 'ministerio';
                    typeSelect.dispatchEvent(new Event('change'));
                    valSelect.value = audience;
                }
                generateBroadcastList();
                
                Swal.fire({
                    title: 'Filtro Aplicado',
                    text: `Se han filtrado los miembros de "${audience}". Ahora puedes copiar sus contactos para invitarlos al evento: ${eventName}`,
                    icon: 'info'
                });
            }, 500);
        }
    };

    // ===== 4. CALENDARIO =====
    window.changeMonth = function(dir) {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + dir);
        renderCalendar();
    };

    function renderCalendar() {
        const grid = document.getElementById('calendarGrid');
        const monthYearLabel = document.getElementById('currentMonthYear');
        if (!grid || !monthYearLabel) return;

        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        monthYearLabel.textContent = `${monthNames[month]} ${year}`;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        grid.innerHTML = "";

        for (let i = 0; i < firstDay; i++) {
            const empty = document.createElement('div');
            empty.className = "bg-slate-900/20 rounded-xl h-24";
            grid.appendChild(empty);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dayEl = document.createElement('div');
            dayEl.className = "bg-slate-900/50 border border-white/5 rounded-xl p-2 h-24 relative overflow-hidden hover:bg-slate-800/50 transition-colors";
            
            const birthdays = window.localDB.filter(m => {
                if (!m.fechaNacimiento) return false;
                const d = new Date(m.fechaNacimiento);
                return d.getMonth() === month && d.getDate() === (day - 1); // Compensating typical timezones
            });

            const events = localEvents.filter(e => {
                const d = new Date(e.fecha);
                return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
            });

            dayEl.innerHTML = `<span class="text-xs font-bold text-slate-500">${day}</span>`;
            const Indicators = document.createElement('div');
            Indicators.className = "flex flex-col gap-1 mt-1";
            
            if (birthdays.length > 0) {
                const b = document.createElement('div');
                b.className = "text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold truncate";
                b.innerHTML = `<i data-lucide="cake" class="w-2 h-2"></i> ${birthdays.length} Cumple`;
                Indicators.appendChild(b);
            }

            events.forEach(e => {
                const ev = document.createElement('div');
                ev.className = "text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold truncate";
                ev.innerHTML = `<i data-lucide="star" class="w-2 h-2"></i> ${e.nombre}`;
                Indicators.appendChild(ev);
            });

            dayEl.appendChild(Indicators);
            grid.appendChild(dayEl);
        }

        const birthdayList = document.getElementById('monthBirthdays');
        const monthBirthdays = window.localDB.filter(m => m.fechaNacimiento && new Date(m.fechaNacimiento).getMonth() === month);
        birthdayList.innerHTML = monthBirthdays.length ? monthBirthdays.map(m => `
            <div class="flex items-center gap-3 bg-white/5 p-2 rounded-lg">
                <div class="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">${m.nombreCompleto.substring(0,1)}</div>
                <div class="truncate">
                    <p class="text-white text-xs font-bold truncate">${m.nombreCompleto}</p>
                    <p class="text-[10px] text-slate-400">Día ${new Date(m.fechaNacimiento).getDate() + 1}</p>
                </div>
            </div>
        `).join('') : '<p class="text-center py-4 text-xs text-slate-500">Sin cumpleaños este mes</p>';

        const eventListPanel = document.getElementById('monthEvents');
        const monthEvents = localEvents.filter(e => new Date(e.fecha).getMonth() === month && new Date(e.fecha).getFullYear() === year);
        eventListPanel.innerHTML = monthEvents.length ? monthEvents.map(e => `
            <div class="bg-purple-500/10 border border-purple-500/20 p-3 rounded-xl">
                <p class="text-white text-xs font-bold">${e.nombre}</p>
                <p class="text-[10px] text-purple-400">${new Date(e.fecha).toLocaleDateString()}</p>
            </div>
        `).join('') : '<p class="text-center py-4 text-xs text-slate-500">Sin eventos este mes</p>';

        lucide.createIcons();
    }

    // ===== 4. BIBLIOTECA PASTORAL =====
    let localLibrary = [];
    dbFirestore.collection('biblioteca').onSnapshot(snapshot => {
        localLibrary = [];
        snapshot.forEach(doc => { let d = doc.data(); d.lid = doc.id; localLibrary.push(d); });
        renderLibrary();
    });

    // Google Drive Config Global
    const GD_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxg6dONy8bnLU7a6MaAjf22AwbWF10OsL_bDJvVRQ1hqTGJZS0eHg4c8y_QRfu50oU5/exec";
    const GD_FOLDER_ID = "1yW0LcMfoGrdT7sbrnrEz6J_McqDXzbKk";

    window.uploadLibraryFile = function(input) {
        if(!input.files.length) return;
        const file = input.files[0];
        const barContainer = document.getElementById('uploadProgress');
        const bar = document.getElementById('uploadProgressBar');
        
        barContainer.classList.remove('hidden'); 
        bar.style.width = '10%'; 
        bar.classList.add('animate-pulse');

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function() {
            const base64 = reader.result.split(',')[1];
            const payload = {
                base64: base64,
                type: file.type,
                name: file.name,
                folderId: GD_FOLDER_ID
            };

            bar.style.width = '50%';

            fetch(GD_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify(payload)
            }).then(() => {
                dbFirestore.collection('biblioteca').add({
                    name: file.name, 
                    url: `https://drive.google.com/drive/u/0/folders/${GD_FOLDER_ID}`, 
                    size: file.size, 
                    date: new Date().toISOString(), 
                    uploader: currentRole,
                    isGoogleDrive: true
                }).then(() => {
                    bar.style.width = '100%';
                    setTimeout(() => {
                        barContainer.classList.add('hidden');
                        bar.classList.remove('animate-pulse');
                        input.value = '';
                        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Subido a Google Drive', showConfirmButton: false, timer: 3000 });
                        syncGoogleDrive(); // Auto sync after upload
                    }, 500);
                });
            }).catch(err => {
                console.error(err);
                Swal.fire('Error', 'No se pudo contactar con Google Drive.', 'error');
                barContainer.classList.add('hidden');
            });
        };
    };

    window.syncGoogleDrive = async function() {
        const syncBtn = document.querySelector('button[onclick="syncGoogleDrive()"]');
        const originalHTML = syncBtn.innerHTML;
        syncBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Sincronizando...';
        lucide.createIcons();
        syncBtn.disabled = true;

        Swal.fire({
            title: 'Sincronizando Drive...',
            html: 'Buscando carpetas y archivos recientes.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading() }
        });

        try {
            const response = await fetch(GD_SCRIPT_URL + "?action=list");
            const files = await response.json();
            console.log("Archivos de Drive recibidos:", files);
            
            window.googleDriveFiles = files;
            renderLibrary();
            Swal.close();
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Drive Sincronizado', showConfirmButton: false, timer: 1500 });
        } catch (err) {
            console.error(err);
            Swal.fire('Atención', 'Para sincronizar archivos existentes, asegúrate de haber actualizado el Script de Google con la función "doGet" que te proporcionó Pedro.', 'warning');
        } finally {
            syncBtn.innerHTML = originalHTML;
            syncBtn.disabled = false;
            lucide.createIcons();
        }
    };

    window.deleteLibraryFile = function(lid, gDriveId) {
        Swal.fire({
            title: '¿Eliminar recurso?',
            text: "Se enviará a la papelera (Google Drive o Firestore).",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Sí, eliminar'
        }).then((result) => {
            if (result.isConfirmed) {
                if (gDriveId) {
                    // Delete from Google Drive
                    fetch(GD_SCRIPT_URL, {
                        method: 'POST',
                        mode: 'no-cors',
                        body: JSON.stringify({ action: 'delete', id: gDriveId })
                    }).then(() => {
                        // Optimistic UI: remove from synced list
                        window.googleDriveFiles = window.googleDriveFiles.filter(f => f.id !== gDriveId);
                        renderLibrary();
                        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Borrado en Drive', showConfirmButton: false, timer: 1500 });
                    });
                } else {
                    // Delete from Firestore
                    dbFirestore.collection('biblioteca').doc(lid).delete().then(() => {
                        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Eliminado', showConfirmButton: false, timer: 1500 });
                    });
                }
            }
        });
    };

    window.promptAddLink = async function() {
        const { value: formValues } = await Swal.fire({
            title: 'Añadir Recurso Externo',
            background: '#0B1120',
            color: '#fff',
            html:
                '<div class="text-left"><label class="text-xs text-slate-400">Nombre del Recurso</label><input id="swal-name" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white mt-1 mb-4 outline-none focus:border-indigo-500" placeholder="Ej: Manual de Líderes (TeraBox)"></div>' +
                '<div class="text-left"><label class="text-xs text-slate-400">URL del Enlace</label><input id="swal-url" class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white mt-1 outline-none focus:border-indigo-500" placeholder="https://terabox.com/s/..."></div>',
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Guardar Link',
            preConfirm: () => {
                const name = document.getElementById('swal-name').value;
                const url = document.getElementById('swal-url').value;
                if (!name || !url) {
                    Swal.showValidationMessage('Ambos campos son requeridos');
                    return false;
                }
                return { name, url };
            }
        });

        if (formValues) {
            dbFirestore.collection('biblioteca').add({
                name: formValues.name, 
                url: formValues.url, 
                size: 0, 
                date: new Date().toISOString(), 
                uploader: currentRole, 
                isLink: true
            }).then(() => {
                Swal.fire({toast:true, position:'top-end', icon:'success', title:'Link Añadido', showConfirmButton:false, timer:2000});
            });
        }
    };

    window.promptCreateFolder = async function() {
        const { value: folderName } = await Swal.fire({
            title: 'Crear Carpeta en Drive',
            background: '#0B1120',
            color: '#fff',
            input: 'text',
            inputLabel: 'Nombre de la carpeta',
            inputPlaceholder: 'Ej: Bosquejos 2024',
            showCancelButton: true,
            confirmButtonText: 'Crear',
            inputValidator: (value) => { if (!value) return '¡Necesitas un nombre!'; }
        });

        if (folderName) {
            Swal.fire({ title: 'Creando...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
            
            fetch(GD_SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({ action: 'createFolder', name: folderName, parentId: GD_FOLDER_ID })
            }).then(() => {
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Carpeta enviada a Drive', showConfirmButton: false, timer: 2000 });
                // Wait 2 seconds before syncing to give Drive time to reflect the new folder
                setTimeout(() => {
                    syncGoogleDrive();
                }, 2000);
            }).catch(err => {
                console.error("Error al crear carpeta:", err);
                Swal.fire('Error', 'No se pudo contactar con el servidor de Drive.', 'error');
            });
        }
    };

    window.previewFile = function(url, name, gDriveId, isFolder) {
        if (isFolder) {
            // If it's a folder, we could ideally navigate into it, 
            // but for now we just open it in Drive.
            window.open(url, '_blank');
            return;
        }

        const modal = document.getElementById('previewModal');
        const frame = document.getElementById('previewFrame');
        const title = document.getElementById('previewTitle');
        
        title.textContent = name;
        
        // Comprehensive Preview Logic
        if (gDriveId) {
            // Google Drive Universal Preview
            frame.src = `https://drive.google.com/file/d/${gDriveId}/preview`;
        } else if (url.includes('firebasestorage')) {
            // Direct Firebase files
            frame.src = url;
        } else {
            // External Links / Others
            frame.src = url;
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.querySelector('div').classList.remove('scale-95');
        }, 10);
    };

    window.closePreview = function() {
        const modal = document.getElementById('previewModal');
        modal.classList.add('opacity-0');
        modal.querySelector('div').classList.add('scale-95');
        setTimeout(() => {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
            document.getElementById('previewFrame').src = "";
        }, 300);
    };

    window.googleDriveFiles = [];

    function renderLibrary() {
        const container = document.getElementById('libraryList');
        if(!container) return;
        
        // Combine Firestore files and Google Drive Synced files
        const combined = [...localLibrary];
        
        // Add GD Synced files if not already in localLibrary
        window.googleDriveFiles.forEach(gdf => {
            if (!combined.find(c => c.url.includes(gdf.id) || c.name === gdf.name)) {
                combined.push({
                    lid: gdf.id,
                    name: gdf.name,
                    url: gdf.url,
                    size: gdf.size,
                    date: gdf.date,
                    uploader: 'Sincronizado (Drive)',
                    isGoogleDrive: true,
                    gDriveId: gdf.id,
                    mime: gdf.mime
                });
            }
        });

        if (combined.length === 0) {
            container.innerHTML = '<tr><td colspan="4" class="py-10 text-center text-slate-500 italic">No hay archivos. Usa "Sincronizar" para ver tus archivos de Drive.</td></tr>';
            return;
        }

        container.innerHTML = combined.sort((a,b) => {
            // Folders first
            const aIsFolder = a.mime === 'application/vnd.google-apps.folder';
            const bIsFolder = b.mime === 'application/vnd.google-apps.folder';
            if (aIsFolder && !bIsFolder) return -1;
            if (!aIsFolder && bIsFolder) return 1;
            // Then by date
            return new Date(b.date) - new Date(a.date);
        }).map(f => {
            let icon = 'file-text';
            let iconColor = 'text-indigo-400';
            let sizeStr = f.size ? (f.size / 1024 / 1024).toFixed(2) + ' MB' : 'N/A';

            // Detección de Carpeta
            const isFolder = f.mime === 'application/vnd.google-apps.folder';
            // Detección de Video
            const isVideo = f.name.match(/\.(mp4|mov|avi|mkv|webm)$/i) || (f.mime && f.mime.startsWith('video/'));

            if (isFolder) {
                icon = 'folder';
                iconColor = 'text-yellow-400';
                sizeStr = 'Carpeta de Drive';
            } else if (isVideo) {
                icon = 'video';
                iconColor = 'text-red-400';
                sizeStr = f.isGoogleDrive ? 'Video (Drive)' : sizeStr;
            } else if (f.isLink) { 
                icon = 'link'; 
                iconColor = 'text-blue-400'; 
                sizeStr = 'Enlace Externo';
            } else if (f.isGoogleDrive) { 
                icon = 'cloud'; 
                iconColor = 'text-emerald-400'; 
                sizeStr = 'Google Drive';
            }
            
            return `
            <tr class="hover:bg-white/5 transition-all border-b border-white/5 last:border-0 group">
                <td class="py-4 px-4 font-medium text-white">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-slate-800/80 flex items-center justify-center ${iconColor} border border-white/5 shadow-inner">
                            <i data-lucide="${icon}" class="w-5 h-5"></i>
                        </div>
                        <div class="truncate max-w-[200px] md:max-w-md">
                            <a href="${f.url}" target="_blank" class="font-bold text-slate-200 hover:text-indigo-400 transition-colors block truncate">${f.name}</a>
                            <div class="flex items-center gap-2 mt-0.5">
                                ${isFolder ? '<span class="text-[9px] bg-yellow-500/20 text-yellow-500 px-1.5 py-0.5 rounded-md font-black uppercase tracking-tighter">Carpeta</span>' : ''}
                                <span class="text-[10px] text-slate-500 uppercase tracking-widest font-bold">${sizeStr}</span>
                            </div>
                        </div>
                    </div>
                </td>
                <td class="py-4 px-4 text-slate-400 text-xs font-medium">${f.uploader}</td>
                <td class="py-4 px-4 text-slate-500 text-xs">${new Date(f.date).toLocaleDateString()}</td>
                <td class="py-4 px-4 text-right">
                    <div class="flex justify-end gap-2">
                        <button onclick="previewFile('${f.url}', '${f.name}', '${f.gDriveId || ''}', ${isFolder})" class="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all opacity-0 group-hover:opacity-100" title="Vista Previa">
                            <i data-lucide="${isFolder ? 'external-link' : 'eye'}" class="w-4 h-4"></i>
                        </button>
                        <button onclick="deleteLibraryFile('${f.lid}', '${f.gDriveId || ''}')" class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
        lucide.createIcons();
        applyRoleSecurityUI();
    }

    function applyRoleSecurityUI() {
        const role = currentRole;
        
        // 1. Bitácora Visibility (Only Pastor)
        const bitacora = document.getElementById('bitacoraSection');
        if (bitacora) {
            if (role === 'Pastor') bitacora.style.display = 'flex';
            else bitacora.style.display = 'none';
        }

        // 2. Settings Access (Only Pastor and Admin)
        const settingsNavs = document.querySelectorAll('[data-section="settings"]');
        settingsNavs.forEach(nav => {
            if (role === 'Pastor' || role === 'Admin') nav.classList.remove('hidden');
            else nav.classList.add('hidden');
        });
        
        // 3. Sensitive Buttons (Delete, Purge, Cleanup)
        const sensitiveButtons = document.querySelectorAll('.btn-delete-member, .btn-purge, .btn-cleanup');
        sensitiveButtons.forEach(btn => {
            if (role === 'Pastor' || role === 'Admin') btn.classList.remove('hidden');
            else btn.classList.add('hidden');
        });

        // 4. Library Management (Only Pastor and Admin)
        const libMgmt = document.querySelectorAll('.lib-mgmt-btn');
        libMgmt.forEach(btn => {
            if (role === 'Pastor' || role === 'Admin') btn.classList.remove('hidden');
            else btn.classList.add('hidden');
        });

        // Ensure mobile nav is also protected
        const mobileSettings = document.getElementById('mobileNavSettings');
        if (mobileSettings) {
            if (role === 'Pastor' || role === 'Admin') mobileSettings.style.display = 'flex';
            else mobileSettings.style.display = 'none';
        }
    }

    // Run Initial Renders
    renderDashboard();
    
})();

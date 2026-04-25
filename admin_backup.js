(function () {
    'use strict';

    // ===== AUTH CHECK =====
    const session = JSON.parse(localStorage.getItem('adminSession'));
    if (!session || !session.loggedIn) {
        window.location.href = 'index.html';
        return;
    }

    // ===== DATA =====
    function getDB() {
        return JSON.parse(localStorage.getItem('censoVidaPlenaDB')) || [];
    }

    function getNotifs() {
        return JSON.parse(localStorage.getItem('vidaPlenaNotifs')) || [];
    }

    function saveNotifs(n) {
        localStorage.setItem('vidaPlenaNotifs', JSON.stringify(n));
    }

    // ===== SIDEBAR NAV =====
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');

    navItems.forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const sec = item.dataset.section;
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById('section-' + sec).classList.add('active');
            document.querySelector('.topbar-title').textContent =
                item.textContent.trim().replace(/\d+$/, '').trim();
            // Close mobile sidebar
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.remove('active');
            // Refresh
            if (sec === 'dashboard') renderDashboard();
            if (sec === 'members') renderMembers();
            if (sec === 'notifications') renderNotifications();
            if (sec === 'alerts') renderAlerts();
        });
    });

    // ===== SIDEBAR TOGGLE =====
    window.toggleSidebar = function () {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('sidebarOverlay').classList.toggle('active');
    };

    // ===== LOGOUT =====
    window.logout = function () {
        localStorage.removeItem('adminSession');
        window.location.href = 'index.html';
    };

    // ===== DASHBOARD =====
    function renderDashboard() {
        const db = getDB();
        const baptized = db.filter(m => m.bautizadoAguas === 'Sí').length;
        const groups = db.filter(m => m.grupoVida === 'Sí').length;
        const alerts = db.filter(m => m.psychData &&
            (m.psychData.anxietyAlert || m.psychData.depressionAlert || m.psychData.tocAlert)).length;

        // CountUp.js for stats
        if (typeof countUp !== 'undefined') {
            const opts = { duration: 1.5, useEasing: true };
            new countUp.CountUp('sTotalMembers', db.length, opts).start();
            new countUp.CountUp('sBaptized', baptized, opts).start();
            new countUp.CountUp('sGroups', groups, opts).start();
            new countUp.CountUp('sAlerts', alerts, opts).start();
        } else {
            animNum('sTotalMembers', db.length);
            animNum('sBaptized', baptized);
            animNum('sGroups', groups);
            animNum('sAlerts', alerts);
        }
        document.getElementById('alertBadge').textContent = alerts;

        // Charts — explicit type per chart
        renderChart('chartCivil', countBy(db, 'estadoCivil'), 'bar');
        renderChart('chartService', countServices(db), 'horizontalBar');
        renderChart('chartTime', countBy(db, 'tiempoAsistiendo'), 'horizontalBar');
        renderChart('chartAge', countAges(db), 'bar');
        renderChart('chartBlood', countBy(db, 'tipoSangre'), 'horizontalBar');
        renderChart('chartSede', countBy(db, 'sede'), 'doughnut');
        renderChart('chartTemperament', countTemperaments(db), 'polarArea');
        renderChart('chartBiblia', countBy(db, 'lecturaBiblia'), 'bar');
        renderChart('chartLaboral', countBy(db, 'trabajando'), 'doughnut');

        // KPIs
        if (db.length > 0) {
            const ages = db.map(m => calcAge(m.fechaNacimiento)).filter(a => a > 0);
            const avgAge = ages.length ? Math.round(ages.reduce((a,b) => a+b, 0) / ages.length) : 0;
            document.getElementById('kpiAvgAge').textContent = avgAge + ' años';
            document.getElementById('kpiBaptismRate').textContent = Math.round((baptized / db.length) * 100) + '%';
            const employed = db.filter(m => m.trabajando === 'Sí').length;
            document.getElementById('kpiEmployRate').textContent = Math.round((employed / db.length) * 100) + '%';
            const volunteers = db.filter(m => m.equipoVoluntarios === 'Sí').length;
            document.getElementById('kpiVolunteer').textContent = Math.round((volunteers / db.length) * 100) + '%';
        }

        // Recent registrations
        renderRecent(db);

        // Tippy tooltips
        if (typeof tippy !== 'undefined') {
            tippy('[data-tippy-content]', { animation: 'scale', theme: 'light-border' });
        }
    }

    function animNum(id, target) {
        const el = document.getElementById(id);
        if (!el) return;
        if (target === 0) { el.textContent = '0'; return; }
        let cur = 0;
        const step = target / 40;
        const timer = setInterval(() => {
            cur += step;
            if (cur >= target) { el.textContent = target; clearInterval(timer); }
            else el.textContent = Math.floor(cur);
        }, 25);
    }

    function countBy(arr, key) {
        const c = {};
        arr.forEach(m => {
            const v = m[key] || 'Sin datos';
            c[v] = (c[v] || 0) + 1;
        });
        return c;
    }

    function countServices(db) {
        const c = {};
        db.forEach(m => {
            const s = m.areaServicio;
            if (Array.isArray(s)) s.forEach(a => c[a] = (c[a] || 0) + 1);
            else if (s) c[s] = (c[s] || 0) + 1;
        });
        return c;
    }

    function countAges(db) {
        const groups = { '0-17': 0, '18-30': 0, '31-50': 0, '51+': 0 };
        db.forEach(m => {
            const age = calcAge(m.fechaNacimiento);
            if (age < 18) groups['0-17']++;
            else if (age <= 30) groups['18-30']++;
            else if (age <= 50) groups['31-50']++;
            else groups['51+']++;
        });
        return groups;
    }

    function calcAge(d) {
        if (!d) return 0;
        const b = new Date(d), t = new Date();
        let a = t.getFullYear() - b.getFullYear();
        if (t.getMonth() < b.getMonth() ||
            (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
        return a;
    }

    function countTemperaments(db) {
        const c = {};
        db.forEach(m => {
            const t = m.psychData?.temperament || 'No determinado';
            c[t] = (c[t] || 0) + 1;
        });
        return c;
    }

    function renderRecent(db) {
        const el = document.getElementById('recentList');
        if (!el) return;
        const recent = [...db].sort((a, b) => new Date(b.fechaRegistro) - new Date(a.fechaRegistro)).slice(0, 5);
        if (recent.length === 0) { el.innerHTML = '<p style="color:var(--gray);font-size:13px;padding:10px">Sin registros aún</p>'; return; }
        el.innerHTML = recent.map(m => {
            const initials = getInitials(m.nombreCompleto || '');
            return `<div class="recent-item">
                <div class="member-avatar" style="width:32px;height:32px;font-size:11px">${initials}</div>
                <div class="recent-info">
                    <strong>${m.nombreCompleto || '—'}</strong>
                    <span>${m.sede || '—'} — ${fmtDate(m.fechaRegistro)}</span>
                </div>
            </div>`;
        }).join('');
    }

    const chartInstances = {};
    const chartColors = ['#0071e3', '#9333ea', '#34c759', '#ff9500', '#ff2d55', '#5856d6', '#00c7be', '#af52de', '#64d2ff', '#ffd60a'];
    const colors = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];

    function renderChart(id, data, chartType) {
        const el = document.getElementById(id);
        if (!el) return;
        const entries = Object.entries(data).filter(([k]) => k && k !== 'undefined' && k !== '');
        if (entries.length === 0) { el.innerHTML = '<p style="color:#86868b;font-size:13px;padding:20px 0;text-align:center">Sin datos disponibles</p>'; return; }

        if (typeof Chart !== 'undefined') {
            el.innerHTML = '<canvas></canvas>';
            const canvas = el.querySelector('canvas');
            canvas.style.maxHeight = chartType === 'horizontalBar' ? '200px' : '240px';
            if (chartInstances[id]) chartInstances[id].destroy();

            const isCircular = chartType === 'doughnut' || chartType === 'polarArea';
            const actualType = chartType === 'horizontalBar' ? 'bar' : chartType;

            const config = {
                type: actualType,
                data: {
                    labels: entries.map(e => e[0]),
                    datasets: [{
                        data: entries.map(e => e[1]),
                        backgroundColor: chartColors.slice(0, entries.length).map(c => isCircular ? c : c + 'cc'),
                        borderColor: isCircular ? '#fff' : chartColors.slice(0, entries.length),
                        borderWidth: isCircular ? 3 : 2,
                        borderRadius: isCircular ? 0 : 6,
                        hoverBackgroundColor: chartColors.slice(0, entries.length),
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 800, easing: 'easeOutQuart' },
                    plugins: {
                        legend: {
                            display: isCircular,
                            position: 'bottom',
                            labels: { font: { family: 'Inter', size: 11, weight: '500' }, padding: 14, usePointStyle: true, pointStyleWidth: 10 }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(29,29,31,0.92)',
                            titleFont: { family: 'Inter', size: 13, weight: '700' },
                            bodyFont: { family: 'Inter', size: 12 },
                            padding: 12, cornerRadius: 10,
                            displayColors: true, boxPadding: 4
                        }
                    }
                }
            };

            // Type-specific options
            if (chartType === 'horizontalBar') {
                config.options.indexAxis = 'y';
                config.options.scales = {
                    x: { display: false, grid: { display: false } },
                    y: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 12, weight: '500' }, color: '#555' } }
                };
            } else if (chartType === 'bar') {
                config.options.scales = {
                    y: { display: false, grid: { display: false } },
                    x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11, weight: '500' }, color: '#555' } }
                };
            } else if (chartType === 'doughnut') {
                config.options.cutout = '65%';
            } else if (chartType === 'polarArea') {
                config.data.datasets[0].borderWidth = 2;
                config.data.datasets[0].borderColor = chartColors.slice(0, entries.length);
            }

            chartInstances[id] = new Chart(canvas, config);
        } else {
            // Fallback CSS bars
            const max = Math.max(...entries.map(e => e[1]), 1);
            el.innerHTML = entries.map(([label, val], i) => {
                const c = colors[i % colors.length];
                return `<div class="bar-row"><span class="bar-label" title="${label}">${label}</span><div class="bar-track"><div class="bar-fill ${c}" style="width:0%">${val}</div></div><span class="bar-value">${val}</span></div>`;
            }).join('');
            requestAnimationFrame(() => {
                el.querySelectorAll('.bar-fill').forEach((b, i) => {
                    const pct = (entries[i][1] / max) * 100;
                    setTimeout(() => b.style.width = pct + '%', i * 80);
                });
            });
        }
    }

    // ===== MEMBERS TABLE =====
    function renderMembers() {
        const db = getDB();
        let filtered = [...db];

        const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
        const fC = document.getElementById('fCivil')?.value || '';
        const fB = document.getElementById('fBaptism')?.value || '';
        const fS = document.getElementById('fService')?.value || '';
        const fG = document.getElementById('fGroup')?.value || '';
        const fSe = document.getElementById('fSede')?.value || '';

        if (search) filtered = filtered.filter(m =>
            (m.nombreCompleto || '').toLowerCase().includes(search) ||
            (m.telefono || '').includes(search) ||
            (m.email || '').toLowerCase().includes(search));
        if (fC) filtered = filtered.filter(m => m.estadoCivil === fC);
        if (fB) filtered = filtered.filter(m => m.bautizadoAguas === fB);
        if (fS) filtered = filtered.filter(m => {
            const s = m.areaServicio;
            return Array.isArray(s) ? s.includes(fS) : s === fS;
        });
        if (fG) filtered = filtered.filter(m => m.grupoVida === fG);
        if (fSe) filtered = filtered.filter(m => m.sede === fSe);

        document.getElementById('membersCount').textContent =
            `Mostrando ${filtered.length} de ${db.length} miembros`;

        const tbody = document.getElementById('membersBody');
        const empty = document.getElementById('membersEmpty');

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        tbody.innerHTML = filtered.map(m => {
            const initials = getInitials(m.nombreCompleto || '');
            const photoCell = m.foto
                ? `<img class="member-photo" src="${m.foto}" alt="">`
                : `<div class="member-avatar">${initials}</div>`;
            return `<tr>
                <td>${photoCell}</td>
                <td><strong>${m.nombreCompleto || '—'}</strong></td>
                <td>${m.telefono || '—'}</td>
                <td>${m.estadoCivil || '—'}</td>
                <td><span class="pill ${m.bautizadoAguas === 'Sí' ? 'pill-yes' : 'pill-no'}">${m.bautizadoAguas || '—'}</span></td>
                <td><span class="pill ${m.grupoVida === 'Sí' ? 'pill-yes' : 'pill-no'}">${m.grupoVida || '—'}</span></td>
                <td>${m.sede || '—'}</td>
                <td><button class="btn-view" onclick="viewMember('${m.id}')"><svg width="14" height="14" style="margin-right:4px"><use href="#ic-eye"/></svg> Ver Ficha</button></td>
            </tr>`;
        }).join('');
    }

    function getInitials(name) {
        return name.split(' ').filter(w => w.length > 1).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    }

    // Filters
    ['searchInput', 'fCivil', 'fBaptism', 'fService', 'fGroup', 'fSede'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', renderMembers);
    });

    window.clearFilters = function () {
        ['searchInput', 'fCivil', 'fBaptism', 'fService', 'fGroup', 'fSede'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        renderMembers();
    };

    // ===== VIEW MEMBER DETAIL =====
    window.viewMember = function (id) {
        const db = getDB();
        const m = db.find(x => x.id === id);
        if (!m) return;

        const initials = getInitials(m.nombreCompleto || '');
        const age = calcAge(m.fechaNacimiento);
        const photoEl = m.foto
            ? `<img class="detail-avatar" src="${m.foto}" alt="">`
            : `<div class="detail-avatar-placeholder">${initials}</div>`;

        const services = Array.isArray(m.areaServicio) ? m.areaServicio.join(', ') : (m.areaServicio || '—');
        const hijos = (m.hijos || []).map(h => `${h.nombre || '?'} (${h.edad || '?'} años)`).join(', ') || 'No aplica';

        let alertHTML = '';
        if (m.psychData && (m.psychData.anxietyAlert || m.psychData.depressionAlert || m.psychData.tocAlert)) {
            const tags = [];
            if (m.psychData.anxietyAlert) tags.push(`Ansiedad (${m.psychData.anxietyCount}/5)`);
            if (m.psychData.depressionAlert) tags.push(`Depresión (${m.psychData.depressionCount}/5)`);
            if (m.psychData.tocAlert) tags.push(`TOC (${m.psychData.tocCount}/5)`);
            alertHTML = `<div class="detail-alert-box">
                <h4><svg width="16" height="16" style="vertical-align:middle;margin-right:4px"><use href="#ic-alert"/></svg> Indicadores de Atención</h4>
                <p>${tags.join(' — ')}</p>
                <p style="margin-top:6px;">Temperamento detectado: <strong>${m.psychData.temperament || 'No evaluado'}</strong></p>
            </div>`;
        }

        document.getElementById('memberDetail').innerHTML = `
            <div class="detail-header">
                ${photoEl}
                <div>
                    <h2>${m.nombreCompleto || '—'}</h2>
                    <p>${age} años — ${m.estadoCivil || '—'} — Registrado: ${fmtDate(m.fechaRegistro)}</p>
                </div>
            </div>
            <div class="detail-section">
                <h3>Datos Personales</h3>
                <div class="detail-grid">
                    <div class="detail-field"><label>Nacimiento</label><span>${fmtDate(m.fechaNacimiento)}</span></div>
                    <div class="detail-field"><label>Estado Civil</label><span>${m.estadoCivil || '—'}</span></div>
                    <div class="detail-field full"><label>Dirección</label><span>${m.direccion || '—'}</span></div>
                    <div class="detail-field"><label>Teléfono</label><span>${m.telefono || '—'}</span></div>
                    <div class="detail-field"><label>Email</label><span>${m.email || '—'}</span></div>
                </div>
            </div>
            <div class="detail-section">
                <h3>Núcleo Familiar</h3>
                <div class="detail-grid">
                    <div class="detail-field"><label>Familia en iglesia</label><span>${m.viveConFamiliaIglesia || '—'}</span></div>
                    <div class="detail-field full"><label>Hijos</label><span>${hijos}</span></div>
                </div>
            </div>
            <div class="detail-section">
                <h3>Perfil Espiritual</h3>
                <div class="detail-grid">
                    <div class="detail-field"><label>Bautizado</label><span>${m.bautizadoAguas || '—'}</span></div>
                    <div class="detail-field"><label>Tiempo en Iglesia</label><span>${m.tiempoAsistiendo || '—'}</span></div>
                    <div class="detail-field"><label>Voluntario</label><span>${m.equipoVoluntarios || '—'}</span></div>
                    <div class="detail-field"><label>Grupo Vida</label><span>${m.grupoVida || '—'}</span></div>
                    <div class="detail-field"><label>Lectura Bíblica</label><span>${m.lecturaBiblia || '—'}</span></div>
                    <div class="detail-field"><label>Ruta Crecimiento</label><span>${m.rutaCrecimiento === 'Sí' ? (m.nombreRutaCrecimiento || 'Sí') : (m.rutaCrecimiento || '—')}</span></div>
                </div>
            </div>
            <div class="detail-section">
                <h3>Servicio y Profesión</h3>
                <div class="detail-grid">
                    <div class="detail-field"><label>Profesión</label><span>${m.profesion || '—'}</span></div>
                    <div class="detail-field"><label>Situación Laboral</label><span>${m.trabajando || '—'}</span></div>
                    <div class="detail-field full"><label>Áreas de Servicio</label><span>${services}</span></div>
                    <div class="detail-field"><label>Sede</label><span>${m.sede || '—'}</span></div>
                </div>
            </div>
            <div class="detail-section">
                <h3><svg width="14" height="14" style="vertical-align:middle;margin-right:4px;color:#86868b"><use href="#ic-shield"/></svg> Salud</h3>
                <div class="detail-grid">
                    <div class="detail-field"><label>Seguro Médico</label><span>${m.tieneSeguro || '—'} ${m.nombreSeguro ? '(' + m.nombreSeguro + ')' : ''}</span></div>
                    <div class="detail-field"><label>Condición Crónica</label><span>${m.condicionSalud === 'Sí' ? (m.detalleCondicionSalud || 'Sí') : 'No'}</span></div>
                    <div class="detail-field"><label>Tipo de Sangre</label><span>${m.tipoSangre || '—'}</span></div>
                    <div class="detail-field"><label>Contacto Emergencia</label><span>${m.contactoEmergenciaNombre || '—'} ${m.contactoEmergenciaTelefono ? '(' + m.contactoEmergenciaTelefono + ')' : ''}</span></div>
                </div>
            </div>
            ${alertHTML}`;

        document.getElementById('memberModal').classList.add('active');
    };

    window.closeModal = function () {
        document.getElementById('memberModal').classList.remove('active');
    };

    document.getElementById('memberModal')?.addEventListener('click', e => {
        if (e.target === document.getElementById('memberModal')) closeModal();
    });

    // ===== NOTIFICATIONS =====
    function renderNotifications() {
        const notifs = getNotifs();
        const el = document.getElementById('notifList');
        const empty = document.getElementById('notifEmpty');
        document.getElementById('notifBadge').textContent = notifs.filter(n => !n.read).length;

        if (notifs.length === 0) {
            el.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        el.innerHTML = notifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(n => `
            <div class="notif-card ${n.important ? 'important' : ''}">
                <div class="notif-icon" style="background:${n.iconBg || '#e8f4fd'}"><svg width="20" height="20"><use href="#ic-bell"/></svg></div>
                <div class="notif-body">
                    <h4>${n.title || 'Notificación'}</h4>
                    <p>${n.message || ''}</p>
                </div>
                <span class="notif-time">${timeAgo(n.createdAt)}</span>
            </div>
        `).join('');
    }

    function timeAgo(d) {
        if (!d) return '';
        const diff = (Date.now() - new Date(d).getTime()) / 1000;
        if (diff < 60) return 'Ahora';
        if (diff < 3600) return Math.floor(diff / 60) + 'min';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h';
        return Math.floor(diff / 86400) + 'd';
    }

    // ===== PSYCH ALERTS =====
    function renderAlerts() {
        const db = getDB();
        const alerted = db.filter(m => m.psychData &&
            (m.psychData.anxietyAlert || m.psychData.depressionAlert || m.psychData.tocAlert));
        document.getElementById('alertBadge').textContent = alerted.length;
        const el = document.getElementById('alertsList');
        const empty = document.getElementById('alertsEmpty');

        if (alerted.length === 0) {
            el.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        el.innerHTML = alerted.map(m => {
            const tags = [];
            if (m.psychData.anxietyAlert) tags.push(`<span class="alert-tag anxiety">Ansiedad ${m.psychData.anxietyCount}/5</span>`);
            if (m.psychData.depressionAlert) tags.push(`<span class="alert-tag depression">Depresión ${m.psychData.depressionCount}/5</span>`);
            if (m.psychData.tocAlert) tags.push(`<span class="alert-tag toc">TOC ${m.psychData.tocCount}/5</span>`);
            return `<div class="alert-card">
                <div class="alert-card-header">
                    <h4>${m.nombreCompleto || '—'}</h4>
                    <div class="alert-tags">${tags.join('')}</div>
                </div>
                <p><svg width="14" height="14" style="vertical-align:middle;margin-right:4px"><use href="#ic-phone"/></svg> ${m.telefono || 'Sin teléfono'} — Temperamento: <strong>${m.psychData.temperament || '—'}</strong></p>
                <button class="btn-contact" onclick="viewMember('${m.id}')"><svg width="14" height="14" style="margin-right:4px"><use href="#ic-eye"/></svg> Ver Ficha Completa</button>
            </div>`;
        }).join('');
    }

    // ===== EXPORT CSV =====
    window.exportCSV = function () {
        const db = getDB();
        if (db.length === 0) { Swal.fire({ icon: 'info', title: 'Sin datos', text: 'No hay registros para exportar.', confirmButtonColor: '#0071e3' }); return; }

        const headers = ['Nombre', 'Fecha Nac.', 'Edad', 'Estado Civil', 'Dirección',
            'Teléfono', 'Email', 'Familia Iglesia', 'Hijos', 'Bautizado',
            'Tiempo Iglesia', 'Voluntario', 'Grupo Vida', 'Lectura Bíblica',
            'Profesión', 'Trabajando', 'Áreas Servicio', 'Sede', 'Ruta Crecimiento',
            'Seguro Médico', 'Condición Salud', 'Tipo Sangre',
            'Ansiedad', 'Depresión', 'TOC', 'Temperamento', 'Fecha Registro'];

        const rows = db.map(m => getRowData(m));

        let csv = '\uFEFF' + headers.join(',') + '\n';
        rows.forEach(r => {
            csv += r.map(c => `"${(c || '').toString().replace(/"/g, '""')}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `censo_vida_plena_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'CSV exportado', showConfirmButton: false, timer: 2000 });
    };

    function getRowData(m) {
        return [
            m.nombreCompleto, m.fechaNacimiento, calcAge(m.fechaNacimiento), m.estadoCivil, m.direccion,
            m.telefono, m.email, m.viveConFamiliaIglesia,
            (m.hijos || []).map(h => `${h.nombre}(${h.edad})`).join('; '),
            m.bautizadoAguas, m.tiempoAsistiendo, m.equipoVoluntarios, m.grupoVida, m.lecturaBiblia,
            m.profesion, m.trabajando,
            Array.isArray(m.areaServicio) ? m.areaServicio.join('; ') : m.areaServicio,
            m.sede, m.rutaCrecimiento === 'Sí' ? m.nombreRutaCrecimiento : 'No',
            m.tieneSeguro, m.condicionSalud === 'Sí' ? m.detalleCondicionSalud : 'No', m.tipoSangre,
            m.psychData?.anxietyCount || 0, m.psychData?.depressionCount || 0,
            m.psychData?.tocCount || 0, m.psychData?.temperament || '',
            m.fechaRegistro
        ];
    }

    // ===== EXCEL EXPORT (SheetJS) =====
    window.exportExcel = function () {
        const db = getDB();
        if (db.length === 0) { Swal.fire({ icon: 'info', title: 'Sin datos', text: 'No hay registros para exportar.', confirmButtonColor: '#0071e3' }); return; }
        const headers = ['Nombre', 'Edad', 'Estado Civil', 'Teléfono', 'Email', 'Bautizado', 'Grupo Vida', 'Sede', 'Profesión', 'Temperamento'];
        const data = db.map(m => [m.nombreCompleto, calcAge(m.fechaNacimiento), m.estadoCivil, m.telefono, m.email, m.bautizadoAguas, m.grupoVida, m.sede, m.profesion, m.psychData?.temperament || '']);
        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Censo');
        XLSX.writeFile(wb, `censo_vida_plena_${new Date().toISOString().split('T')[0]}.xlsx`);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Excel exportado', showConfirmButton: false, timer: 2000 });
    };

    // ===== PDF EXPORT (jsPDF) =====
    window.exportPDF = function () {
        const db = getDB();
        if (db.length === 0) { Swal.fire({ icon: 'info', title: 'Sin datos', text: 'No hay registros para exportar.', confirmButtonColor: '#0071e3' }); return; }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('Censo de Membresía - Vida Plena', 14, 20);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generado: ${new Date().toLocaleDateString('es-ES')} | Total: ${db.length} miembros`, 14, 28);

        const headers = ['Nombre', 'Edad', 'Estado Civil', 'Teléfono', 'Bautizado', 'Grupo Vida', 'Sede', 'Temperamento'];
        const body = db.map(m => [m.nombreCompleto, calcAge(m.fechaNacimiento), m.estadoCivil, m.telefono, m.bautizadoAguas, m.grupoVida, m.sede, m.psychData?.temperament || '']);

        doc.autoTable({
            head: [headers], body: body, startY: 34,
            styles: { font: 'helvetica', fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [0, 113, 227], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 247, 250] },
        });

        doc.save(`censo_vida_plena_${new Date().toISOString().split('T')[0]}.pdf`);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'PDF exportado', showConfirmButton: false, timer: 2000 });
    };

    // ===== SCREENSHOT (html2canvas) =====
    window.captureScreenshot = function () {
        const section = document.getElementById('section-dashboard');
        if (!section) return;
        Swal.fire({ title: 'Capturando...', text: 'Generando imagen del dashboard', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        html2canvas(section, { backgroundColor: '#f5f5f7', scale: 2 }).then(canvas => {
            const link = document.createElement('a');
            link.download = `dashboard_vida_plena_${new Date().toISOString().split('T')[0]}.png`;
            link.href = canvas.toDataURL();
            link.click();
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Captura guardada', showConfirmButton: false, timer: 2000 });
        });
    };

    // ===== QR CODE =====
    window.generateQR = function () {
        const url = document.getElementById('qrUrl').value.trim();
        if (!url) { Swal.fire({ icon: 'warning', title: 'URL requerida', text: 'Ingresa la URL de tu formulario de registro.', confirmButtonColor: '#0071e3' }); return; }
        const output = document.getElementById('qrOutput');
        output.innerHTML = '<canvas id="qrCanvas"></canvas><p style="font-size:12px;color:var(--gray);margin-top:8px">Escanea con la cámara del celular</p>';
        QRCode.toCanvas(document.getElementById('qrCanvas'), url, { width: 200, margin: 2, color: { dark: '#1d1d1f', light: '#ffffff' } });
    };

    // ===== SETTINGS =====
    window.saveCredentials = function (e) {
        e.preventDefault();
        const user = document.getElementById('newUser').value.trim();
        const pass = document.getElementById('newPass').value;
        const conf = document.getElementById('confirmPass').value;

        if (!user || !pass) { Swal.fire({ icon: 'warning', title: 'Campos incompletos', text: 'Completa usuario y contraseña.', confirmButtonColor: '#0071e3' }); return; }
        if (pass !== conf) { Swal.fire({ icon: 'error', title: 'Error', text: 'Las contraseñas no coinciden.', confirmButtonColor: '#0071e3' }); return; }

        localStorage.setItem('adminCredentials', JSON.stringify({ username: user, password: pass }));
        Swal.fire({ icon: 'success', title: 'Credenciales actualizadas', text: 'Los nuevos datos de acceso han sido guardados.', confirmButtonColor: '#0071e3' });
        document.getElementById('credForm').reset();
    };

    window.clearAllData = function () {
        Swal.fire({
            title: '¿Eliminar todos los datos?',
            text: 'Esta acción eliminará TODOS los registros del censo permanentemente.',
            icon: 'warning', showCancelButton: true,
            confirmButtonColor: '#ff2d55', cancelButtonColor: '#86868b',
            confirmButtonText: 'Sí, eliminar todo', cancelButtonText: 'Cancelar'
        }).then(result => {
            if (result.isConfirmed) {
                localStorage.removeItem('censoVidaPlenaDB');
                localStorage.removeItem('vidaPlenaNotifs');
                Swal.fire({ icon: 'success', title: 'Datos eliminados', text: 'Todos los registros han sido borrados.', confirmButtonColor: '#0071e3' });
                renderDashboard();
                renderMembers();
                renderNotifications();
                renderAlerts();
            }
        });
    };

    // ===== UTILS =====
    function fmtDate(d) {
        if (!d) return '—';
        const date = new Date(d);
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    // ===== INIT =====
    renderDashboard();
    renderMembers();
    renderNotifications();
    renderAlerts();
})();

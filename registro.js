(function(){
'use strict';
const TOTAL_STEPS = 6;
let currentStep = 1;
let photoData = null;

// DOM
const form = document.getElementById('censoForm');
const btnNext = document.getElementById('btnNext');
const btnBack = document.getElementById('btnBack');
const progressFill = document.getElementById('progressFill');
const stepLabel = document.getElementById('stepLabel');
const formNav = document.getElementById('formNav');

// ===== STEP NAVIGATION =====
function showStep(n) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    const target = n > TOTAL_STEPS ? document.getElementById('step-done') : document.getElementById('step-' + n);
    if (target) target.classList.add('active');

    if (n > TOTAL_STEPS) {
        formNav.style.display = 'none';
        return;
    }
    
    // Privacy logic
    if (n === 1 && !window.privacyAccepted) {
        formNav.style.display = 'none';
    } else {
        formNav.style.display = 'flex';
    }

    btnBack.style.visibility = n === 1 ? 'hidden' : 'visible';
    btnNext.textContent = '';
    if (n === TOTAL_STEPS) {
        btnNext.innerHTML = 'Enviar Registro <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
        btnNext.classList.add('submit');
    } else {
        btnNext.innerHTML = 'Siguiente <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
        btnNext.classList.remove('submit');
    }
    progressFill.style.width = ((n / TOTAL_STEPS) * 100) + '%';
    stepLabel.textContent = 'Paso ' + n + ' de ' + TOTAL_STEPS;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('btnAcceptPrivacy')?.addEventListener('click', () => {
    window.privacyAccepted = true;
    document.body.style.overflow = '';
    const modal = document.getElementById('privacyModal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.remove();
        formNav.style.display = 'flex';
        formNav.classList.add('animate-fade-in');
    }, 500);
});

// Initialize Privacy Modal
window.addEventListener('DOMContentLoaded', () => {
    window.privacyAccepted = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
        const modal = document.getElementById('privacyModal');
        if(modal) {
            modal.classList.add('active');
        }
    }, 100);
});

btnNext.addEventListener('click', () => {
    if (!validateStep(currentStep)) {
        Swal.fire({ toast: true, position: 'top', icon: 'warning', title: 'Completa los campos requeridos', showConfirmButton: false, timer: 2500, timerProgressBar: true, customClass: { popup: 'swal-toast' } });
        return;
    }
    if (currentStep === TOTAL_STEPS) { submitForm(); return; }
    currentStep++;
    showStep(currentStep);
});

btnBack.addEventListener('click', () => {
    if (currentStep > 1) { currentStep--; showStep(currentStep); }
});

// ===== VALIDATION =====
function validateStep(n) {
    clearErrors();
    let valid = true;
    if (n === 1) {
        valid = reqField('nombreCompleto') & reqField('fechaNacimiento') & reqField('estadoCivil') & reqField('direccion') & reqField('telefono');
    }
    if (n === 2) {
        valid = reqRadio('familiaIglesia');
    }
    if (n === 3) {
        valid = reqRadio('bautizado') & reqField('tiempoAsistiendo') & reqRadio('voluntario') & reqRadio('grupoVida');
    }
    if (n === 4) {
        valid = reqField('profesion') & reqRadio('trabajando') & reqField('sede');
    }
    return valid;
}

function reqField(id) {
    const el = document.getElementById(id);
    if (!el || !el.value.trim()) { el && el.classList.add('field-error'); shakeEl(el); return false; }
    return true;
}

function reqRadio(name) {
    const checked = document.querySelector('input[name="'+name+'"]:checked');
    if (!checked) {
        const group = document.querySelector('input[name="'+name+'"]');
        if (group) shakeEl(group.closest('.radio-group'));
        return false;
    }
    return true;
}

function clearErrors() {
    document.querySelectorAll('.field-error').forEach(e => e.classList.remove('field-error'));
}

function shakeEl(el) {
    if (!el) return;
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'shake 0.4s ease';
    setTimeout(() => el.style.animation = '', 500);
}

// ===== PHOTO UPLOAD =====
document.getElementById('photoInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
        Swal.fire({ icon: 'error', title: 'Archivo muy grande', text: 'La imagen no debe superar 2MB.', confirmButtonColor: '#0071e3' });
        return;
    }
    const reader = new FileReader();
    reader.onload = function(ev) {
        photoData = ev.target.result;
        document.getElementById('photoPreview').innerHTML = '<img src="'+photoData+'" alt="Foto">';
    };
    reader.readAsDataURL(file);
});

// ===== AGE CALC =====
document.getElementById('fechaNacimiento').addEventListener('change', function() {
    const d = new Date(this.value);
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    if (today.getMonth() < d.getMonth() || (today.getMonth() === d.getMonth() && today.getDate() < d.getDate())) age--;
    document.getElementById('ageDisplay').textContent = age > 0 ? age + ' años' : '';
});

// ===== CHILDREN (HIJOS) =====
document.getElementById('addHijo').addEventListener('click', function() {
    const container = document.getElementById('hijosContainer');
    const row = document.createElement('div');
    row.className = 'hijo-row';
    row.innerHTML = '<input type="text" placeholder="Nombre del hijo" class="hijo-nombre"><input type="number" placeholder="Edad" class="hijo-edad" style="max-width:80px" min="0" max="99"><button type="button" class="btn-remove" onclick="this.parentElement.remove()">×</button>';
    container.appendChild(row);
});

// ===== CONDITIONAL FIELDS =====
document.querySelectorAll('input[name="rutaCrecimiento"]').forEach(r => {
    r.addEventListener('change', () => {
        document.getElementById('rutaDetalleWrap').style.display = r.value === 'Sí' && r.checked ? 'flex' : 'none';
        document.getElementById('rutaDeseoWrap').style.display = r.value === 'No' && r.checked ? 'flex' : 'none';
    });
});

document.querySelectorAll('input[name="grupoVida"]').forEach(r => {
    r.addEventListener('change', () => {
        document.getElementById('gvDeseoWrap').style.display = r.value === 'No' && r.checked ? 'flex' : 'none';
    });
});

document.getElementById('seguroSi')?.addEventListener('change', function() {
    document.getElementById('seguroNombreWrap').style.display = this.checked ? 'flex' : 'none';
});
document.querySelector('input[name="seguro"][value="No"]')?.addEventListener('change', function() {
    if (this.checked) document.getElementById('seguroNombreWrap').style.display = 'none';
});

document.getElementById('condicionSi')?.addEventListener('change', function() {
    document.getElementById('condicionDetalleWrap').style.display = this.checked ? 'flex' : 'none';
});
document.querySelector('input[name="condicion"][value="No"]')?.addEventListener('change', function() {
    if (this.checked) document.getElementById('condicionDetalleWrap').style.display = 'none';
});

// ===== PERSISTENCE (SAVE ON REFRESH) =====
function saveDraft() {
    const data = {};
    const inputs = document.querySelectorAll('input:not([type="file"]), select, textarea');
    inputs.forEach(el => {
        if (el.type === 'radio' || el.type === 'checkbox') {
            if (el.checked) data[el.name] = (data[el.name] || []).concat(el.value);
        } else {
            data[el.id] = el.value;
        }
    });
    data.currentStep = currentStep;
    localStorage.setItem('census_draft', JSON.stringify(data));
}

function loadDraft() {
    const raw = localStorage.getItem('census_draft');
    if (!raw) return;
    try {
        const data = JSON.parse(raw);
        Object.keys(data).forEach(key => {
            const el = document.getElementById(key);
            if (el) {
                el.value = data[key];
                // Trigger change for age calc etc
                el.dispatchEvent(new Event('change'));
            } else {
                // Radios or checkboxes
                const radios = document.querySelectorAll(`input[name="${key}"]`);
                radios.forEach(r => {
                    if (Array.isArray(data[key])) {
                        if (data[key].includes(r.value)) r.checked = true;
                    } else {
                        if (r.value === data[key]) r.checked = true;
                    }
                    r.dispatchEvent(new Event('change'));
                });
            }
        });
        if (data.currentStep) {
            currentStep = data.currentStep;
            showStep(currentStep);
        }
    } catch(e) { console.error("Error loading draft", e); }
}

// Auto-save on every input
document.addEventListener('input', (e) => {
    if (e.target.closest('#censoForm')) saveDraft();
});
document.addEventListener('change', (e) => {
    if (e.target.closest('#censoForm')) saveDraft();
});

// ===== SUBMIT =====
function submitForm() {
    const val = id => (document.getElementById(id)?.value || '').trim();
    const radio = name => (document.querySelector('input[name="'+name+'"]:checked')?.value || '');

    // Gather children
    const hijos = [];
    document.querySelectorAll('.hijo-row').forEach(row => {
        const nombre = row.querySelector('.hijo-nombre')?.value?.trim();
        const edad = row.querySelector('.hijo-edad')?.value?.trim();
        if (nombre) hijos.push({ nombre, edad: edad || '?' });
    });

    // Gather services and routes
    const areaServicio = [];
    document.querySelectorAll('#servicioGrid input:checked').forEach(c => areaServicio.push(c.value));
    
    const pasosRuta = [];
    document.querySelectorAll('#rutaGrid input:checked').forEach(c => pasosRuta.push(c.value));

    const areasApoyo = [];
    document.querySelectorAll('#apoyoGrid input:checked').forEach(c => areasApoyo.push(c.value));

    // Psych data
    const anxietyCount = document.querySelectorAll('[data-cat="anxiety"]:checked').length;
    const depressionCount = document.querySelectorAll('[data-cat="depression"]:checked').length;
    const spiritualCount = document.querySelectorAll('[data-cat="spiritual"]:checked').length;

    // Temperament algorithm
    const tScores = { S: 0, C: 0, M: 0, F: 0 };
    ['tq1', 'tq2', 'tq3', 'tq4'].forEach(name => {
        const sel = document.querySelector('input[name="'+name+'"]:checked');
        if (sel) tScores[sel.value]++;
    });
    const tMap = { S: 'Sanguíneo', C: 'Colérico', M: 'Melancólico', F: 'Flemático' };
    const topT = Object.entries(tScores).sort((a, b) => b[1] - a[1])[0];
    const temperament = topT[1] > 0 ? tMap[topT[0]] : 'No determinado';

    const member = {
        id: 'M' + Date.now() + Math.random().toString(36).substr(2, 5),
        foto: photoData,
        nombreCompleto: val('nombreCompleto'),
        fechaNacimiento: val('fechaNacimiento'),
        estadoCivil: val('estadoCivil'),
        direccion: val('direccion'),
        telefono: val('telefono'),
        email: val('email'),
        viveConFamiliaIglesia: radio('familiaIglesia'),
        hijos: hijos,
        bautizadoAguas: radio('bautizado'),
        tiempoAsistiendo: val('tiempoAsistiendo'),
        equipoVoluntarios: radio('voluntario'),
        grupoVida: radio('grupoVida'),
        deseaGrupoVida: radio('deseaGrupoVida'),
        lecturaBiblia: val('lecturaBiblia'),
        rutaCrecimiento: radio('rutaCrecimiento'),
        deseaRuta: radio('deseaRuta'),
        nombreRutaCrecimiento: pasosRuta.join(', '),
        profesion: val('profesion'),
        trabajando: radio('trabajando'),
        areaServicio: areaServicio,
        sede: val('sede'),
        tieneSeguro: radio('seguro'),
        nombreSeguro: val('nombreSeguro'),
        condicionSalud: radio('condicion'),
        detalleCondicionSalud: val('detalleCondicion'),
        tipoSangre: val('tipoSangre'),
        contactoEmergenciaNombre: val('contactoNombre'),
        contactoEmergenciaTelefono: val('contactoTelefono'),
        psychData: {
            anxietyCount, depressionCount, spiritualCount,
            anxietyAlert: anxietyCount >= 2,
            depressionAlert: depressionCount >= 2,
            spiritualAlert: spiritualCount >= 3,
            temperament: temperament,
            crecimientoEspiritual: radio('crecimientoEspiritual'),
            areasApoyo: areasApoyo,
            necesidadOracion: val('necesidadOracion')
        },
        fechaRegistro: new Date().toISOString()
    };

    // Show loading
    Swal.fire({
        title: 'Guardando registro...',
        text: 'Por favor no cierres esta ventana',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    // Save to Firebase
    dbFirestore.collection('miembros').doc(member.id).set(member).then(() => {
        // Clear draft
        localStorage.removeItem('census_draft');

        // Save local backup
        const db = JSON.parse(localStorage.getItem('censoVidaPlenaDB')) || [];
        db.push(member);
        localStorage.setItem('censoVidaPlenaDB', JSON.stringify(db));

        // Add notification for admin
        const notifs = JSON.parse(localStorage.getItem('vidaPlenaNotifs')) || [];
        notifs.push({
            title: 'Nuevo registro',
            message: member.nombreCompleto + ' completó el censo.',
            createdAt: new Date().toISOString(),
            important: member.psychData.anxietyAlert || member.psychData.depressionAlert || member.psychData.spiritualAlert,
            read: false
        });
        localStorage.setItem('vidaPlenaNotifs', JSON.stringify(notifs));

        Swal.close();
        
        // Show success screen
        currentStep = TOTAL_STEPS + 1;
        showStep(currentStep);

        if (typeof lottie !== 'undefined') {
            lottie.loadAnimation({
                container: document.getElementById('lottieSuccess'),
                renderer: 'svg', loop: false, autoplay: true,
                path: 'https://assets2.lottiefiles.com/packages/lf20_jbrw3hcz.json'
            });
        }
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: '¡Registro guardado exitosamente!', showConfirmButton: false, timer: 3000, timerProgressBar: true });
    }).catch(error => {
        console.error("Firebase error: ", error);
        Swal.fire({ 
            icon: 'error', 
            title: 'Error de guardado', 
            text: 'Hubo un problema al conectar con el servidor. Verifica tu internet e intenta de nuevo.', 
            footer: 'Error técnico: ' + (error.code || error.message),
            confirmButtonColor: '#3b82f6' 
        });
    });
}

// ===== SHAKE ANIMATION =====
const style = document.createElement('style');
style.textContent = '@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}';
document.head.appendChild(style);

// ===== INIT =====
window.addEventListener('load', () => {
    loadDraft();
    if (!localStorage.getItem('census_draft')) showStep(1);
});

})();

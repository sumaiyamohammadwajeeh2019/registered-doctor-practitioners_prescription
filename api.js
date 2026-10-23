const API_BASE = 'http://127.0.0.1:8000';
let apiConnected = false;
let rxNo = 1;

async function apiCall(endpoint, options = {}) {
  try {
    const res = await fetch(API_BASE + endpoint, {
      headers: {'Content-Type': 'application/json'},
      ...options
    });
    if (!apiConnected) { apiConnected = true; updateConnStatus(true); }
    return await res.json();
  } catch(e) {
    if (apiConnected) { apiConnected = false; updateConnStatus(false); }
    throw e;
  }
}

function updateConnStatus(connected) {
  const el = document.getElementById('connStatus');
  if(el) {
    el.innerHTML = connected ? '<span style="color:var(--success)">&#9679; Connected</span>' : '<span style="color:var(--danger)">&#9679; Offline</span>';
  }
}

async function loadRxCounter(){
  try {
    const r = await apiCall('/api/rx-counter');
    rxNo = (r.counter || 0) + 1;
  } catch(e) {
    rxNo = parseInt(localStorage.getItem('rxpro_rxno') || '0') + 1;
  }
  document.getElementById('rxNo').textContent = rxNo.toString().padStart(5, '0');
  document.getElementById('rxDate').textContent = new Date().toLocaleDateString();
}

async function loadSettings(){
  try {
    window.settings = await apiCall('/api/settings');
    applySettings();
  } catch(e) {
    window.settings = JSON.parse(localStorage.getItem('rxpro_settings') || '{}');
    applySettings();
  }
}


let db = [];

async function loadRxList(){
  try {
    db = await apiCall('/api/prescriptions');
    renderHistory();
  } catch(e) {
    db = JSON.parse(localStorage.getItem('rxpro_db') || '[]');
    renderHistory();
  }
}

function renderHistory(){
  let s = document.getElementById('search').value.toLowerCase();
  let f = db.filter(x => (x.name + ' ' + (x.mobile||'') + ' #'+(x.rxNo||'')).toLowerCase().includes(s));
  document.getElementById('count').innerText = db.length;
  let h = '';
  for(let i = 0; i < f.length; i++){
    let x = f[i];
    h += '<div class="history-item"><div><b>#'+x.rxNo+' '+x.name+'</b><br><span style="font-size:10px;color:var(--gray)">'+x.date+' • '+x.mobile+' • BMI: '+(x.exBmi||'-')+'</span></div><div class="history-actions"><button class="bt" onclick="loadRx('+x.id+')" style="padding:3px 8px;font-size:10px">Load</button> <button class="bt bd" onclick="deleteRx('+x.id+')" style="padding:3px 8px;font-size:10px">Del</button></div></div>';
  }
  document.getElementById('historyList').innerHTML = h || '<div style="font-size:11px;color:var(--gray);padding:8px">No records yet.</div>';
}


async function saveRx(){
  let name = document.getElementById('pName').value;
  if(!name){ showToast('Patient name is required'); document.getElementById('pName').focus(); return; }

  const meds = [];
  document.querySelectorAll('#medTable tr').forEach((row, idx) => {
    if(idx === 0) return;
    const inputs = row.querySelectorAll('input');
    if(inputs[0].value.trim()){
      meds.push({
        med: inputs[0].value,
        generic: inputs[1].value,
        dose: inputs[2].value,
        days: inputs[3].value,
        refills: inputs[4].value,
        advice: inputs[5].value
      });
    }
  });

  const d = {
    name: name,
    dob: document.getElementById('pDob').value,
    age: document.getElementById('pAge').value,
    sex: document.getElementById('pSex').value,
    date: document.getElementById('pDate').value || new Date().toLocaleDateString(),
    mobile: document.getElementById('pId').value,
    address: document.getElementById('pAddr').value,
    pastIll: document.getElementById('pastIll').value,
    pastSurg: document.getElementById('pastSurg').value,
    drugAll: document.getElementById('drugAll').value,
    hCurrentMed: document.getElementById('hCurrentMed').value,
    hHTN: document.getElementById('hHTN').value,
    hDM: document.getElementById('hDM').value,
    hSmoke: document.getElementById('hSmoke').value,
    hFamily: document.getElementById('hFamily').value,
    exBP: document.getElementById('exBP').value,
    exPulse: document.getElementById('exPulse').value,
    exTemp: document.getElementById('exTemp').value,
    exSpo2: document.getElementById('exSpo2').value,
    exWt: document.getElementById('exWt').value,
    exHtCm: document.getElementById('exHtCm').value,
    exHt: document.getElementById('exHt').value,
    exRbs: document.getElementById('exRbs').value,
    exBmi: document.getElementById('exBmi').value,
    spCVS: document.getElementById('spCVS').value,
    spChest: document.getElementById('spChest').value,
    spAbd: document.getElementById('spAbd').value,
    spCNS: document.getElementById('spCNS').value,
    pCC: document.getElementById('pCC').value,
    pDiag: document.getElementById('pDiag').value,
    meds: meds,
    pTests: document.getElementById('pTests').value,
    pAdvice: document.getElementById('pAdvice').value,
    pNext: document.getElementById('pNext').value
  };

  try {
    const result = await apiCall('/api/prescriptions', {
      method: 'POST',
      body: JSON.stringify(d)
    });
    rxNo = parseInt(result.rxNo) + 1;
    document.getElementById('rxNo').textContent = rxNo.toString().padStart(5, '0');
    await loadRxList();
    genQR();
    showToast('Prescription saved #' + result.rxNo);
  } catch(e) {
    let ldb = JSON.parse(localStorage.getItem('rxpro_db') || '[]');
    d.rxNo = rxNo;
    d.id = Date.now();
    d.savedAt = new Date().toISOString();
    ldb.unshift(d);
    localStorage.setItem('rxpro_db', JSON.stringify(ldb));
    rxNo++;
    document.getElementById('rxNo').textContent = rxNo.toString().padStart(5, '0');
    localStorage.setItem('rxpro_rxno', rxNo.toString());
    db = ldb;
    renderHistory();
    genQR();
    showToast('Saved locally (backend offline) #' + d.rxNo);
  }
}


async function loadRx(id){
  let d;
  try {
    d = await apiCall('/api/prescriptions/' + id);
  } catch(e) {
    d = JSON.parse(localStorage.getItem('rxpro_db') || '[]').find(x => x.id === id);
    if(!d) return;
  }

  document.getElementById('pName').value = d.name;
  document.getElementById('pDob').value = d.dob || '';
  document.getElementById('pAge').value = d.age || '';
  document.getElementById('pSex').value = d.sex || 'Male';
  document.getElementById('pDate').value = d.date || '';
  document.getElementById('pId').value = d.mobile || '';
  document.getElementById('pAddr').value = d.address || '';
  document.getElementById('pastIll').value = d.pastIll || '';
  document.getElementById('pastSurg').value = d.pastSurg || '';
  document.getElementById('drugAll').value = d.drugAll || '';
  document.getElementById('hCurrentMed').value = d.hCurrentMed || '';
  document.getElementById('hHTN').value = d.hHTN || 'No';
  document.getElementById('hDM').value = d.hDM || 'No';
  document.getElementById('hSmoke').value = d.hSmoke || 'No';
  document.getElementById('hFamily').value = d.hFamily || '';
  document.getElementById('exBP').value = d.exBP || '';
  document.getElementById('exPulse').value = d.exPulse || '';
  document.getElementById('exTemp').value = d.exTemp || '';
  document.getElementById('exSpo2').value = d.exSpo2 || '';
  document.getElementById('exWt').value = d.exWt || '';
  document.getElementById('exHtCm').value = d.exHtCm || '';
  document.getElementById('exHt').value = d.exHt || '';
  document.getElementById('exRbs').value = d.exRbs || '';
  document.getElementById('exBmi').value = d.exBmi || '';
  document.getElementById('bmiDisplay').textContent = d.exBmi || '--';
  document.getElementById('spCVS').value = d.spCVS || '';
  document.getElementById('spChest').value = d.spChest || '';
  document.getElementById('spAbd').value = d.spAbd || '';
  document.getElementById('spCNS').value = d.spCNS || '';
  document.getElementById('pCC').value = d.pCC || '';
  document.getElementById('pDiag').value = d.pDiag || '';
  document.getElementById('pTests').value = d.pTests || '';
  document.getElementById('pAdvice').value = d.pAdvice || '';
  document.getElementById('pNext').value = d.pNext || '';

  const medTable = document.getElementById('medTable');
  while(medTable.rows.length > 1) medTable.deleteRow(1);
  if(d.meds && d.meds.length){
    d.meds.forEach(m => {
      let r = medTable.insertRow(-1);
      r.innerHTML = '<td><input list="meds" value="'+(m.med||'')+'" oninput="checkMedAllergy(this); autoFillGeneric(this)"></td>' +
        '<td><input value="'+(m.generic||'')+'" readonly></td>' +
        '<td><input value="'+(m.dose||'')+'"></td>' +
        '<td><input value="'+(m.days||'')+'"></td>' +
        '<td><input value="'+(m.refills||'')+'"></td>' +
        '<td><input value="'+(m.advice||'')+'"></td>' +
        '<td><button class="bt bd" style="padding:4px 8px" onclick="removeRow(this)">&#215;</button></td>';
    });
  }
  checkAllergies();
  calcBMI();
  genQR();
  showToast('Loaded prescription #' + d.rxNo);
}

async function deleteRx(id){
  if(!confirm('Delete this prescription record?')) return;
  try {
    await apiCall('/api/prescriptions/' + id, { method: 'DELETE' });
  } catch(e) {
    db = db.filter(x => x.id !== id);
    localStorage.setItem('rxpro_db', JSON.stringify(db));
  }
  await loadRxList();
  showToast('Deleted');
}


async function saveSettings(){
  settings = {
    clinicName: document.getElementById('sClinicName').value,
    doctorName: document.getElementById('sDoctorName').value,
    regNo: document.getElementById('sRegNo').value,
    phone: document.getElementById('sPhone').value,
    email: document.getElementById('sEmail').value,
    address: document.getElementById('sAddress').value,
    signature: document.getElementById('sSignature').value,
    logo: document.getElementById('logoPreview').src || ''
  };
  try {
    await apiCall('/api/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
    localStorage.setItem('rxpro_settings', JSON.stringify(settings));
  } catch(e) {
    localStorage.setItem('rxpro_settings', JSON.stringify(settings));
    showToast('Saved locally (backend offline)');
  }
  applySettings();
  closeSettings();
  showToast('Clinic profile saved');
}
function openSettings(){
  document.getElementById('sClinicName').value = settings.clinicName || '';
  document.getElementById('sDoctorName').value = settings.doctorName || '';
  document.getElementById('sRegNo').value = settings.regNo || '';
  document.getElementById('sPhone').value = settings.phone || '';
  document.getElementById('sEmail').value = settings.email || '';
  document.getElementById('sAddress').value = settings.address || '';
  document.getElementById('sSignature').value = settings.signature || '';
  const prev = document.getElementById('logoPreview');
  prev.src = settings.logo || '';
  prev.className = settings.logo ? 'img-preview' : 'img-preview hidden';
  document.getElementById('settingsModal').classList.remove('hidden');
}
function closeSettings(){ document.getElementById('settingsModal').classList.add('hidden'); }
function previewLogo(input){
  if(input.files && input.files[0]){
    const reader = new FileReader();
    reader.onload = function(e){
      document.getElementById('logoPreview').src = e.target.result;
      document.getElementById('logoPreview').className = 'img-preview';
    };
    reader.readAsDataURL(input.files[0]);
  }
}
function applySettings(){
  document.getElementById('rxClinicName').textContent = settings.clinicName || 'Your Clinic Name';
  const parts = [settings.address, settings.phone, settings.email].filter(Boolean);
  document.getElementById('rxClinicAddr').textContent = parts.join(' • ');
  document.getElementById('rxClinicReg').textContent = 'Reg. No.: ' + (settings.regNo || '______');
  const sigEl = document.getElementById('rxSigName');
  sigEl.textContent = settings.signature || settings.doctorName || 'Doctor Name';
  const sigParent = sigEl.parentElement;
  if(sigParent){
    const regDiv = sigParent.querySelector('div:nth-child(2)');
    if(regDiv) regDiv.textContent = 'Reg: ' + (settings.regNo || '______');
  }
  const logoImg = document.getElementById('rxLogo');
  if(settings.logo){
    logoImg.src = settings.logo;
    logoImg.style.display = 'block';
  }
  document.title = (settings.clinicName || 'RxPro') + ' - Prescription System';
}
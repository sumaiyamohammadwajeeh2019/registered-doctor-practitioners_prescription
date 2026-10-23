from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import json
import os
from datetime import datetime

app = Flask(__name__, static_folder='.')

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    return response

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rxpro.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS prescriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rx_no TEXT,
        name TEXT,
        dob TEXT,
        age TEXT,
        sex TEXT,
        date TEXT,
        mobile TEXT,
        address TEXT,
        past_ill TEXT,
        past_surg TEXT,
        drug_all TEXT,
        h_current_med TEXT,
        h_htn TEXT,
        h_dm TEXT,
        h_smoke TEXT,
        h_family TEXT,
        ex_bp TEXT,
        ex_pulse TEXT,
        ex_temp TEXT,
        ex_spo2 TEXT,
        ex_wt TEXT,
        ex_ht_cm TEXT,
        ex_ht TEXT,
        ex_rbs TEXT,
        ex_bmi TEXT,
        sp_cvs TEXT,
        sp_chest TEXT,
        sp_abd TEXT,
        sp_cns TEXT,
        p_cc TEXT,
        p_diag TEXT,
        meds TEXT,
        p_tests TEXT,
        p_advice TEXT,
        p_next TEXT,
        saved_at TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS clinic_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        clinic_name TEXT,
        doctor_name TEXT,
        reg_no TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        signature TEXT,
        logo TEXT,
        updated_at TEXT
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS rx_counter (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        counter INTEGER
    )''')
    c.execute('INSERT OR IGNORE INTO rx_counter (id, counter) VALUES (1, 0)')
    c.execute('INSERT OR IGNORE INTO clinic_settings (id, clinic_name, doctor_name, reg_no, phone, email, address, signature, logo, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              (1, '', '', '', '', '', '', '', '', datetime.now().isoformat()))
    conn.commit()
    conn.close()

init_db()


@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


@app.route('/<path:path>')
def static_file(path):
    return send_from_directory('.', path)


# ---- Prescription CRUD ----

@app.route('/api/prescriptions', methods=['GET'])
def get_prescriptions():
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT * FROM prescriptions ORDER BY saved_at DESC')
    rows = c.fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d['meds'] = json.loads(d['meds']) if d['meds'] else []
        result.append(d)
    return jsonify(result)


@app.route('/api/prescriptions', methods=['POST'])
def save_prescription():
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT counter FROM rx_counter WHERE id = 1')
    row = c.fetchone()
    counter = row['counter'] + 1
    rx_no = f"{counter:05d}"
    c.execute('UPDATE rx_counter SET counter = ? WHERE id = 1', (counter,))
    c.execute('''INSERT INTO prescriptions
        (rx_no, name, dob, age, sex, date, mobile, address,
         past_ill, past_surg, drug_all, h_current_med, h_htn, h_dm, h_smoke, h_family,
         ex_bp, ex_pulse, ex_temp, ex_spo2, ex_wt, ex_ht_cm, ex_ht, ex_rbs, ex_bmi,
         sp_cvs, sp_chest, sp_abd, sp_cns, p_cc, p_diag, meds, p_tests, p_advice, p_next, saved_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (rx_no,
         data.get('name', ''),
         data.get('dob', ''),
         data.get('age', ''),
         data.get('sex', ''),
         data.get('date', ''),
         data.get('mobile', ''),
         data.get('address', ''),
         data.get('pastIll', ''),
         data.get('pastSurg', ''),
         data.get('drugAll', ''),
         data.get('hCurrentMed', ''),
         data.get('hHTN', ''),
         data.get('hDM', ''),
         data.get('hSmoke', ''),
         data.get('hFamily', ''),
         data.get('exBP', ''),
         data.get('exPulse', ''),
         data.get('exTemp', ''),
         data.get('exSpo2', ''),
         data.get('exWt', ''),
         data.get('exHtCm', ''),
         data.get('exHt', ''),
         data.get('exRbs', ''),
         data.get('exBmi', ''),
         data.get('spCVS', ''),
         data.get('spChest', ''),
         data.get('spAbd', ''),
         data.get('spCNS', ''),
         data.get('pCC', ''),
         data.get('pDiag', ''),
         json.dumps(data.get('meds', [])),
         data.get('pTests', ''),
         data.get('pAdvice', ''),
         data.get('pNext', ''),
         datetime.now().isoformat()))
    new_id = c.lastrowid
    conn.commit()
    conn.close()
    return jsonify({'id': new_id, 'rxNo': rx_no, 'success': True})


# ---- Clinic Settings ----

@app.route('/api/settings', methods=['GET'])
def get_settings():
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT * FROM clinic_settings WHERE id = 1')
    row = c.fetchone()
    conn.close()
    if not row:
        return jsonify({})
    d = dict(row)
    return jsonify({
        'clinicName': d.get('clinic_name', ''),
        'doctorName': d.get('doctor_name', ''),
        'regNo': d.get('reg_no', ''),
        'phone': d.get('phone', ''),
        'email': d.get('email', ''),
        'address': d.get('address', ''),
        'signature': d.get('signature', ''),
        'logo': d.get('logo', '')
    })


@app.route('/api/settings', methods=['POST'])
def save_settings():
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute('''UPDATE clinic_settings SET
        clinic_name=?, doctor_name=?, reg_no=?, phone=?, email=?, address=?, signature=?, logo=?, updated_at=?
        WHERE id=1''',
        (data.get('clinicName', ''),
         data.get('doctorName', ''),
         data.get('regNo', ''),
         data.get('phone', ''),
         data.get('email', ''),
         data.get('address', ''),
         data.get('signature', ''),
         data.get('logo', ''),
         datetime.now().isoformat()))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# ---- Rx Counter ----

@app.route('/api/rx-counter', methods=['GET'])
def get_rx_counter():
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT counter FROM rx_counter WHERE id = 1')
    row = c.fetchone()
    conn.close()
    return jsonify({'counter': row['counter'] if row else 0})


@app.route('/api/prescriptions/<int:pid>', methods=['GET'])
def get_prescription(pid):
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT * FROM prescriptions WHERE id = ?', (pid,))
    row = c.fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'Not found'}), 404
    d = dict(row)
    d['meds'] = json.loads(d['meds']) if d['meds'] else []
    return jsonify(d)


@app.route('/api/prescriptions/<int:pid>', methods=['PUT'])
def update_prescription(pid):
    data = request.json
    conn = get_db()
    c = conn.cursor()
    c.execute('''UPDATE prescriptions SET
        name=?, dob=?, age=?, sex=?, date=?, mobile=?, address=?, past_ill=?, past_surg=?, drug_all=?,
        h_current_med=?, h_htn=?, h_dm=?, h_smoke=?, h_family=?,
        ex_bp=?, ex_pulse=?, ex_temp=?, ex_spo2=?, ex_wt=?, ex_ht_cm=?, ex_ht=?, ex_rbs=?, ex_bmi=?,
        sp_cvs=?, sp_chest=?, sp_abd=?, sp_cns=?, p_cc=?, p_diag=?, meds=?, p_tests=?, p_advice=?, p_next=?, saved_at=?
        WHERE id=?''',
        (data.get('name', ''),
         data.get('dob', ''),
         data.get('age', ''),
         data.get('sex', ''),
         data.get('date', ''),
         data.get('mobile', ''),
         data.get('address', ''),
         data.get('pastIll', ''),
         data.get('pastSurg', ''),
         data.get('drugAll', ''),
         data.get('hCurrentMed', ''),
         data.get('hHTN', ''),
         data.get('hDM', ''),
         data.get('hSmoke', ''),
         data.get('hFamily', ''),
         data.get('exBP', ''),
         data.get('exPulse', ''),
         data.get('exTemp', ''),
         data.get('exSpo2', ''),
         data.get('exWt', ''),
         data.get('exHtCm', ''),
         data.get('exHt', ''),
         data.get('exRbs', ''),
         data.get('exBmi', ''),
         data.get('spCVS', ''),
         data.get('spChest', ''),
         data.get('spAbd', ''),
         data.get('spCNS', ''),
         data.get('pCC', ''),
         data.get('pDiag', ''),
         json.dumps(data.get('meds', [])),
         data.get('pTests', ''),
         data.get('pAdvice', ''),
         data.get('pNext', ''),
         datetime.now().isoformat(),
         pid))
    conn.commit()
    c.execute('SELECT changes()')
    changes = c.fetchone()['changes()']
    conn.close()
    if changes == 0:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'success': True, 'id': pid})


@app.route('/api/prescriptions/<int:pid>', methods=['DELETE'])
def delete_prescription(pid):
    conn = get_db()
    c = conn.cursor()
    c.execute('DELETE FROM prescriptions WHERE id = ?', (pid,))
    conn.commit()
    changes = c.rowcount
    conn.close()
    if changes == 0:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'success': True})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    print(f"RxPro Backend starting on http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
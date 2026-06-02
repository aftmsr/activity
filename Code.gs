/**
 * @file Code.gs
 * @description ระบบกิจกรรม วิทยาลัยการอาชีพแม่สะเรียง
 *              รวมทุก Module ไว้ในไฟล์เดียวเพื่อลดความซับซ้อน
 */

// =============================================================================
// SECTION 1: CONFIG
// =============================================================================

const CONFIG = {
  get SPREADSHEET_ID() {
    const id = PropertiesService.getScriptProperties().getProperty('DB_ID');
    return (id && id !== '') ? id : SpreadsheetApp.getActiveSpreadsheet().getId();
  },
  get PEPPER() {
    return PropertiesService.getScriptProperties().getProperty('AUTH_PEPPER') || 'MSR_SECRET_DEFAULT_123';
  },
  get LINE_ACCESS_TOKEN() {
    return PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN') || '';
  },
  get LINE_TARGET_ID() {
    return PropertiesService.getScriptProperties().getProperty('LINE_TARGET_ID') || '';
  },
  get GOOGLE_CLIENT_ID() {
    return PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID') || '';
  },
  get GITHUB_BASE_URL() {
    return PropertiesService.getScriptProperties().getProperty('GITHUB_URL') || '';
  },
  get UPLOAD_FOLDER_ID() {
    return PropertiesService.getScriptProperties().getProperty('UPLOAD_FOLDER_ID') || '';
  },
  APP_NAME: 'ระบบกิจกรรม - วก.แม่สะเรียง',
  VERSION: '2.0.0',
  SESSION_TTL_HOURS: 8,
  LOG_RETENTION_DAYS: 180,
  BRUTE_FORCE_DELAY_MS: 3000,
  MAX_LOGS: 500
};

// =============================================================================
// SECTION 2: ROUTER
// =============================================================================

function doGet(e) {
  let content;
  if (CONFIG.GITHUB_BASE_URL) {
    content = _fetchRemoteHtml('index');
  } else {
    content = HtmlService.createHtmlOutputFromFile('index').getContent();
  }
  return HtmlService.createTemplate(content).evaluate()
    .setTitle(CONFIG.APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const event = body.events && body.events[0];
    if (event && event.type === 'message' && event.message.type === 'text') {
      if (event.message.text.trim() === '!getID') {
        const src = event.source;
        const id = src.groupId || src.roomId || src.userId;
        logAction('LINE_ID_CAPTURE', `ID: ${id} (${src.type})`);
      }
    }
  } catch (err) {
    console.error('Webhook Error: ' + err.toString());
  }
}

function include(filename) {
  const user = getCurrentUser();
  const page = filename.toLowerCase();
  const ACCESS = {
    'admin_log':        ['ADMIN'],
    'admin_appeals':    ['ADMIN', 'STAFF'],
    'activity':         ['ADMIN', 'STAFF'],
    'scanner':          ['ADMIN', 'อวท.'],
    'batch_attendance': ['ADMIN', 'STAFF', 'อวท.'],
    'appeal':           ['STUDENT', 'ADMIN'],
    'members':          ['ADMIN', 'STAFF'],
    'holidays':         ['ADMIN', 'STAFF'],
    'report':           ['ADMIN', 'STAFF'],
    'report_summary':   ['ADMIN', 'STAFF'],
    'report_templates': ['ADMIN'],
    'remediation':      ['ADMIN', 'STAFF', 'อวท.'],
    'projects':         ['ADMIN', 'STAFF'],
    'promotion':        ['ADMIN'],
    'settings':         ['ADMIN']
  };
  if (ACCESS[page] && (!user || !ACCESS[page].includes(user.role))) {
    return '<div class="alert alert-danger">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>';
  }
  if (CONFIG.GITHUB_BASE_URL) return _fetchRemoteHtml(page);
  return HtmlService.createHtmlOutputFromFile(page).getContent();
}

// =============================================================================
// SECTION 3: AUTHENTICATION
// =============================================================================

function login(email, password) {
  const props = PropertiesService.getUserProperties();
  const lastAttempt = parseInt(props.getProperty('lastAttempt') || '0');
  const now = Date.now();

  if (now - lastAttempt < CONFIG.BRUTE_FORCE_DELAY_MS) {
    return { success: false, message: 'กรุณารอสักครู่ก่อนลองใหม่อีกครั้ง' };
  }

  try {
    const hashed = hashPassword(password);
    const sheet = _getSheet('Users');
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][3] === email.toLowerCase() && data[i][4] === hashed) {
        const user = _rowToUser(data[i]);
        if (user.status !== 'ACTIVE') {
          logAction('LOGIN_BLOCKED', `User ${email} is inactive`);
          return { success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน' };
        }
        _saveSession(user);
        props.deleteProperty('lastAttempt');
        logAction('LOGIN', `User ${email} logged in`);
        return { success: true, user: user };
      }
    }

    props.setProperty('lastAttempt', now.toString());
    logAction('LOGIN_FAILED', `Failed attempt for ${email}`);
    return { success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function loginWithGoogle(idToken) {
  try {
    let email = '';
    if (idToken) {
      const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + idToken);
      const info = JSON.parse(res.getContentText());
      if (info.error_description) throw new Error('Invalid Token: ' + info.error_description);
      if (CONFIG.GOOGLE_CLIENT_ID && info.aud !== CONFIG.GOOGLE_CLIENT_ID) throw new Error('Unauthorized Audience');
      if (info.email_verified !== 'true' && info.email_verified !== true) throw new Error('Email not verified');
      email = info.email;
    } else {
      email = Session.getActiveUser().getEmail();
    }
    if (!email) return { success: false, message: 'ไม่สามารถอ่านอีเมล Google ได้' };

    const data = _getSheet('Users').getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][3].toLowerCase() === email.toLowerCase()) {
        const user = _rowToUser(data[i]);
        if (user.status !== 'ACTIVE') return { success: false, message: 'บัญชีนี้ถูกระงับการใช้งาน' };
        _saveSession(user);
        logAction('LOGIN_GOOGLE', `${email} logged in via Google`);
        return { success: true, user: user };
      }
    }
    return { success: false, message: `อีเมล ${email} ยังไม่ได้ลงทะเบียนในระบบ` };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function logout() {
  logAction('LOGOUT', 'User logged out');
  PropertiesService.getUserProperties().deleteProperty('currentUser');
  return { success: true };
}

function getCurrentUser() {
  const json = PropertiesService.getUserProperties().getProperty('currentUser');
  if (!json) return null;
  try {
    const session = JSON.parse(json);
    // ตรวจสอบว่า Session หมดอายุหรือยัง
    if (session._expiry && Date.now() > session._expiry) {
      PropertiesService.getUserProperties().deleteProperty('currentUser');
      return null;
    }
    return session;
  } catch (_) {
    return null;
  }
}

function changePassword(oldPassword, newPassword) {
  const user = getCurrentUser();
  if (!user) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };
  const check = confirmPassword(oldPassword);
  if (!check.success) return check;
  if (!newPassword || newPassword.length < 6) return { success: false, message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' };

  try {
    const sheet = _getSheet('Users');
    const data = sheet.getDataRange().getValues();
    const idx = data.findIndex(r => r[3] === user.email);
    if (idx === -1) return { success: false, message: 'ไม่พบผู้ใช้งาน' };
    sheet.getRange(idx + 1, 5).setValue(hashPassword(newPassword));
    logAction('CHANGE_PASSWORD', `User ${user.email} changed password`);
    return { success: true, message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// confirmPassword: รับรหัสผ่านจริงจาก Client (ไม่ใช่ email)
function confirmPassword(passwordAttempt) {
  const user = getCurrentUser();
  if (!user) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };
  try {
    const data = _getSheet('Users').getDataRange().getValues();
    const record = data.find(r => r[3] === user.email);
    if (record && record[4] === hashPassword(passwordAttempt)) return { success: true };
    return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
  } catch (e) {
    return { success: false, message: 'เกิดข้อผิดพลาดในการตรวจสอบ' };
  }
}

// =============================================================================
// SECTION 4: USER MANAGEMENT
// =============================================================================

function getUsers() {
  if (!_require('ADMIN')) return _deny();
  try {
    return { success: true, data: _sheetToObjects('Users') };
  } catch (e) { return _err(e); }
}

function saveUser(userData) {
  if (!_require('ADMIN')) return _deny();
  // ตรวจสอบข้อมูลจำเป็น
  if (!userData.name || !userData.name.trim())
    return { success: false, message: 'กรุณาระบุชื่อ-นามสกุล' };
  if (!userData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email))
    return { success: false, message: 'อีเมลไม่ถูกต้อง' };
  if (!userData.role)
    return { success: false, message: 'กรุณาระบุบทบาท (Role)' };
  if (userData.password && userData.password.length < 6)
    return { success: false, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' };
  try {
    const sheet = _getSheet('Users');
    const data = sheet.getDataRange().getValues();
    const idx = data.findIndex((r, i) => i > 0 && r[0] === userData.userId);

    const existingPass = (idx > 0) ? data[idx][4] : hashPassword('123456');
    const row = [
      userData.userId || 'USR-' + Utilities.getUuid().substring(0, 8),
      userData.name.trim(),
      userData.role,
      userData.email.toLowerCase().trim(),
      userData.password ? hashPassword(userData.password) : existingPass,
      userData.status || 'ACTIVE',
      userData.department || '',
      userData.position || '',
      idx > 0 ? data[idx][8] : new Date()
    ];

    if (idx > 0) {
      sheet.getRange(idx + 1, 1, 1, row.length).setValues([row]);
      logAction('UPDATE_USER', `Updated: ${userData.email}`);
    } else {
      sheet.appendRow(row);
      logAction('ADD_USER', `Added: ${userData.email}`);
    }
    return { success: true, message: 'บันทึกข้อมูลเรียบร้อยแล้ว' };
  } catch (e) { return _err(e); }
}

// รับ password จาก client เพื่อยืนยันก่อนระงับผู้ใช้
function deleteUser(userId, password) {
  if (!_require('ADMIN')) return _deny();
  const check = confirmPassword(password);
  if (!check.success) return check;
  try {
    const sheet = _getSheet('Users');
    const data = sheet.getDataRange().getValues();
    const idx = data.findIndex(r => r[0] === userId);
    if (idx === -1) return { success: false, message: 'ไม่พบสมาชิก' };
    sheet.getRange(idx + 1, 6).setValue('INACTIVE');
    logAction('DEACTIVATE_USER', `Deactivated: ${userId}`);
    return { success: true, message: 'ระงับการใช้งานเรียบร้อยแล้ว' };
  } catch (e) { return _err(e); }
}

// =============================================================================
// SECTION 5: ACTIVITY MANAGEMENT
// =============================================================================

function getActivities(filters = {}) {
  const user = getCurrentUser();
  if (!user) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };
  try {
    let data = _sheetToObjects('Activities');
    if (filters.academicYear) data = data.filter(a => String(a.academicYear) === String(filters.academicYear));
    if (filters.semester)     data = data.filter(a => String(a.semester) === String(filters.semester));
    if (filters.type)         data = data.filter(a => a.type === filters.type);
    data.sort((a, b) => new Date(b.date) - new Date(a.date));
    return { success: true, data: data };
  } catch (e) { return _err(e); }
}

function saveActivity(actData) {
  if (!_require('ADMIN', 'STAFF')) return _deny();
  // ตรวจสอบข้อมูลจำเป็น
  if (!actData.name || !actData.name.trim())
    return { success: false, message: 'กรุณาระบุชื่อกิจกรรม' };
  if (!actData.date)
    return { success: false, message: 'กรุณาระบุวันที่จัดกิจกรรม' };
  if (!actData.academicYear)
    return { success: false, message: 'กรุณาระบุปีการศึกษา' };
  if (!actData.semester)
    return { success: false, message: 'กรุณาระบุภาคเรียน' };
  try {
    const sheet = _getSheet('Activities');
    const data = sheet.getDataRange().getValues();
    const id = actData.actId || 'ACT-' + Utilities.getUuid().substring(0, 8);
    const row = [
      id, actData.name.trim(), actData.date, actData.location || '',
      actData.academicYear, actData.semester, actData.type || 'ทั่วไป',
      getCurrentUser().email, actData.points || 0
    ];
    const idx = data.findIndex((r, i) => i > 0 && r[0] === actData.actId);
    if (idx > 0) {
      sheet.getRange(idx + 1, 1, 1, row.length).setValues([row]);
      logAction('UPDATE_ACTIVITY', `Updated: ${actData.name}`);
    } else {
      sheet.appendRow(row);
      logAction('ADD_ACTIVITY', `Created: ${actData.name}`);
    }
    return { success: true, message: 'บันทึกกิจกรรมเรียบร้อยแล้ว' };
  } catch (e) { return _err(e); }
}

function deleteActivity(actId) {
  if (!_require('ADMIN')) return _deny();
  try {
    const sheet = _getSheet('Activities');
    const ids = sheet.getRange('A:A').getValues().flat();
    const idx = ids.indexOf(actId);
    if (idx === -1) return { success: false, message: 'ไม่พบกิจกรรม' };
    sheet.deleteRow(idx + 1);
    logAction('DELETE_ACTIVITY', `Deleted actId: ${actId}`);
    return { success: true, message: 'ลบกิจกรรมเรียบร้อยแล้ว' };
  } catch (e) { return _err(e); }
}

function getAcademicYearList() {
  try {
    const years = [...new Set(_sheetToObjects('Activities').map(a => a.academicYear))];
    return { success: true, data: years.filter(Boolean).sort((a, b) => b - a) };
  } catch (e) { return _err(e); }
}

function getTermFilters() {
  try {
    const data = _getSheet('Activities').getDataRange().getValues().slice(1);
    return {
      success: true,
      years: [...new Set(data.map(r => r[4]))].filter(Boolean).sort().reverse(),
      semesters: [...new Set(data.map(r => r[5]))].filter(Boolean).sort()
    };
  } catch (e) { return _err(e); }
}

// =============================================================================
// SECTION 6: ATTENDANCE
// =============================================================================

function recordAttendance(studentId, actId, method = 'QR_SCAN') {
  if (!_require('ADMIN', 'STAFF', 'อวท.')) return _deny();
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const attSheet  = ss.getSheetByName('Attendance');
    const actSheet  = ss.getSheetByName('Activities');
    const holSheet  = ss.getSheetByName('Holidays');

    // ตรวจวันหยุด
    const todayStr = _todayStr();
    const holidays = holSheet.getDataRange().getValues().map(r => _dateStr(r[0]));
    if (holidays.includes(todayStr)) throw new Error('วันนี้เป็นวันหยุดที่กำหนดไว้ในระบบ');

    // ตรวจกิจกรรม
    const activities = actSheet.getDataRange().getValues();
    const activity = activities.find(r => r[0] == actId);
    if (!activity) throw new Error('ไม่พบรหัสกิจกรรมนี้');
    if (_dateStr(activity[2]) !== todayStr) throw new Error('กิจกรรมนี้ไม่ได้จัดขึ้นในวันนี้');

    // ตรวจซ้ำ
    const attData = attSheet.getDataRange().getValues();
    if (attData.some(r => r[1] == studentId && r[2] == actId)) throw new Error('บันทึกการเข้าร่วมไปแล้ว');

    // บันทึก
    attSheet.appendRow([
      Utilities.getUuid().substring(0, 8),
      studentId, actId, new Date(),
      getCurrentUser().email, method
    ]);
    logAction('ATTENDANCE_SCAN', `Student ${studentId} for ${actId}`);

    const student = ss.getSheetByName('Users').getDataRange().getValues().find(r => r[0] == studentId);
    return { success: true, message: `บันทึกสำเร็จ: ${student ? student[1] : studentId}` };
  } catch (e) {
    logAction('ERROR', 'recordAttendance: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

function recordBatchAttendance(actId, studentIds, method = 'BATCH_MANUAL') {
  if (!_require('ADMIN', 'STAFF', 'อวท.')) return _deny();
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const attSheet = ss.getSheetByName('Attendance');
    const actSheet = ss.getSheetByName('Activities');
    const holSheet = ss.getSheetByName('Holidays');

    const todayStr = _todayStr();
    const holidays = holSheet.getDataRange().getValues().map(r => _dateStr(r[0]));
    if (holidays.includes(todayStr)) throw new Error('วันนี้เป็นวันหยุด');

    const activity = actSheet.getDataRange().getValues().find(r => r[0] == actId);
    if (!activity) throw new Error('ไม่พบรหัสกิจกรรม');

    // ดึงข้อมูล attendance ครั้งเดียว (แก้ N+1 bug)
    const existing = new Set(
      attSheet.getDataRange().getValues()
        .filter(r => r[2] == actId)
        .map(r => String(r[1]))
    );

    const user = getCurrentUser();
    const now = new Date();
    const newRows = studentIds
      .filter(id => !existing.has(String(id)))
      .map(id => [Utilities.getUuid().substring(0, 8), id, actId, now, user.email, method]);

    if (newRows.length > 0) {
      attSheet.getRange(attSheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
      logAction('BATCH_ATTENDANCE', `${newRows.length} students for ${actId}`);
    }
    return { success: true, message: `บันทึกสำเร็จ ${newRows.length} รายการ (ข้าม ${studentIds.length - newRows.length} ซ้ำ)` };
  } catch (e) { return _err(e); }
}

function getStudentActivityStatus(studentId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const activities  = ss.getSheetByName('Activities').getDataRange().getValues();
    const attendance  = ss.getSheetByName('Attendance').getDataRange().getValues();
    const remSheet    = ss.getSheetByName('Remediation');
    const remediation = remSheet ? remSheet.getDataRange().getValues() : [];
    const threshold   = _getPassThreshold(ss);

    // หาเทอมล่าสุด
    let latestYear = 0, latestSem = 0;
    activities.slice(1).forEach(r => {
      const y = parseInt(r[4]) || 0, s = parseInt(r[5]) || 0;
      if (y > latestYear || (y === latestYear && s > latestSem)) { latestYear = y; latestSem = s; }
    });

    const termActs = activities.slice(1).filter(r => r[4] == latestYear && r[5] == latestSem);
    if (!termActs.length) return { success: true, percentage: 0, status: 'N/A', count: 0, total: 0 };

    const actIds = new Set(termActs.map(r => r[0]));
    const attended   = attendance.slice(1).filter(r => r[1] == studentId && actIds.has(r[2])).length;
    const remediated = remediation.slice(1).filter(r => r[1] == studentId && actIds.has(r[2]) && r[3] === 'COMPLETED').length;
    const total = termActs.length;
    const pct = ((attended + remediated) / total) * 100;

    return {
      success: true,
      percentage: pct.toFixed(2),
      status: pct >= threshold ? 'ผ่าน' : 'ไม่ผ่าน',
      count: attended + remediated,
      total: total,
      term: `${latestSem}/${latestYear}`,
      threshold: threshold
    };
  } catch (e) { return _err(e); }
}

function getStudentsNeedingRemediation(actId) {
  if (!_require('ADMIN', 'STAFF', 'อวท.')) return _deny();
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const attendedIds = new Set(
      ss.getSheetByName('Attendance').getDataRange().getValues()
        .filter(r => r[2] === actId).map(r => String(r[1]))
    );
    const students = ss.getSheetByName('Users').getDataRange().getValues().slice(1)
      .filter(u => u[2] === 'STUDENT' && u[5] === 'ACTIVE' && !attendedIds.has(String(u[0])))
      .map(u => ({ userId: u[0], name: u[1], department: u[6] }));
    return { success: true, data: students };
  } catch (e) { return _err(e); }
}

// =============================================================================
// SECTION 7: REMEDIATION (ซ่อมกิจกรรม)
// =============================================================================

function getRemediationData() {
  if (!_require('ADMIN', 'STAFF', 'อวท.')) return _deny();
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    return {
      success: true,
      remediation: ss.getSheetByName('Remediation').getDataRange().getValues(),
      users:       ss.getSheetByName('Users').getDataRange().getValues(),
      activities:  ss.getSheetByName('Activities').getDataRange().getValues()
    };
  } catch (e) { return _err(e); }
}

function saveRemediationRecord(data) {
  if (!_require('ADMIN', 'STAFF', 'อวท.')) return _deny();
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Remediation');
    if (!sheet) {
      sheet = ss.insertSheet('Remediation');
      sheet.appendRow(['ID', 'StudentId', 'ActId', 'Status', 'Notes', 'EvidenceUrl', 'UpdatedBy', 'UpdatedAt', 'Semester', 'AcademicYear']);
    }
    const actData = ss.getSheetByName('Activities').getDataRange().getValues().find(r => r[0] == data.actId);
    const row = [
      data.id || Utilities.getUuid().substring(0, 8),
      data.studentId, data.actId,
      data.status || 'PENDING',
      data.notes || '',
      data.evidenceUrl || '',
      getCurrentUser().email,
      new Date(),
      data.semester    || (actData ? actData[5] : ''),
      data.academicYear || (actData ? actData[4] : '')
    ];

    if (data.id) {
      const all = sheet.getDataRange().getValues();
      const idx = all.findIndex(r => r[0] == data.id);
      if (idx !== -1) {
        sheet.getRange(idx + 1, 1, 1, row.length).setValues([row]);
      } else {
        sheet.appendRow(row);
      }
    } else {
      sheet.appendRow(row);
    }

    if (data.status === 'PENDING') {
      sendLineNotification(`[${CONFIG.APP_NAME}] คำร้องซ่อมกิจกรรมใหม่ จาก ${data.studentId} สำหรับกิจกรรม ${data.actId}`);
    }
    logAction('REMEDIATION_SAVE', `Student ${data.studentId} act ${data.actId}`);
    return { success: true, message: 'บันทึกข้อมูลเรียบร้อยแล้ว' };
  } catch (e) { return _err(e); }
}

// =============================================================================
// SECTION 8: APPEALS (อุทธรณ์)
// =============================================================================

function getStudentMissingActivities() {
  if (!_require('STUDENT', 'ADMIN')) return _deny();
  try {
    const user = getCurrentUser();
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const actData = ss.getSheetByName('Activities').getDataRange().getValues();
    const attData = ss.getSheetByName('Attendance').getDataRange().getValues();
    const remSheet = ss.getSheetByName('Remediation');
    const remData  = remSheet ? remSheet.getDataRange().getValues() : [];

    const attended = new Set(attData.filter(r => r[1] == user.userId).map(r => r[2]));
    const inRem    = new Set(remData.filter(r => r[1] == user.userId).map(r => r[2]));

    const missing = actData.slice(1)
      .filter(a => !attended.has(a[0]) && !inRem.has(a[0]))
      .map(a => ({ actId: a[0], name: a[1], date: a[2], semester: a[5], year: a[4] }));

    const appeals = remData.slice(1)
      .filter(r => r[1] == user.userId)
      .map(r => {
        const act = actData.find(a => a[0] == r[2]);
        return { id: r[0], actName: act ? act[1] : r[2], status: r[3], notes: r[4], evidenceUrl: r[5], updatedAt: r[7] };
      });

    return { success: true, missing, appeals };
  } catch (e) { return _err(e); }
}

function getPendingAppeals() {
  if (!_require('ADMIN', 'STAFF')) return _deny();
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const remSheet = ss.getSheetByName('Remediation');
    if (!remSheet) return { success: true, data: [] };

    const remData = remSheet.getDataRange().getValues();
    const users = ss.getSheetByName('Users').getDataRange().getValues();
    const acts  = ss.getSheetByName('Activities').getDataRange().getValues();

    const pending = remData.slice(1)
      .filter(r => r[3] === 'PENDING')
      .map(r => {
        const st  = users.find(u => u[0] == r[1]) || [];
        const act = acts.find(a => a[0] == r[2]) || [];
        return {
          id: r[0], studentId: r[1],
          studentName: st[1] || 'Unknown',
          dept: st[6] || '-', email: st[3] || '',
          actName: act[1] || 'Unknown',
          notes: r[4], evidenceUrl: r[5], updatedAt: r[7]
        };
      });
    return { success: true, data: pending };
  } catch (e) { return _err(e); }
}

function updateAppealStatus(id, status, adminComment) {
  if (!_require('ADMIN', 'STAFF')) return _deny();
  const result = saveRemediationRecord({ id, status, notes: adminComment });
  if (result.success) {
    sendLineNotification(`[${CONFIG.APP_NAME}]\nคำร้องอุทธรณ์ ID: ${id}\nสถานะ: ${status}\nโดย: ${getCurrentUser().email}`);
  }
  return result;
}

// =============================================================================
// SECTION 9: REPORTS
// =============================================================================

function getAttendanceReport(filters) {
  if (!_require('ADMIN', 'STAFF')) return _deny();
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const activities = ss.getSheetByName('Activities').getDataRange().getValues();
    const attendance = ss.getSheetByName('Attendance').getDataRange().getValues();
    const users      = ss.getSheetByName('Users').getDataRange().getValues();
    const threshold  = _getPassThreshold(ss);

    const actIds = activities
      .filter(r => r[4] == filters.academicYear && r[5] == filters.semester)
      .map(r => r[0]);

    // สร้าง lookup map เพื่อประสิทธิภาพ
    const attendMap = {};
    attendance.slice(1).forEach(r => {
      if (actIds.includes(r[2])) attendMap[r[1]] = (attendMap[r[1]] || 0) + 1;
    });

    const reportData = users.slice(1)
      .filter(u => u[2] === 'STUDENT')
      .map(st => {
        const count = attendMap[st[0]] || 0;
        const pct = actIds.length > 0 ? (count / actIds.length) * 100 : 0;
        return {
          studentId: st[0], name: st[1], department: st[6] || '',
          total: actIds.length, attended: count,
          percent: pct.toFixed(2),
          status: pct >= threshold ? 'ผ่าน' : 'ไม่ผ่าน'
        };
      });
    return { success: true, data: reportData };
  } catch (e) { return _err(e); }
}

function getRawReportData() {
  if (!_require('ADMIN', 'STAFF')) return _deny();
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const settings = {};
    const sSheet = ss.getSheetByName('Settings');
    if (sSheet) sSheet.getDataRange().getValues().slice(1).forEach(r => settings[r[0]] = r[1]);
    return {
      success: true,
      attendance:  ss.getSheetByName('Attendance').getDataRange().getValues(),
      activities:  ss.getSheetByName('Activities').getDataRange().getValues(),
      users:       ss.getSheetByName('Users').getDataRange().getValues(),
      remediation: ss.getSheetByName('Remediation') ? ss.getSheetByName('Remediation').getDataRange().getValues() : [],
      projects:    ss.getSheetByName('Projects')    ? ss.getSheetByName('Projects').getDataRange().getValues()    : [],
      settings
    };
  } catch (e) { return _err(e); }
}

function exportReportToPdf(htmlContent) {
  if (!_require('ADMIN', 'STAFF')) return _deny();
  try {
    const blob = Utilities.newBlob(htmlContent, 'text/html', 'report.html');
    const pdf  = blob.getAs('application/pdf');
    pdf.setName('Report_' + Date.now() + '.pdf');
    const file = DriveApp.createFile(pdf);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    logAction('EXPORT_PDF', 'Report exported');
    return { success: true, url: file.getDownloadUrl() };
  } catch (e) { return _err(e); }
}

function saveReportConfig(config) {
  if (!_require('ADMIN', 'STAFF')) return _deny();
  try {
    _getSheet('Reports_Config').appendRow([
      Utilities.getUuid(), config.name, JSON.stringify(config.filters),
      config.template, getCurrentUser().email, new Date()
    ]);
    return { success: true };
  } catch (e) { return _err(e); }
}

// =============================================================================
// SECTION 10: DASHBOARD
// =============================================================================

function getDashboardStats(year, semester) {
  const user = getCurrentUser();
  if (!user) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const users      = ss.getSheetByName('Users').getDataRange().getValues();
    const allActs    = ss.getSheetByName('Activities').getDataRange().getValues();
    const attendance = ss.getSheetByName('Attendance').getDataRange().getValues();
    const remSheet   = ss.getSheetByName('Remediation');
    const remediation = remSheet ? remSheet.getDataRange().getValues() : [];
    const threshold  = _getPassThreshold(ss);

    let activities = allActs.slice(1);
    if (year && semester) {
      activities = activities.filter(r => r[4] == year && r[5] == semester);
    } else if (activities.length > 0) {
      let latestY = 0, latestS = 0;
      activities.forEach(r => {
        const y = parseInt(r[4]) || 0, s = parseInt(r[5]) || 0;
        if (y > latestY || (y === latestY && s > latestS)) { latestY = y; latestS = s; }
      });
      year = latestY; semester = latestS;
      activities = activities.filter(r => r[4] == year && r[5] == semester);
    }

    const typeStats = { 'ทั่วไป': 0, 'ชมรม': 0, 'พิเศษ': 0 };
    activities.forEach(r => { if (typeStats.hasOwnProperty(r[6])) typeStats[r[6]]++; });

    const actMap = {};
    activities.forEach(r => { actMap[r[0]] = parseFloat(r[8]) || 0; });

    const students = users.slice(1).filter(r => r[2] === 'STUDENT');
    const deptMap = {};
    const deptCounts = {};
    students.forEach(r => {
      if (r[6]) { deptMap[r[0]] = r[6]; deptCounts[r[6]] = (deptCounts[r[6]] || 0) + 1; }
    });

    const statsMap = {};
    attendance.slice(1).forEach(r => {
      if (deptMap[r[1]] && actMap[r[2]] !== undefined) {
        const dept = deptMap[r[1]];
        if (!statsMap[dept]) statsMap[dept] = 0;
        statsMap[dept] += actMap[r[2]];
      }
    });
    remediation.slice(1).forEach(r => {
      if (r[3] === 'COMPLETED' && deptMap[r[1]] && actMap[r[2]] !== undefined) {
        const dept = deptMap[r[1]];
        if (!statsMap[dept]) statsMap[dept] = 0;
        statsMap[dept] += actMap[r[2]];
      }
    });

    const termActIds = new Set(activities.map(r => r[0]));
    const total = activities.length;
    let pass = 0, fail = 0;
    students.forEach(st => {
      const att = attendance.slice(1).filter(r => r[1] == st[0] && termActIds.has(r[2])).length;
      const rem = remediation.slice(1).filter(r => r[1] == st[0] && termActIds.has(r[2]) && r[3] === 'COMPLETED').length;
      const pct = total > 0 ? ((att + rem) / total) * 100 : 0;
      pct >= threshold ? pass++ : fail++;
    });

    return {
      success: true,
      stats: statsMap, deptCounts, typeStats,
      passFail: { pass, fail },
      totalActs: total,
      currentTerm: { year, semester }
    };
  } catch (e) { return _err(e); }
}

// =============================================================================
// SECTION 11: HOLIDAYS
// =============================================================================

function getHolidays() {
  if (!_require('ADMIN', 'STAFF')) return _deny();
  try {
    const data = _getSheet('Holidays').getDataRange().getValues();
    if (data.length <= 1) return { success: true, data: [] };
    const headers = data[0];
    return {
      success: true,
      data: data.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        if (obj.date instanceof Date) obj.date = obj.date.toISOString().split('T')[0];
        return obj;
      })
    };
  } catch (e) { return _err(e); }
}

// รับ password จาก client เพื่อยืนยัน
function saveHoliday(holidayData, password) {
  if (!_require('ADMIN', 'STAFF')) return _deny();
  const check = confirmPassword(password);
  if (!check.success) return check;
  try {
    const sheet = _getSheet('Holidays');
    const data  = sheet.getDataRange().getValues();
    const id = holidayData.holidayId || 'HOL-' + Utilities.getUuid().substring(0, 8);
    const row = [id, holidayData.date, holidayData.description, getCurrentUser().email];
    const idx = holidayData.holidayId ? data.findIndex(r => r[0] === holidayData.holidayId) : -1;
    if (idx > 0) {
      sheet.getRange(idx + 1, 1, 1, row.length).setValues([row]);
      logAction('UPDATE_HOLIDAY', `${holidayData.description} on ${holidayData.date}`);
    } else {
      sheet.appendRow(row);
      logAction('ADD_HOLIDAY', `${holidayData.description} on ${holidayData.date}`);
    }
    return { success: true, message: 'บันทึกวันหยุดเรียบร้อยแล้ว' };
  } catch (e) { return _err(e); }
}

function deleteHoliday(holidayId, password) {
  if (!_require('ADMIN', 'STAFF')) return _deny();
  const check = confirmPassword(password);
  if (!check.success) return check;
  try {
    const sheet = _getSheet('Holidays');
    const data  = sheet.getDataRange().getValues();
    const idx   = data.findIndex(r => r[0] === holidayId);
    if (idx <= 0) return { success: false, message: 'ไม่พบวันหยุด' };
    sheet.deleteRow(idx + 1);
    logAction('DELETE_HOLIDAY', `Deleted: ${holidayId}`);
    return { success: true, message: 'ลบวันหยุดเรียบร้อยแล้ว' };
  } catch (e) { return _err(e); }
}

// =============================================================================
// SECTION 12: SETTINGS
// =============================================================================

function getSettings() {
  if (!_require('ADMIN')) return _deny();
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Settings');
    if (!sheet) {
      sheet = ss.insertSheet('Settings');
      sheet.appendRow(['Key', 'Value', 'Description']);
      sheet.getRange(2, 1, 5, 3).setValues([
        ['MAX_PDF_SIZE',  '30', 'ขนาดไฟล์ PDF สูงสุด (MB)'],
        ['PASS_PERCENTAGE', '80', 'เกณฑ์เปอร์เซ็นต์การผ่านกิจกรรม (%)'],
        ['LINE_CHANNEL_ACCESS_TOKEN', '', 'LINE Messaging API Token'],
        ['LINE_TARGET_ID', '', 'ID กลุ่ม/แอดมิน LINE'],
        ['MAX_IMG_SIZE', '3', 'ขนาดรูปภาพสูงสุด (MB)']
      ]);
    }
    const settings = {};
    sheet.getDataRange().getValues().slice(1).forEach(r => { settings[r[0]] = r[1]; });
    return { success: true, settings };
  } catch (e) { return _err(e); }
}

function saveSettings(settingsObj) {
  if (!_require('ADMIN')) return _deny();
  try {
    const sheet = _getSheet('Settings');
    const data  = sheet.getDataRange().getValues();
    const sp    = PropertiesService.getScriptProperties();
    Object.keys(settingsObj).forEach(key => {
      const idx = data.findIndex(r => r[0] === key);
      if (idx !== -1) {
        sheet.getRange(idx + 1, 2).setValue(settingsObj[key]);
        if (['LINE_CHANNEL_ACCESS_TOKEN', 'LINE_TARGET_ID'].includes(key)) {
          sp.setProperty(key, settingsObj[key]);
        }
      }
    });
    logAction('UPDATE_SETTINGS', 'System configurations updated');
    return { success: true, message: 'บันทึกการตั้งค่าเรียบร้อยแล้ว' };
  } catch (e) { return _err(e); }
}

// =============================================================================
// SECTION 13: PROJECTS
// =============================================================================

function getProjectList() {
  if (!_require('ADMIN', 'STAFF')) return _deny();
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Projects');
    const defaultHeaders = ['ID', 'ชื่อโครงการ/ชมรม', 'ปีการศึกษา', 'ภาคเรียน', 'งบประมาณ', 'กลุ่มเป้าหมาย', 'วันที่จัด', 'สถานะ', 'ไฟล์แนบ/Link'];
    if (!sheet) return { success: true, data: [], headers: defaultHeaders };
    const values = sheet.getDataRange().getValues();
    return {
      success: true,
      headers: values.length > 0 ? values[0] : defaultHeaders,
      data:    values.length > 1 ? values.slice(1) : []
    };
  } catch (e) { return _err(e); }
}

function saveProjectPlan(projectData) {
  if (!_require('ADMIN', 'STAFF')) return _deny();
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Projects');
    if (!sheet) {
      sheet = ss.insertSheet('Projects');
      sheet.appendRow(['ID', 'ชื่อโครงการ/ชมรม', 'ปีการศึกษา', 'ภาคเรียน', 'งบประมาณ', 'กลุ่มเป้าหมาย', 'วันที่จัด', 'สถานะ', 'ไฟล์แนบ/Link']);
    }
    const row = [
      projectData.id || Utilities.getUuid().substring(0, 8),
      projectData.name, projectData.year, projectData.semester,
      projectData.budget, projectData.scope, projectData.date,
      projectData.status, projectData.fileUrl || ''
    ];
    if (projectData.id) {
      const data = sheet.getDataRange().getValues();
      const idx  = data.findIndex(r => r[0] == projectData.id);
      if (idx !== -1) sheet.getRange(idx + 1, 1, 1, row.length).setValues([row]);
      else sheet.appendRow(row);
    } else {
      sheet.appendRow(row);
    }
    logAction('SAVE_PROJECT', `Project: ${projectData.name}`);
    return { success: true, message: 'บันทึกโครงการเรียบร้อยแล้ว' };
  } catch (e) { return _err(e); }
}

function deleteProject(projectId, password) {
  if (!_require('ADMIN', 'STAFF')) return _deny();
  const check = confirmPassword(password);
  if (!check.success) return check;
  try {
    const sheet = _getSheet('Projects');
    const data  = sheet.getDataRange().getValues();
    const idx   = data.findIndex(r => r[0] == projectId);
    if (idx === -1) return { success: false, message: 'ไม่พบโครงการ' };
    sheet.deleteRow(idx + 1);
    logAction('DELETE_PROJECT', `Deleted: ${projectId}`);
    return { success: true, message: 'ลบโครงการเรียบร้อยแล้ว' };
  } catch (e) { return _err(e); }
}

// =============================================================================
// SECTION 14: FILE UPLOAD
// =============================================================================

function handleFileUpload(base64Data, fileName, mimeType, category) {
  const user = getCurrentUser();
  if (!user) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const settings = {};
    const sSheet = ss.getSheetByName('Settings');
    if (sSheet) sSheet.getDataRange().getValues().slice(1).forEach(r => { settings[r[0]] = r[1]; });

    const maxPdf = parseInt(settings['MAX_PDF_SIZE'] || 30) * 1024 * 1024;
    const maxImg = parseInt(settings['MAX_IMG_SIZE'] || 3) * 1024 * 1024;

    const bytes   = Utilities.base64Decode(base64Data.split(',')[1]);
    const blob    = Utilities.newBlob(bytes, mimeType, fileName);
    const size    = blob.getBytes().length;

    if (mimeType === 'application/pdf' && size > maxPdf) {
      throw new Error(`ไฟล์ PDF เกินขนาดกำหนด (${maxPdf / 1024 / 1024}MB)`);
    }
    if (mimeType.startsWith('image/') && size > maxImg) {
      throw new Error(`รูปภาพเกินขนาดกำหนด (${maxImg / 1024 / 1024}MB)`);
    }

    const folder = _getFolderByCategory(category);
    const file   = folder.createFile(blob);

    if (category === 'APPEALS') {
      file.addViewer(user.email);
      ss.getSheetByName('Users').getDataRange().getValues().slice(1)
        .filter(u => ['ADMIN', 'STAFF'].includes(u[2]) && u[5] === 'ACTIVE')
        .forEach(u => file.addViewer(u[3]));
    } else {
      try {
        file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (_) {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      }
    }
    logAction('FILE_UPLOAD', `${fileName} (${category}) by ${user.email}`);
    return { success: true, url: file.getUrl(), name: file.getName() };
  } catch (e) { return _err(e); }
}

function setupSystemFolders() {
  if (!_require('ADMIN')) return _deny();
  if (!CONFIG.UPLOAD_FOLDER_ID) return { success: false, message: 'กรุณาตั้งค่า UPLOAD_FOLDER_ID' };
  try {
    const root = DriveApp.getFolderById(CONFIG.UPLOAD_FOLDER_ID);
    const cats = [
      '1. หลักฐานโครงการและชมรม',
      '2. หลักฐานการอุทธรณ์กิจกรรม',
      '3. รูปภาพกิจกรรม'
    ];
    const summary = cats.map(name => {
      const it = root.getFoldersByName(name);
      if (it.hasNext()) { it.next(); return `[OK] ${name}`; }
      root.createFolder(name);
      return `[NEW] ${name}`;
    });
    logAction('SETUP_DRIVE', 'Folder structure initialized');
    return { success: true, message: summary.join('\n') };
  } catch (e) { return _err(e); }
}

// =============================================================================
// SECTION 15: REPORT TEMPLATES
// =============================================================================

function getReportTemplates() {
  if (!_require('ADMIN')) return _deny();
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('ReportTemplates');
    if (!sheet) {
      sheet = ss.insertSheet('ReportTemplates');
      sheet.appendRow(['TemplateID', 'TemplateName', 'HeaderHtml', 'BodyHtml', 'FooterHtml', 'CustomCss', 'CreatedBy', 'CreatedAt', 'LastModifiedBy', 'LastModifiedAt']);
    }
    return { success: true, data: _sheetToObjects('ReportTemplates') };
  } catch (e) { return _err(e); }
}

function saveReportTemplate(tpl) {
  if (!_require('ADMIN')) return _deny();
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('ReportTemplates');
    if (!sheet) {
      sheet = ss.insertSheet('ReportTemplates');
      sheet.appendRow(['TemplateID', 'TemplateName', 'HeaderHtml', 'BodyHtml', 'FooterHtml', 'CustomCss', 'CreatedBy', 'CreatedAt', 'LastModifiedBy', 'LastModifiedAt']);
    }
    const now = new Date();
    const id  = tpl.TemplateID || Utilities.getUuid().substring(0, 8);
    const all = sheet.getDataRange().getValues();
    const idx = tpl.TemplateID ? all.findIndex(r => r[0] === tpl.TemplateID) : -1;

    const row = [
      id, tpl.TemplateName, tpl.HeaderHtml || '', tpl.BodyHtml || '',
      tpl.FooterHtml || '', tpl.CustomCss || '',
      idx > 0 ? all[idx][6] : getCurrentUser().email,
      idx > 0 ? all[idx][7] : now,
      getCurrentUser().email, now
    ];

    if (idx > 0) {
      sheet.getRange(idx + 1, 1, 1, row.length).setValues([row]);
      logAction('UPDATE_REPORT_TEMPLATE', tpl.TemplateName);
    } else {
      sheet.appendRow(row);
      logAction('ADD_REPORT_TEMPLATE', tpl.TemplateName);
    }
    return { success: true, message: 'บันทึกแม่แบบรายงานเรียบร้อยแล้ว' };
  } catch (e) { return _err(e); }
}

function deleteReportTemplate(templateId, password) {
  if (!_require('ADMIN')) return _deny();
  const check = confirmPassword(password);
  if (!check.success) return check;
  try {
    const sheet = _getSheet('ReportTemplates');
    const data  = sheet.getDataRange().getValues();
    const idx   = data.findIndex(r => r[0] === templateId);
    if (idx === -1) return { success: false, message: 'ไม่พบแม่แบบรายงาน' };
    sheet.deleteRow(idx + 1);
    logAction('DELETE_REPORT_TEMPLATE', `ID: ${templateId}`);
    return { success: true, message: 'ลบแม่แบบรายงานเรียบร้อยแล้ว' };
  } catch (e) { return _err(e); }
}

// =============================================================================
// SECTION 16: PLACEHOLDERS
// =============================================================================

function getCustomPlaceholders() {
  const user = getCurrentUser();
  if (!user) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName('Placeholders');
    if (!sheet) {
      sheet = ss.insertSheet('Placeholders');
      sheet.appendRow(['Key', 'Description', 'Category']);
      sheet.getRange(2, 1, 6, 3).setValues([
        ['{{student.id}}',   'รหัสนักเรียน',    'Student'],
        ['{{student.name}}', 'ชื่อ-นามสกุล',    'Student'],
        ['{{student.dept}}', 'แผนกวิชา',        'Student'],
        ['{{activity.name}}','ชื่อกิจกรรม',     'Activity'],
        ['{{status}}',       'สถานะการผ่าน',    'Report'],
        ['{{percent}}',      'เปอร์เซ็นต์',     'Report']
      ]);
    }
    return { success: true, data: sheet.getDataRange().getValues().slice(1) };
  } catch (e) { return _err(e); }
}

function saveCustomPlaceholder(pData) {
  if (!_require('ADMIN')) return _deny();
  try {
    _getSheet('Placeholders').appendRow([pData.key, pData.description, pData.category || 'Custom']);
    return { success: true, message: 'เพิ่มฟิลด์เรียบร้อยแล้ว' };
  } catch (e) { return _err(e); }
}

function deleteCustomPlaceholder(key) {
  if (!_require('ADMIN')) return _deny();
  try {
    const sheet = _getSheet('Placeholders');
    const data  = sheet.getDataRange().getValues();
    const idx   = data.findIndex(r => r[0] === key);
    if (idx === -1) return { success: false, message: 'ไม่พบข้อมูล' };
    sheet.deleteRow(idx + 1);
    return { success: true, message: 'ลบเรียบร้อยแล้ว' };
  } catch (e) { return _err(e); }
}

// =============================================================================
// SECTION 17: STUDENT PROMOTION
// =============================================================================

function promoteStudents(mapping) {
  if (!_require('ADMIN')) return _deny();
  try {
    const sheet = _getSheet('Users');
    const data  = sheet.getDataRange().getValues();
    let count = 0;
    for (let i = 1; i < data.length; i++) {
      const cur = data[i][6];
      if (mapping[cur]) {
        sheet.getRange(i + 1, 7).setValue(mapping[cur]);
        count++;
      }
    }
    logAction('STUDENT_PROMOTION', `Promoted ${count} students`);
    return { success: true, message: `เลื่อนชั้นปีสำเร็จ ${count} รายการ` };
  } catch (e) { return _err(e); }
}

// =============================================================================
// SECTION 18: LOG MANAGEMENT
// =============================================================================

function getLogs(filters = {}) {
  if (!_require('ADMIN')) return _deny();
  try {
    const sheet = _getSheet('SystemLog');
    const data  = sheet.getDataRange().getValues();
    const headers = data[0];
    let logs = data.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = r[i]);
      return obj;
    }).reverse().slice(0, CONFIG.MAX_LOGS);

    if (filters.action) logs = logs.filter(l => l.action === filters.action);
    if (filters.userId) logs = logs.filter(l => l.userId === filters.userId);
    return { success: true, data: logs };
  } catch (e) { return _err(e); }
}

// Time-based trigger: ลบ Log เก่ากว่า 180 วัน (ตั้ง Trigger รายสัปดาห์)
function autoPurgeLogs() {
  try {
    const sheet  = _getSheet('SystemLog');
    const data   = sheet.getDataRange().getValues();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - CONFIG.LOG_RETENTION_DAYS);
    const filtered = data.filter((r, i) => i === 0 || new Date(r[5]) > cutoff);
    if (filtered.length < data.length) {
      sheet.clear();
      sheet.getRange(1, 1, filtered.length, filtered[0].length).setValues(filtered);
      console.log(`Purged ${data.length - filtered.length} old logs`);
    }
  } catch (e) { console.error('autoPurgeLogs: ' + e.toString()); }
}

// =============================================================================
// SECTION 19: LINE NOTIFICATION
// =============================================================================

function sendLineNotification(message) {
  if (!CONFIG.LINE_ACCESS_TOKEN || !CONFIG.LINE_TARGET_ID) return;
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + CONFIG.LINE_ACCESS_TOKEN
      },
      payload: JSON.stringify({
        to: CONFIG.LINE_TARGET_ID,
        messages: [{ type: 'text', text: message }]
      }),
      muteHttpExceptions: true
    });
  } catch (e) {
    console.error('LINE notification failed: ' + e.toString());
  }
}

function testLineNotification(token, targetId) {
  if (!_require('ADMIN')) return _deny();
  const user = getCurrentUser();
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      payload: JSON.stringify({
        to: targetId,
        messages: [{ type: 'text', text: `✅ ทดสอบ LINE สำเร็จจาก ${CONFIG.APP_NAME} โดย ${user.name}` }]
      }),
      muteHttpExceptions: true
    });
    return { success: true, message: 'ส่งข้อความทดสอบแล้ว โปรดตรวจสอบ LINE' };
  } catch (e) { return _err(e); }
}

// =============================================================================
// SECTION 20: UTILITY / PRIVATE HELPERS
// =============================================================================

function logAction(action, detail) {
  try {
    const user  = getCurrentUser();
    const sheet = _getSheet('SystemLog');
    sheet.appendRow([
      Utilities.getUuid(), user ? user.email : 'GUEST',
      user ? user.role : 'N/A', action, detail, new Date()
    ]);
    if (/ERROR|SECURITY|DELETE|LOGIN_FAILED/.test(action)) {
      sendLineNotification(`⚠️ [${CONFIG.APP_NAME}]\n🚩 ${action}\n👤 ${user ? user.name : 'GUEST'}\n📝 ${detail}`);
    }
  } catch (e) { console.error('logAction failed: ' + e.toString()); }
}

function hashPassword(password) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password + CONFIG.PEPPER
  );
  return digest.map(b => ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2)).join('');
}

function setSystemSecret(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
  return `ตั้งค่า ${key} เรียบร้อยแล้ว`;
}

// --- Private helpers (prefix _ = internal use only) ---

function _saveSession(user) {
  // เพิ่ม timestamp หมดอายุ (SESSION_TTL_HOURS ชั่วโมง)
  const sessionData = Object.assign({}, user, {
    _expiry: Date.now() + (CONFIG.SESSION_TTL_HOURS * 60 * 60 * 1000)
  });
  PropertiesService.getUserProperties().setProperty('currentUser', JSON.stringify(sessionData));
}

function _require(...roles) {
  const user = getCurrentUser();
  return user && roles.includes(user.role);
}

function _deny() {
  return { success: false, message: 'คุณไม่มีสิทธิ์ดำเนินการนี้' };
}

function _err(e) {
  return { success: false, message: e.message || e.toString() };
}

function _getSheet(name) {
  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(name);
  if (!sheet) throw new Error(`ไม่พบ Sheet "${name}" กรุณารัน setupDatabase() ก่อน`);
  return sheet;
}

function _sheetToObjects(sheetName) {
  const data = _getSheet(sheetName).getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function _rowToUser(row) {
  return {
    userId: row[0], name: row[1], role: row[2],
    email: row[3], status: row[5],
    department: row[6], position: row[7]
  };
}

function _getPassThreshold(ss) {
  try {
    const sheet = ss.getSheetByName('Settings');
    if (!sheet) return 80;
    const row = sheet.getDataRange().getValues().find(r => r[0] === 'PASS_PERCENTAGE');
    return row ? parseFloat(row[1]) || 80 : 80;
  } catch (_) { return 80; }
}

function _getFolderByCategory(category) {
  if (!CONFIG.UPLOAD_FOLDER_ID) throw new Error('กรุณาตั้งค่า UPLOAD_FOLDER_ID');
  const root = DriveApp.getFolderById(CONFIG.UPLOAD_FOLDER_ID);
  const names = {
    PROJECTS:   '1. หลักฐานโครงการและชมรม',
    APPEALS:    '2. หลักฐานการอุทธรณ์กิจกรรม',
    ACTIVITIES: '3. รูปภาพกิจกรรม'
  };
  const folderName = names[category];
  if (!folderName) return root;
  const it = root.getFoldersByName(folderName);
  return it.hasNext() ? it.next() : root.createFolder(folderName);
}

function _fetchRemoteHtml(filename) {
  const cache   = CacheService.getScriptCache();
  const cached  = cache.get(filename);
  if (cached) return cached;
  try {
    const base = CONFIG.GITHUB_BASE_URL.endsWith('/') ? CONFIG.GITHUB_BASE_URL : CONFIG.GITHUB_BASE_URL + '/';
    const res  = UrlFetchApp.fetch(base + filename + '.html', { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      return `<div class="alert alert-danger">โหลดหน้า ${filename} ไม่สำเร็จ (${res.getResponseCode()})</div>`;
    }
    const content = res.getContentText();
    cache.put(filename, content, 60);
    return content;
  } catch (e) {
    return `<div class="alert alert-danger">เชื่อมต่อ GitHub ไม่สำเร็จ: ${e.toString()}</div>`;
  }
}

function _todayStr() {
  return new Date().toISOString().split('T')[0];
}

function _dateStr(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return String(val).split('T')[0];
}

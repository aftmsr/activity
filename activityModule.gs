/**
 * @file activityModule.gs
 * @description โมดูลสำหรับจัดการข้อมูลกิจกรรม (CRUD) และการกรองข้อมูลตามเงื่อนไข
 */

/**
 * ดึงรายการกิจกรรมทั้งหมดพร้อมระบบ Filter
 * @param {Object} filters - เงื่อนไขการกรอง { academicYear, semester, type }
 */
function getActivities(filters = {}) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Activities');
    if (!sheet) throw new Error('ไม่พบฐานข้อมูลกิจกรรม');

    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    
    let results = data.map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });

    // ระบบกรองข้อมูล (Filtering)
    if (filters.academicYear) {
      results = results.filter(a => String(a.academicYear) === String(filters.academicYear));
    }
    if (filters.semester) {
      results = results.filter(a => String(a.semester) === String(filters.semester));
    }
    if (filters.type) {
      results = results.filter(a => a.type === filters.type);
    }

    // เรียงลำดับตามวันที่จัดกิจกรรม (ล่าสุดขึ้นก่อน)
    results.sort((a, b) => new Date(b.date) - new Date(a.date));

    return { success: true, data: results };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * บันทึกหรือแก้ไขข้อมูลกิจกรรม (Upsert)
 * @param {Object} activityData - ข้อมูลกิจกรรมที่ส่งมาจาก Frontend
 */
function saveActivity(activityData) {
  try {
    const user = getCurrentUser();
    if (!user || !['ADMIN', 'STAFF'].includes(user.role)) {
      throw new Error('คุณไม่มีสิทธิ์ในการสร้างหรือแก้ไขกิจกรรม');
    }

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Activities');
    const data = sheet.getDataRange().getValues();

    const id = activityData.actId || Utilities.getUuid();
    const rowValues = [
      id,
      activityData.name,
      activityData.date, // คาดหวังรูปแบบ ISO String จาก Frontend
      activityData.location,
      activityData.academicYear,
      activityData.semester,
      activityData.type,
      user.email
    ];

    let rowIndex = -1;
    if (activityData.actId) {
      // ค้นหาแถวที่ต้องการแก้ไข
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === id) {
          rowIndex = i + 1;
          break;
        }
      }
    }

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, rowValues.length).setValues([rowValues]);
      logAction('UPDATE_ACTIVITY', `แก้ไขกิจกรรม: ${activityData.name} (ID: ${id})`);
    } else {
      sheet.appendRow(rowValues);
      logAction('CREATE_ACTIVITY', `สร้างกิจกรรมใหม่: ${activityData.name}`);
    }

    return { success: true, message: 'บันทึกข้อมูลสำเร็จ' };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * ลบกิจกรรมออกจากระบบ
 * @param {string} actId - รหัสกิจกรรม
 */
function deleteActivity(actId) {
  try {
    const user = getCurrentUser();
    if (!user || user.role !== 'ADMIN') throw new Error('เฉพาะ ADMIN เท่านั้นที่สามารถลบกิจกรรมได้');

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Activities');
    const ids = sheet.getRange("A:A").getValues().flat();
    
    const rowIndex = ids.indexOf(actId);
    if (rowIndex === -1) throw new Error('ไม่พบข้อมูลกิจกรรมที่ต้องการลบ');

    sheet.deleteRow(rowIndex + 1);
    logAction('DELETE_ACTIVITY', `ลบกิจกรรม ID: ${actId}`);
    return { success: true, message: 'ลบกิจกรรมเรียบร้อยแล้ว' };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * ดึงรายการปีการศึกษาที่มีอยู่ในฐานข้อมูล (เพื่อใช้แสดงผลใน Dropdown โดยไม่ต้องแก้โค้ด)
 */
function getAcademicYearList() {
  try {
    const res = getActivities();
    if (!res.success) return res;
    
    const years = [...new Set(res.data.map(item => item.academicYear))];
    years.sort((a, b) => b - a); // เรียงจากปีล่าสุด
    return { success: true, data: years };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
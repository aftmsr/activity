/**
 * @file reportModule.gs
 */

function getAttendanceReport(filters) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const activities = ss.getSheetByName('Activities').getDataRange().getValues();
    const attendance = ss.getSheetByName('Attendance').getDataRange().getValues();
    const users = ss.getSheetByName('Users').getDataRange().getValues();

    // กรองกิจกรรมตามปี/ภาคเรียน
    const filteredActs = activities.filter(r => 
      r[4] == filters.academicYear && r[5] == filters.semester
    );
    const actIds = filteredActs.map(r => r[0]);

    // กรองนักเรียน (สมมติ Role คือ STUDENT)
    const students = users.filter(u => u[2] === 'STUDENT');
    
    const reportData = students.map(st => {
      const stAtt = attendance.filter(a => a[1] == st[0] && actIds.includes(a[2]));
      const count = stAtt.length;
      const percent = (count / actIds.length) * 100 || 0;
      return {
        studentId: st[0],
        name: st[1],
        total: actIds.length,
        attended: count,
        percent: percent.toFixed(2),
        status: percent >= 80 ? 'ผ่าน' : 'ไม่ผ่าน'
      };
    });

    return { success: true, data: reportData };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function exportReportToPdf(htmlContent) {
  // สร้าง PDF โดยใช้เอกสารชั่วคราวเพื่อให้รองรับ TH Sarabun New
  const blob = Utilities.newBlob(htmlContent, 'text/html', 'report.html');
  const pdf = blob.getAs('application/pdf');
  pdf.setName('Report_' + new Date().getTime() + '.pdf');
  
  // ส่ง URL ของไฟล์กลับไป (ต้องเซฟลง Drive ก่อนเพื่อให้โหลดได้)
  const file = DriveApp.createFile(pdf);
  return { success: true, url: file.getDownloadUrl() };
}

/**
 * บันทึก Report Config
 */
function saveReportConfig(config) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Reports_Config');
  sheet.appendRow([
    Utilities.getUuid(),
    config.name,
    JSON.stringify(config.filters),
    config.template,
    getCurrentUser().email,
    new Date()
  ]);
  return { success: true };
}

function getFixActivityList(filters) {
  const res = getAttendanceReport(filters);
  if(res.success) {
    // ดึงเฉพาะคนที่ไม่ผ่าน (Percent < 80)
    const list = res.data.filter(st => st.status === 'ไม่ผ่าน');
    return { success: true, data: list };
  }
  return res;
}
/**
 * @file attendanceModule.gs
 */

function recordAttendance(studentId, actId, method = 'QR') {
  try {
    const user = getCurrentUser();
    if (!['ADMIN', 'STAFF', 'อวท.'].includes(user.role)) throw new Error('ไม่มีสิทธิ์บันทึกการเข้ากิจกรรม');

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const attSheet = ss.getSheetByName('Attendance');
    const actSheet = ss.getSheetByName('Activities');
    
    // 1. ตรวจสอบว่ามีกิจกรรมนี้จริงและอยู่ในช่วงเวลา (Check Date)
    const activities = actSheet.getDataRange().getValues();
    const activity = activities.find(r => r[0] == actId);
    if (!activity) throw new Error('ไม่พบรหัสกิจกรรมนี้');
    
    const today = new Date().setHours(0,0,0,0);
    const actDate = new Date(activity[2]).setHours(0,0,0,0);
    if (today !== actDate) throw new Error('กิจกรรมนี้ไม่ได้จัดขึ้นในวันนี้');

    // 2. ป้องกันการสแกนซ้ำ
    const attendanceData = attSheet.getDataRange().getValues();
    const isDuplicate = attendanceData.some(r => r[1] == studentId && r[2] == actId);
    if (isDuplicate) throw new Error('นักเรียนคนนี้บันทึกการเข้าร่วมไปแล้ว');

    // 3. บันทึกข้อมูล
    attSheet.appendRow([
      Utilities.getUuid(),
      studentId,
      actId,
      new Date(),
      user.email,
      method
    ]);

    logAction('ATTENDANCE_SCAN', `Student ${studentId} scanned for ${actId}`);
    
    // ดึงชื่อนักเรียนเพื่อแสดงผลยืนยัน
    const userSheet = ss.getSheetByName('Users');
    const userData = userSheet.getDataRange().getValues();
    const student = userData.find(r => r[0] == studentId);

    return { 
      success: true, 
      message: `บันทึกสำเร็จ: ${student ? student[1] : studentId}` 
    };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
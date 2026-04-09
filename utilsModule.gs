/**
 * @file utilsModule.gs
 * @description Database initialization and helper functions
 */

/**
 * รันฟังก์ชันนี้ครั้งแรกเพื่อสร้างโครงสร้างฐานข้อมูลใน Google Sheets โดยอัตโนมัติ
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tables = {
    'Users': ['userId', 'name', 'role', 'email', 'password', 'status', 'createdAt'],
    'Activities': ['actId', 'name', 'date', 'location', 'academicYear', 'semester', 'type', 'createdBy'],
    'Attendance': ['attId', 'studentId', 'actId', 'scanTime', 'scanBy', 'method'],
    'Appeals': ['appId', 'studentId', 'actId', 'reason', 'img1Url', 'img2Url', 'status', 'reviewBy', 'reviewNote', 'createdAt'],
    'Reports_Config': ['reportId', 'name', 'filterConfig', 'template', 'createdBy', 'updatedAt'],
    'SystemLog': ['logId', 'userId', 'role', 'action', 'detail', 'timestamp']
  };

  for (let sheetName in tables) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      sheet.clear(); // ล้างข้อมูลเก่าเพื่อสร้าง Header ใหม่ (ระวัง: ข้อมูลจะหาย)
    }
    sheet.getRange(1, 1, 1, tables[sheetName].length)
         .setValues([tables[sheetName]])
         .setFontWeight('bold')
         .setBackground('#f3f3f3');
    sheet.setFrozenRows(1);
  }

  // สร้าง User Admin เริ่มต้น
  const userSheet = ss.getSheetByName('Users');
  userSheet.appendRow(['ADMIN-01', 'ผู้ดูแลระบบ', 'ADMIN', 'admin@msr.ac.th', '123456', 'ACTIVE', new Date()]);
  
  return "Database Setup Completed Successfully!";
}
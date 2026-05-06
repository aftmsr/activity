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
  // ป้องกันการสร้าง Admin ซ้ำและไม่ Hardcode รหัสผ่านในโค้ดระยะยาว
  // ตรวจสอบว่ามี Admin อยู่แล้วหรือไม่ (โดยดูจาก role)
  const existingAdmins = userSheet.getDataRange().getValues().slice(1).filter(row => row[2] === 'ADMIN');
  if (existingAdmins.length === 0) {
    const defaultAdminEmail = "admin@msr.ac.th";
    const defaultAdminPass = "CHANGE_ME_IMMEDIATELY"; // ให้เปลี่ยนทันทีหลัง Setup
    userSheet.appendRow(['ADMIN-01', 'ผู้ดูแลระบบ', 'ADMIN', defaultAdminEmail, hashPassword(defaultAdminPass), 'ACTIVE', new Date()]);
    Logger.log(`Default Admin created: ${defaultAdminEmail} with password "${defaultAdminPass}". PLEASE CHANGE IT IMMEDIATELY!`);
  }
  
  return "Database Setup Completed Successfully!";
}

/**
 * ฟังก์ชันสำหรับตรวจสอบและกระตุ้นการขอสิทธิ์เข้าถึง Google Drive และบริการอื่นๆ
 */
function checkSystemPermissions() {
  try {
    // ทดสอบเข้าถึง Drive
    const folderName = "Student_Appeals_Images";
    let folders = DriveApp.getFoldersByName(folderName);
    let folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    
    return "✅ สิทธิ์การเข้าถึงถูกต้อง: Google Drive พร้อมใช้งาน (Folder ID: " + folder.getId() + ")";
  } catch (e) {
    return "❌ เกิดข้อผิดพลาดในการขอสิทธิ์: " + e.toString();
  }
}
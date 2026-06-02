/**
 * @file utilsModule.gs
 * @description โมดูล Utility / Helper Functions
 *
 * ⚠️  หมายเหตุ: ฟังก์ชันทั้งหมดถูกรวมไว้ใน Code.gs (Section 20: UTILITY / PRIVATE HELPERS)
 *
 *     Private Helpers (ใช้ภายในระบบ, prefix _ หมายถึง internal):
 *       - _getSheet(name)          → ดึง Sheet Object พร้อม error handling
 *       - _sheetToObjects(name)    → แปลง Sheet rows เป็น Array of Objects
 *       - _rowToUser(row)          → แปลงแถวข้อมูล Users Sheet เป็น User Object
 *       - _require(...roles)       → ตรวจสอบสิทธิ์ผู้ใช้ปัจจุบัน
 *       - _deny()                  → ส่งคืน error "ไม่มีสิทธิ์"
 *       - _err(e)                  → ส่งคืน error object มาตรฐาน
 *       - _saveSession(user)       → บันทึก Session พร้อม timestamp
 *       - _getPassThreshold(ss)    → ดึงเกณฑ์ผ่านกิจกรรม (%)
 *       - _getFolderByCategory(c)  → ดึง Drive Folder ตามประเภทไฟล์
 *       - _fetchRemoteHtml(name)   → โหลด HTML จาก GitHub (พร้อม Cache)
 *       - _todayStr()              → วันที่วันนี้เป็น String "YYYY-MM-DD"
 *       - _dateStr(val)            → แปลงค่า Date ต่างๆ เป็น String
 *
 *     Public Utilities:
 *       - logAction(action, detail)  → บันทึก SystemLog
 *       - hashPassword(password)     → เข้ารหัส SHA-256 + PEPPER
 *       - sendLineNotification(msg)  → ส่งแจ้งเตือน LINE
 *       - setSystemSecret(key, val)  → บันทึก Script Properties
 */

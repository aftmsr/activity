/**
 * @file authModule.gs
 * @description โมดูลการยืนยันตัวตน (Authentication & Authorization)
 *
 * ⚠️  หมายเหตุ: ฟังก์ชันทั้งหมดถูกรวมไว้ใน Code.gs (Section 3: AUTHENTICATION)
 *
 *     ฟังก์ชันที่ใช้งานได้:
 *       - login(email, password)         → เข้าสู่ระบบด้วย Email/Password
 *       - loginWithGoogle(idToken)       → เข้าสู่ระบบด้วย Google OAuth
 *       - logout()                       → ออกจากระบบ
 *       - getCurrentUser()               → ดึงข้อมูล Session ผู้ใช้ปัจจุบัน
 *       - changePassword(old, new)       → เปลี่ยนรหัสผ่าน
 *       - confirmPassword(password)      → ยืนยันรหัสผ่านก่อนการกระทำสำคัญ
 *       - hashPassword(password)         → เข้ารหัส SHA-256 + PEPPER
 */

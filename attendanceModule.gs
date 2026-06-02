/**
 * @file attendanceModule.gs
 * @description โมดูลการเช็คชื่อ / บันทึกการเข้าร่วมกิจกรรม
 *
 * ⚠️  หมายเหตุ: ฟังก์ชันทั้งหมดถูกรวมไว้ใน Code.gs (Section 6: ATTENDANCE)
 *
 *     ฟังก์ชันที่ใช้งานได้:
 *       - recordAttendance(studentId, actId, method)         → สแกน QR เช็คชื่อรายคน
 *       - recordBatchAttendance(actId, studentIds, method)   → เช็คชื่อหลายคนพร้อมกัน
 *       - getStudentActivityStatus(studentId)                → ดูสถานะการผ่านกิจกรรม
 *       - getStudentsNeedingRemediation(actId)               → ดูนักเรียนที่ยังไม่เข้าร่วม
 */
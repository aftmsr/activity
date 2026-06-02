/**
 * @file logModule.gs
 * @description โมดูลการบันทึก System Log
 *
 * ⚠️  หมายเหตุ: ฟังก์ชันทั้งหมดถูกรวมไว้ใน Code.gs (Section 18: LOG MANAGEMENT)
 *     เวอร์ชันใน Code.gs มีการตรวจสอบสิทธิ์ (ADMIN only) และ pagination แล้ว
 *
 *     ฟังก์ชันที่ใช้งานได้:
 *       - getLogs(filters)       → ดึง Log ล่าสุด 500 รายการ (ADMIN เท่านั้น)
 *       - autoPurgeLogs()        → ลบ Log เก่ากว่า 180 วัน (ตั้ง Time-based Trigger)
 *       - logAction(action, detail) → บันทึก action (อยู่ใน Section 20)
 */
/**
 * @file appealModule.gs
 * @description โมดูลอุทธรณ์ (Legacy)
 *
 * ⚠️  หมายเหตุ: ระบบอุทธรณ์ถูกรวมเข้ากับระบบ Remediation (ซ่อมกิจกรรม) แล้ว
 *     เพื่อหลีกเลี่ยงการมีข้อมูลสองที่ (Sheet "Appeals" เก่า + Sheet "Remediation" ใหม่)
 *
 *     ฟังก์ชันที่ใช้งานได้อยู่ใน Code.gs:
 *       - getStudentMissingActivities()  → ดูกิจกรรมที่ขาด + สถานะการอุทธรณ์
 *       - saveRemediationRecord(data)    → ยื่นคำร้อง (แทน submitAppeal)
 *       - getPendingAppeals()            → ดูคำร้องที่รอพิจารณา
 *       - updateAppealStatus(id, status, adminComment) → อนุมัติ/ปฏิเสธ
 *
 *     Sheet "Appeals" เก่าถูกเก็บไว้เพื่อ Historical Data เท่านั้น
 *     ไม่ควรบันทึกข้อมูลใหม่ลงใน Sheet "Appeals" อีกต่อไป
 */
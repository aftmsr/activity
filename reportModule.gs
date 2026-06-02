/**
 * @file reportModule.gs
 * @description โมดูลรายงานสถิติ
 *
 * ⚠️  หมายเหตุ: ฟังก์ชันทั้งหมดถูกรวมไว้ใน Code.gs (Section 9: REPORTS)
 *     เวอร์ชันใน Code.gs มีการตรวจสอบสิทธิ์, ใช้ PASS_PERCENTAGE จาก Settings Sheet
 *     และรองรับข้อมูล Remediation ในการคำนวณด้วย
 *
 *     ฟังก์ชันที่ใช้งานได้:
 *       - getAttendanceReport(filters)   → รายงานการเข้าร่วมแยกนักเรียน (ADMIN/STAFF)
 *       - getRawReportData()             → ดึงข้อมูลดิบทุก Sheet สำหรับสร้างรายงาน
 *       - exportReportToPdf(htmlContent) → Export รายงานเป็น PDF ใน Drive
 *       - saveReportConfig(config)       → บันทึก Config รายงาน
 *
 *     ⚠️ เวอร์ชันเก่าในไฟล์นี้ใช้ค่า Hardcode 80% สำหรับเกณฑ์ผ่าน
 *        เวอร์ชันใน Code.gs ดึงค่าจาก Settings Sheet (_getPassThreshold) แทน
 */
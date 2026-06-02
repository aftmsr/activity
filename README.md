# ระบบบริหารจัดการกิจกรรม — วิทยาลัยการอาชีพแม่สะเรียง

**Activity Management System** สำหรับบริหารจัดการกิจกรรมนักศึกษา สร้างด้วย Google Apps Script + Google Sheets

---

## 📋 สารบัญ

- [ฟีเจอร์](#-ฟีเจอร์)
- [โครงสร้างระบบ](#-โครงสร้างระบบ)
- [การติดตั้งครั้งแรก (Setup)](#-การติดตั้งครั้งแรก-setup)
- [การ Deploy](#-การ-deploy)
- [Script Properties](#-script-properties)
- [การทดสอบ](#-การทดสอบ)
- [สิทธิ์การใช้งาน (Roles)](#-สิทธิ์การใช้งาน-roles)

---

## ✨ ฟีเจอร์

| ฟีเจอร์ | รายละเอียด |
|---|---|
| 🔐 Authentication | Email/Password + Google Sign-In (OAuth 2.0) |
| 📅 จัดการกิจกรรม | CRUD กิจกรรม, กรองตามปี/ภาคเรียน/ประเภท |
| 📲 QR Check-in | สแกน QR Code เช็คชื่อแบบ Real-time |
| 👥 Batch Attendance | เช็คชื่อหลายคนพร้อมกัน |
| 📝 อุทธรณ์/ซ่อมกิจกรรม | นักเรียนยื่นคำร้อง, อาจารย์อนุมัติ/ปฏิเสธ |
| 📊 Dashboard | Chart สถิติ + ปฏิทินกิจกรรม |
| 📄 รายงาน | Export PDF, Excel พร้อมแม่แบบ Custom |
| 🔔 LINE Notification | แจ้งเตือนผ่าน LINE Messaging API |
| 📁 File Upload | อัปโหลดหลักฐานไปยัง Google Drive |
| 📖 System Log | บันทึกทุก action + Auto-purge 180 วัน |

---

## 🏗️ โครงสร้างระบบ

```
activity/
├── Code.gs               ← Backend หลัก (ทุก Logic รวมที่นี่)
├── DatabaseSetup.gs      ← สร้าง DB ครั้งแรก (รันครั้งเดียว)
├── appsscript.json       ← Manifest: OAuth Scopes, Runtime V8
│
├── index.html            ← Layout หลัก + Login + Navigation
├── dashboard.html        ← แผงควบคุม + Chart + ปฏิทิน
├── activity.html         ← จัดการกิจกรรม
├── members.html          ← จัดการสมาชิก
├── appeal.html           ← ยื่นอุทธรณ์ (Student)
├── admin_appeals.html    ← พิจารณาอุทธรณ์ (Admin/Staff)
├── remediation.html      ← ซ่อมกิจกรรม
├── report_summary.html   ← รายงานสรุปรายบุคคล
├── report_templates.html ← จัดการแม่แบบรายงาน (Admin)
├── holidays.html         ← ตั้งค่าวันหยุด
├── projects.html         ← โครงการและชมรม
├── settings.html         ← ตั้งค่าระบบ (Admin)
├── scanner.html          ← สแกน QR
└── admin_log.html        ← ประวัติการใช้งาน (Admin)
```

> **หมายเหตุ:** ไฟล์ `*Module.gs` อื่นๆ เป็นเพียง documentation ชี้ไปยัง `Code.gs`

---

## 🚀 การติดตั้งครั้งแรก (Setup)

### 1. สร้าง Google Spreadsheet ใหม่

สร้าง Google Spreadsheet เปล่าสำหรับเป็นฐานข้อมูล แล้วจด **Spreadsheet ID** ไว้  
(ID อยู่ใน URL: `https://docs.google.com/spreadsheets/d/**{SPREADSHEET_ID}**/edit`)

### 2. สร้าง Google Apps Script Project

1. เปิด [script.google.com](https://script.google.com)
2. คลิก **New project**
3. คัดลอกโค้ดจากทุกไฟล์ `.gs` และ `.html` ในโฟลเดอร์นี้ไปวางในโปรเจค

> **แนะนำ:** ใช้ [clasp CLI](https://github.com/google/clasp) push โค้ดขึ้นโดยอัตโนมัติ

### 3. ตั้งค่า Script Properties

ไปที่ **Project Settings → Script Properties** แล้วเพิ่ม:

| Key | ค่า | จำเป็น |
|---|---|---|
| `DB_ID` | Spreadsheet ID จากข้อ 1 | ✅ |
| `AUTH_PEPPER` | ค่าสุ่มลับสำหรับ Hash Password เช่น `MSR_2024_SECRET_XYZ` | ✅ |
| `GOOGLE_CLIENT_ID` | Client ID จาก Google Cloud Console | ถ้าใช้ Google Sign-In |
| `LINE_CHANNEL_ACCESS_TOKEN` | Token จาก LINE Developers | ถ้าใช้แจ้งเตือน LINE |
| `LINE_TARGET_ID` | User/Group ID ปลายทาง LINE | ถ้าใช้แจ้งเตือน LINE |
| `UPLOAD_FOLDER_ID` | Folder ID ใน Google Drive สำหรับเก็บไฟล์ | ถ้าใช้ File Upload |

### 4. รัน Setup Database

ใน Apps Script Editor:
1. เลือกฟังก์ชัน `setupDatabase`
2. คลิก **▶ Run**
3. ยืนยัน Permission ต่างๆ
4. ระบบจะสร้าง Sheet และ Admin account เริ่มต้น

**บัญชีเริ่มต้น:**
- Email: `admin@msr.ac.th`  
- Password: `CHANGE_ME_IMMEDIATELY` ← **เปลี่ยนทันที!**

### 5. ตั้งค่าโครงสร้าง Drive (ถ้าใช้ File Upload)

รันฟังก์ชัน `setupSystemFolders` เพื่อสร้างโฟลเดอร์ใน Drive

---

## 🌐 การ Deploy

### Deploy เป็น Web App

1. คลิก **Deploy → New deployment**
2. เลือก Type: **Web app**
3. ตั้งค่า:
   - Execute as: **Me (youremail@...)**
   - Who has access: **Anyone** (หรือ Anyone within organization)
4. คลิก **Deploy**
5. คัดลอก **Web App URL** สำหรับแจกจ่ายผู้ใช้

> **URL รูปแบบ:** `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`

### อัปเดตโค้ด

หลังแก้โค้ดแล้ว ต้อง Deploy เวอร์ชันใหม่:
1. **Deploy → Manage deployments**
2. คลิก ✏️ แก้ไข → เลือก **New version**
3. คลิก **Deploy**

---

## ⚙️ Script Properties

รายละเอียดเพิ่มเติม:

### `AUTH_PEPPER`
ใช้สำหรับเพิ่ม entropy ใน SHA-256 Password Hash  
**ห้ามเปลี่ยนหลังจากมีผู้ใช้ในระบบแล้ว** (จะทำให้ Login ไม่ได้ทุกคน)

### `GITHUB_BASE_URL` (Optional)
ถ้าตั้งค่านี้ ระบบจะโหลด HTML จาก GitHub Pages แทน Apps Script  
รูปแบบ: `https://raw.githubusercontent.com/username/repo/main/`  
Cache TTL: 60 วินาที

---

## 🧪 การทดสอบ

> ⚠️ **Google Apps Script ไม่รองรับการทดสอบบน localhost**  
> เนื่องจากระบบพึ่งพา Google Services (Sheets, Drive, UrlFetch ฯลฯ) ซึ่งต้องรันบน Server ของ Google

### วิธีทดสอบที่แนะนำ

#### วิธีที่ 1: ทดสอบผ่าน Apps Script Editor (เร็วที่สุด)
1. เปิด [script.google.com](https://script.google.com)
2. เลือกฟังก์ชันที่ต้องการทดสอบ → คลิก **▶ Run**
3. ดูผลใน **Execution log**

#### วิธีที่ 2: Deploy เป็น Test Deployment
1. **Deploy → New deployment** → Type: Web app
2. Who has access: **Only myself**
3. ได้ URL สำหรับทดสอบ (ไม่กระทบ Production)

#### วิธีที่ 3: ใช้ clasp (สำหรับ Developer)
```bash
# ติดตั้ง clasp
npm install -g @google/clasp

# Login
clasp login

# Clone project
clasp clone {SCRIPT_ID}

# Push โค้ดขึ้น
clasp push

# เปิด Web App
clasp open --webapp
```

### ทดสอบ LINE Notification
ใช้ฟังก์ชัน `testLineNotification(token, targetId)` จาก Apps Script Editor

---

## 👤 สิทธิ์การใช้งาน (Roles)

| Role | แผงควบคุม | กิจกรรม | เช็คชื่อ | รายงาน | สมาชิก | ตั้งค่า |
|---|---|---|---|---|---|---|
| **ADMIN** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **STAFF** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **อวท.** | ✅ | ❌ | ✅ (QR+Batch) | ❌ | ❌ | ❌ |
| **STUDENT** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 🔄 เกณฑ์ผ่านกิจกรรม

ค่าเริ่มต้น: **80%**  
เปลี่ยนได้ที่: **ตั้งค่าระบบ → PASS_PERCENTAGE** (เฉพาะ ADMIN)

---

*Version 2.0.0 | วิทยาลัยการอาชีพแม่สะเรียง*

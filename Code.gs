/**
 * @file Code.gs
 * @description Main router and configuration for Mae Sariang Industrial College Activity System
 */

const CONFIG = {
  // หากมีการใช้ฐานข้อมูลแยกไฟล์ ให้ใส่ ID ใน Script Properties ชื่อ 'DB_ID'
  // แนะนำให้ลองดึงจาก Property ก่อน ถ้าไม่มีค่อยใช้ ID ของไฟล์ปัจจุบัน
  SPREADSHEET_ID: (function() {
    const propId = PropertiesService.getScriptProperties().getProperty('DB_ID');
    return (propId && propId !== "") ? propId : SpreadsheetApp.getActiveSpreadsheet().getId();
  })(),
  APP_NAME: "ระบบกิจกรรม - วก.แม่สะเรียง",
  VERSION: "1.0.0",
  LINE_TOKEN: PropertiesService.getScriptProperties().getProperty('LINE_TOKEN'), // เตรียมไว้สำหรับ LINE Notify
  // ตัวอย่าง URL: https://raw.githubusercontent.com/[USER]/[REPO]/[BRANCH]/
  GITHUB_BASE_URL: PropertiesService.getScriptProperties().getProperty('GITHUB_URL') || ""
};

function doGet(e) {
  let htmlContent;
  
  if (CONFIG.GITHUB_BASE_URL) {
    // ดึงจาก GitHub
    htmlContent = fetchRemoteHtml('index');
  } else {
    // สำรอง: ดึงจากไฟล์ในสคริปต์หากไม่ได้ตั้งค่า URL
    htmlContent = HtmlService.createHtmlOutputFromFile('index').getContent();
  }

  const template = HtmlService.createTemplate(htmlContent);
  
  return template.evaluate()
    .setTitle(CONFIG.APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  if (CONFIG.GITHUB_BASE_URL) {
    return fetchRemoteHtml(filename);
  }
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * ฟังก์ชันดึงเนื้อหาไฟล์ HTML จาก GitHub Raw URL
 */
function fetchRemoteHtml(filename) {
  try {
    // ตรวจสอบให้แน่ใจว่า URL ลงท้ายด้วย / ก่อนต่อชื่อไฟล์
    const baseUrl = CONFIG.GITHUB_BASE_URL.endsWith('/') ? CONFIG.GITHUB_BASE_URL : CONFIG.GITHUB_BASE_URL + '/';
    const url = baseUrl + filename + '.html';
    const cache = CacheService.getScriptCache();
    const cached = cache.get(filename);
    
    if (cached) return cached;

    const response = UrlFetchApp.fetch(url, { 'muteHttpExceptions': true });
    if (response.getResponseCode() !== 200) {
      return `<!-- Error: Could not fetch ${filename}.html (Status: ${response.getResponseCode()}) -->`;
    }
    
    const content = response.getContentText();
    // เก็บไว้ใน Cache 1 นาที เพื่อไม่ให้เรียก API ของ GitHub บ่อยเกินไปในแต่ละ Refresh
    cache.put(filename, content, 60); 
    return content;
  } catch (e) {
    return `<!-- Error fetching remote file: ${e.toString()} -->`;
  }
}

function logAction(action, detail) {
  try {
    const user = getCurrentUser();
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('SystemLog');
    if (!sheet) return;
    
    sheet.appendRow([
      Utilities.getUuid(),
      user ? user.email : 'GUEST',
      user ? user.role : 'N/A',
      action,
      detail,
      new Date()
    ]);
  } catch (e) {
    console.error('Logging failed: ' + e.toString());
  }
}

/**
 * ฟังก์ชันสำหรับ Admin ใช้ตั้งค่า Key ต่างๆ ผ่านสคริปต์
 */
function setSystemSecret(key, value) {
  // จำกัดให้เฉพาะผู้ที่มีสิทธิ์เข้าถึงโปรเจกต์สคริปต์เท่านั้นที่รันได้
  PropertiesService.getScriptProperties().setProperty(key, value);
  return `ตั้งค่า ${key} เรียบร้อยแล้ว`;
}

/**
 * ฟังก์ชันเข้ารหัสผ่านด้วย SHA-256
 */
function hashPassword(password) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  let hash = '';
  for (let i = 0; i < digest.length; i++) {
    let byte = digest[i];
    if (byte < 0) byte += 256;
    let byteStr = byte.toString(16);
    if (byteStr.length === 1) byteStr = '0' + byteStr;
    hash += byteStr;
  }
  return hash;
}

/**
 * @file authModule.gs (ถูกรวมเข้าใน Code.gs)
 */

function login(email, password) {
  // Hash the input password for comparison
  const hashedPassword = hashPassword(password);

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      // Compare with hashed password stored in sheet
      if (data[i][3] === email && data[i][4] === hashedPassword) {
        // Ensure the stored password is not plain text (for existing users)
        // This is a temporary check; ideally all passwords should be hashed.
        if (data[i][4].length < 32) { // SHA-256 hex is 64 chars, a plain text password is usually shorter
          logAction('SECURITY_WARNING', `Plain text password detected for ${email}. Please update.`);
          // Optionally, force user to change password or re-hash it here.
        }

        const user = {
          userId: data[i][0],
          name: data[i][1],
          role: data[i][2],
          email: data[i][3],
          status: data[i][5]
        };
        
        if (user.status !== 'ACTIVE') throw new Error('บัญชีนี้ถูกระงับการใช้งาน');
        
        PropertiesService.getUserProperties().setProperty('currentUser', JSON.stringify(user));
        logAction('LOGIN', `User ${email} logged in`);
        return { success: true, user: user };
      }
    }
    throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * ดึงข้อมูลผู้ใช้งานปัจจุบันที่ Login อยู่
 */
function getCurrentUser() {
  const userJson = PropertiesService.getUserProperties().getProperty('currentUser');
  return userJson ? JSON.parse(userJson) : null;
}

function logout() {
  PropertiesService.getUserProperties().deleteProperty('currentUser');
  logAction('LOGOUT', 'User logged out');
  return { success: true };
}

/**
 * ดึงข้อมูลประวัติการใช้งานระบบสำหรับหน้า Admin Log
 */
function getLogs() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('SystemLog');
    if (!sheet) return { success: false, message: 'ไม่พบแผ่นงานประวัติระบบ' };
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, data: [] };

    const headers = data[0];
    const rows = data.slice(1).reverse().slice(0, 500); // ดึง 500 รายการล่าสุด
    
    const logs = rows.map(row => {
      let logObj = {};
      headers.forEach((header, index) => logObj[header] = row[index]);
      return logObj;
    });
    
    return { success: true, data: logs };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
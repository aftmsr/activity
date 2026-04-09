/**
 * @file Code.gs
 * @description Main router and configuration for Mae Sariang Industrial College Activity System
 */

const CONFIG = {
  // หากมีการใช้ฐานข้อมูลแยกไฟล์ ให้ใส่ ID ใน Script Properties ชื่อ 'DB_ID'
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('DB_ID') || '128SVuTDvHUcCbk5rmYo2JmAMH73fATqAoz5YKqXh6O4',
  APP_NAME: "ระบบกิจกรรม - วก.แม่สะเรียง",
  VERSION: "1.0.0",
  LINE_TOKEN: PropertiesService.getScriptProperties().getProperty('LINE_TOKEN') // เตรียมไว้สำหรับ LINE Notify
};

function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle(CONFIG.APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
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
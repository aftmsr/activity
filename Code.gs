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
  GITHUB_BASE_URL: PropertiesService.getScriptProperties().getProperty('https://github.com/aft-msr/activity') || ""
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
    const url = CONFIG.GITHUB_BASE_URL + filename + '.html';
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
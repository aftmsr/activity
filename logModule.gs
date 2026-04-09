/**
 * @file logModule.gs
 */

function getLogs(filters = {}) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName('SystemLog');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  let logs = data.map(r => ({
    logId: r[0], userId: r[1], role: r[2], action: r[3], detail: r[4], timestamp: r[5]
  })).reverse(); // ล่าสุดขึ้นก่อน

  return { success: true, data: logs };
}

/**
 * ลบ Log ที่เก่ากว่า 180 วันอัตโนมัติ
 */
function autoPurgeLogs() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName('SystemLog');
  const data = sheet.getDataRange().getValues();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 180);

  const filtered = data.filter((r, idx) => idx === 0 || new Date(r[5]) > cutoff);
  sheet.clear().getRange(1, 1, filtered.length, filtered[0].length).setValues(filtered);
}
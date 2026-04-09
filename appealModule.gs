/**
 * @file appealModule.gs
 */

function submitAppeal(data) {
  try {
    const user = getCurrentUser();
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Appeals');
    
    // สร้าง Folder เก็บรูปใน Drive (ถ้ายังไม่มี)
    const folderName = "Student_Appeals_Images";
    let folders = DriveApp.getFoldersByName(folderName);
    let folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    // บันทึกรูป (จำกัด 2 รูป)
    let imgUrls = ["", ""];
    [data.img1, data.img2].forEach((imgBase64, index) => {
      if (imgBase64) {
        const contentType = imgBase64.substring(5, imgBase64.indexOf(';'));
        const bytes = Utilities.base64Decode(imgBase64.split(',')[1]);
        const blob = Utilities.newBlob(bytes, contentType, `Appeal_${user.userId}_${index + 1}.jpg`);
        const file = folder.createFile(blob);
        imgUrls[index] = file.getUrl();
      }
    });

    sheet.appendRow([
      Utilities.getUuid(),
      user.userId,
      data.actId,
      data.reason,
      imgUrls[0],
      imgUrls[1],
      'รอพิจารณา',
      '', // reviewBy
      '', // reviewNote
      new Date()
    ]);

    logAction('SUBMIT_APPEAL', `Student ${user.userId} appealed for ${data.actId}`);
    return { success: true, message: 'ยื่นคำร้องสำเร็จ ระบบจะพิจารณาในลำดับถัดไป' };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function updateAppealStatus(appId, status, note) {
  const user = getCurrentUser();
  if (user.role !== 'ADMIN') throw new Error('Permission Denied');

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Appeals');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === appId) {
      sheet.getRange(i + 1, 7, 1, 3).setValues([[status, user.email, note]]);
      
      // หากอนุมัติ ให้ไปเพิ่มชื่อใน Attendance อัตโนมัติ
      if(status === 'อนุมัติ') {
        recordAttendance(data[i][1], data[i][2], 'APPEAL_APPROVED');
      }
      break;
    }
  }
}
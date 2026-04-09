/**
 * @file authModule.gs
 */

function login(email, password) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Users');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][3] === email && data[i][4] === password) {
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

function logout() {
  PropertiesService.getUserProperties().deleteProperty('currentUser');
  logAction('LOGOUT', 'User logged out');
  return { success: true };
}
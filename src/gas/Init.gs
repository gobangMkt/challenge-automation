// 최초 1회 실행용. 에디터에서 setup() Run → 권한 승인 + 시트 6탭 생성 + 운영자 토큰 발급.
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('이 스크립트가 스프레드시트에 바인딩되지 않음. 시트에서 확장프로그램>Apps Script로 열어야 함.');
  }
  getSheet_('Participants', PARTICIPANT_HEADERS);
  getSheet_('Challenges', CHALLENGE_HEADERS);
  getSheet_('WeekMissions', WEEKMISSION_HEADERS);
  getSheet_('Submissions', SUBMISSION_HEADERS);
  getSheet_('Wrapup', WRAPUP_HEADERS);
  getSheet_('NotifyLog', NOTIFYLOG_HEADERS);

  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('OPERATOR_TOKEN');
  if (!token) {
    token = Utilities.getUuid();
    props.setProperty('OPERATOR_TOKEN', token);
  }
  var msg = 'SETUP OK · 시트 6탭 생성 · OPERATOR_TOKEN = ' + token;
  Logger.log(msg);
  return msg;
}

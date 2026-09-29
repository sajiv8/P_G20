/**
 * CampusRSO — SUS survey generator
 * ---------------------------------------------------------------------------
 * Builds the System Usability Scale questionnaire as a Google Form, wires it to
 * a response spreadsheet, and adds a sheet that scores every response as it
 * arrives (per-participant SUS score, the average, and the agreement
 * percentages the two bar charts are drawn from).
 *
 * HOW TO RUN
 *   1. Go to script.google.com and start a new project.
 *   2. Replace the contents of Code.gs with this file, then SAVE (Cmd/Ctrl+S).
 *      The editor only parses the file on save — until you do, the function
 *      dropdown reads "No functions" and Run stays greyed out.
 *   3. Pick `createSusForm` in the function dropdown and press Run.
 *   4. Approve the permission prompt (it needs Forms + Sheets + Drive).
 *      On the "Google hasn't verified this app" screen choose Advanced →
 *      Go to <project name>. This is your own script running as you.
 *   5. The share link and the results spreadsheet link print in the
 *      Execution log panel at the bottom of the editor.
 *
 * The ten statements are Brooke's originals and their order matters — odd items
 * are positive, even items are negative, and the scoring assumes that. Do not
 * reorder them.
 */

var FORM_TITLE = 'CampusRSO — Usability Feedback (SUS)';

var FORM_INTRO =
  'Thank you for testing CampusRSO, a booking platform for shared university ' +
  'facilities.\n\n' +
  'This takes about two minutes. The ten statements in the middle are a standard ' +
  'usability scale — answer each one on instinct rather than thinking it through, ' +
  'which is how the scale is designed to be used. Some are worded positively and ' +
  'some negatively, so read each one.\n\n' +
  'Responses are anonymous and are used only to evaluate this project.';

/** Brooke's ten statements. Odd = positive, even = negative. Order is fixed. */
var SUS_STATEMENTS = [
  'I think that I would like to use this system frequently.',
  'I found the system unnecessarily complex.',
  'I thought the system was easy to use.',
  'I think that I would need the support of a technical person to be able to use this system.',
  'I found the various functions in this system were well integrated.',
  'I thought there was too much inconsistency in this system.',
  'I would imagine that most people would learn to use this system very quickly.',
  'I found the system very cumbersome to use.',
  'I felt very confident using the system.',
  'I needed to learn a lot of things before I could get going with this system.'
];

/** Short labels for the two summary charts. */
var POSITIVE_LABELS = [
  'Like to use frequently',
  'Ease to use',
  'Well integrated',
  'Learn to use quickly',
  'Felt confident using'
];
var NEGATIVE_LABELS = [
  'System is complex',
  'Need technical assistance',
  'System is inconsistent',
  'System is cumbersome',
  'Need prior learning'
];


// ───────────────────────────────────────────────────────────────────────────
//  Main
// ───────────────────────────────────────────────────────────────────────────

function createSusForm() {
  var form = FormApp.create(FORM_TITLE);
  form.setDescription(FORM_INTRO);
  form.setProgressBar(true);
  form.setShowLinkToRespondAgain(false);
  form.setAllowResponseEdits(false);
  try {
    form.setCollectEmail(false);   // renamed in newer runtimes; harmless if it throws
  } catch (e) {}

  buildAboutYouSection(form);
  buildSusSection(form);
  buildOpenEndedSection(form);

  var sheet = attachResponseSheet(form);
  addAnalysisSheet(sheet, form);

  var liveUrl = form.getPublishedUrl();
  var shortUrl = liveUrl;
  try { shortUrl = form.shortenFormUrl(liveUrl); } catch (e) {}

  Logger.log('');
  Logger.log('─────────────────────────────────────────────────────────');
  Logger.log(' Form is ready.');
  Logger.log('─────────────────────────────────────────────────────────');
  Logger.log(' Share this with testers : ' + shortUrl);
  Logger.log(' Long link               : ' + liveUrl);
  Logger.log(' Edit the form           : ' + form.getEditUrl());
  Logger.log(' Results + SUS scores    : ' + sheet.getUrl());
  Logger.log('─────────────────────────────────────────────────────────');
  Logger.log(' Put the share link on the participant guide, then aim for');
  Logger.log(' 20–25 completed responses.');
  Logger.log('');

  return shortUrl;
}


// ───────────────────────────────────────────────────────────────────────────
//  Sections
// ───────────────────────────────────────────────────────────────────────────

/** Demographics. Kept short — every extra question costs you responses. */
function buildAboutYouSection(form) {
  form.addPageBreakItem()
    .setTitle('About you')
    .setHelpText('Four quick questions so we can describe who took part.');

  form.addMultipleChoiceItem()
    .setTitle('Your age group')
    .setChoiceValues(['Under 20', '20–25', '26–30', '31–40', 'Over 40'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Your role')
    .setChoiceValues([
      'Undergraduate student',
      'Postgraduate student',
      'Lecturer',
      'Academic or administrative staff',
      'Other'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('What did you use the system on?')
    .setChoiceValues(['Laptop or desktop', 'Mobile phone', 'Tablet'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Have you used a room or resource booking system before?')
    .setChoiceValues(['Yes, regularly', 'Once or twice', 'No, this was the first time'])
    .setRequired(true);
}

/** The ten SUS statements, each a 1–5 scale so responses export as numbers. */
function buildSusSection(form) {
  form.addPageBreakItem()
    .setTitle('The system')
    .setHelpText(
      'Rate each statement from 1 (strongly disagree) to 5 (strongly agree). ' +
      'Go with your first reaction. If you really cannot decide, pick 3 and move on.'
    );

  for (var i = 0; i < SUS_STATEMENTS.length; i++) {
    form.addScaleItem()
      .setTitle((i + 1) + '. ' + SUS_STATEMENTS[i])
      .setBounds(1, 5)
      .setLabels('Strongly disagree', 'Strongly agree')
      .setRequired(true);
  }
}

/** Free text. This is what the opinion analysis in the report is built from. */
function buildOpenEndedSection(form) {
  form.addPageBreakItem()
    .setTitle('In your own words')
    .setHelpText('The last few. Short answers are fine, blunt ones are better.');

  form.addCheckboxItem()
    .setTitle('Which parts of the task sheet did you get through?')
    .setChoiceValues([
      'Part A — the basics',
      'Part B — lending between students',
      'Part C — running a faculty (admin)'
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('Roughly how long did it take you?')
    .setChoiceValues(['Under 5 minutes', '5–10 minutes', '11–15 minutes',
                      '16–20 minutes', 'Over 20 minutes'])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('What worked well?')
    .setHelpText('Anything that felt quick, obvious or better than you expected.')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('What was confusing, slow or frustrating?')
    .setHelpText('Where did you hesitate, guess, or have to go back?')
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('What would you add or change?')
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle('Did anything break or show an error?')
    .setHelpText('If so, what were you doing at the time?')
    .setRequired(false);
}


// ───────────────────────────────────────────────────────────────────────────
//  Response spreadsheet + scoring
// ───────────────────────────────────────────────────────────────────────────

/** Creates the destination spreadsheet and returns it. */
function attachResponseSheet(form) {
  var ss = SpreadsheetApp.create(FORM_TITLE + ' — Responses');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  // Re-open: the response sheet is added server-side after setDestination.
  return SpreadsheetApp.openById(ss.getId());
}

/** Finds the sheet the form writes into. */
function findResponseSheetName(ss) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getFormUrl()) return sheets[i].getName();
  }
  for (var j = 0; j < sheets.length; j++) {
    if (sheets[j].getName().indexOf('Form Responses') === 0) return sheets[j].getName();
  }
  return 'Form Responses 1';   // Google's default
}

/** 1 -> "A", 27 -> "AA". */
function columnLetter(n) {
  var out = '';
  while (n > 0) {
    var r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = (n - r - 1) / 26;
  }
  return out;
}

/**
 * Locates the ten statement columns by reading the response sheet's header
 * row rather than assuming F–O. Workspace accounts that force email collection
 * add a column and shift everything along, so this has to be looked up.
 */
function findStatementColumns(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  var cols = [];
  if (sheet && sheet.getLastColumn() > 0) {
    var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    for (var i = 0; i < 10; i++) {
      var prefix = (i + 1) + '. ';
      for (var c = 0; c < header.length; c++) {
        if (String(header[c]).indexOf(prefix) === 0) { cols.push(columnLetter(c + 1)); break; }
      }
    }
  }
  if (cols.length !== 10) {
    Logger.log('Header row not readable yet — falling back to columns F–O. ' +
               'If the sheet has an Email Address column, shift the formulas one across.');
    cols = ['F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];
  }
  return cols;
}

/** Column holding a given question, by exact header text. Falls back to `dflt`. */
function findColumnByHeader(ss, sheetName, title, dflt) {
  var sheet = ss.getSheetByName(sheetName);
  if (sheet && sheet.getLastColumn() > 0) {
    var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    for (var c = 0; c < header.length; c++) {
      if (String(header[c]) === title) return columnLetter(c + 1);
    }
  }
  return dflt;
}

/**
 * Adds a sheet that scores responses live.
 *
 * SUS scoring: odd statements contribute (answer - 1), even ones (5 - answer);
 * the ten contributions are summed and multiplied by 2.5, giving 0-100.
 * Checked against the Satori reference workbook — all 20 of its participant
 * scores and its 64.5 average reproduce exactly.
 */
function addAnalysisSheet(ss, form) {
  var sheetName = findResponseSheetName(ss);
  var src = "'" + sheetName + "'";
  var Q = findStatementColumns(ss, sheetName);
  var roleCol = findColumnByHeader(ss, sheetName, 'Your role', 'C');
  var sheet = ss.insertSheet('SUS Analysis', 0);

  // -- per-participant score, as one array formula down column D --
  var terms = [];
  for (var i = 0; i < 10; i++) {
    var col = src + '!' + Q[i] + '2:' + Q[i];
    terms.push((i % 2 === 0) ? '(' + col + '-1)' : '(5-' + col + ')');
  }
  var scoreFormula =
    '=ARRAYFORMULA(IF(LEN(' + src + '!A2:A),(' + terms.join('+') + ')*2.5,""))';

  // -- headline numbers --
  sheet.getRange('A1').setValue('SUS RESULTS');
  sheet.getRange('A3').setValue('Responses');
  sheet.getRange('B3').setFormula('=COUNT(D12:D)');
  sheet.getRange('A4').setValue('Average SUS score');
  sheet.getRange('B4').setFormula('=IFERROR(ROUND(AVERAGE(D12:D),1),"")');
  sheet.getRange('A5').setValue('Benchmark (68 = average)');
  sheet.getRange('B5').setFormula(
    '=IF(B3=0,"",IF(B4>=68,"Above average","Below average"))');
  // Sauro-Lewis curved grade — same bands as tests/usability/sus-score.mjs,
  // so the spreadsheet and the CLI scorer never disagree.
  sheet.getRange('A6').setValue('Grade');
  sheet.getRange('B6').setFormula(
    '=IF(B3=0,"",IFS(B4>=80.3,"A - excellent",B4>=74,"B - good",' +
    'B4>=68,"C - okay, at the average",B4>=51,"D - poor",B4>=0,"F - unacceptable"))');
  sheet.getRange('A7').setValue('Standard deviation');
  sheet.getRange('B7').setFormula('=IFERROR(ROUND(STDEV(D12:D),1),"")');
  // A mean from 20 people carries real uncertainty; quoting it bare overstates it.
  sheet.getRange('A8').setValue('95% confidence interval');
  sheet.getRange('B8').setFormula(
    '=IF(B3<2,"",ROUND(AVERAGE(D12:D)-1.96*STDEV(D12:D)/SQRT(B3),1)&" to "&' +
    'ROUND(AVERAGE(D12:D)+1.96*STDEV(D12:D)/SQRT(B3),1))');

  // -- per-participant table --
  sheet.getRange('A10').setValue('PER-PARTICIPANT SCORES');
  sheet.getRange('A11:D11').setValues([['#', 'Submitted', 'Role', 'SUS score']]);
  sheet.getRange('A12').setFormula(
    '=ARRAYFORMULA(IF(LEN(' + src + '!A2:A),ROW(' + src + '!A2:A)-1,""))');
  sheet.getRange('B12').setFormula(
    '=ARRAYFORMULA(IF(LEN(' + src + '!A2:A),' + src + '!A2:A,""))');
  sheet.getRange('C12').setFormula(
    '=ARRAYFORMULA(IF(LEN(' + src + '!A2:A),' + src + '!' + roleCol + '2:' + roleCol + ',""))');
  sheet.getRange('D12').setFormula(scoreFormula);

  // -- agreement percentages: the data behind the two bar charts --
  sheet.getRange('F9').setValue('POSITIVE STATEMENTS - % WHO AGREED (4 or 5)');
  sheet.getRange('F10:G10').setValues([['Statement', '% of users']]);
  for (var p = 0; p < 5; p++) {
    var pc = Q[p * 2];                       // statements 1,3,5,7,9
    sheet.getRange(11 + p, 6).setValue(POSITIVE_LABELS[p]);
    sheet.getRange(11 + p, 7).setFormula(
      '=IFERROR(ROUND(COUNTIF(' + src + '!' + pc + '2:' + pc + ',">=4")' +
      '/COUNT(' + src + '!' + pc + '2:' + pc + ')*100,1),0)');
  }

  sheet.getRange('F18').setValue('NEGATIVE STATEMENTS - % WHO AGREED (4 or 5)');
  sheet.getRange('F19:G19').setValues([['Statement', '% of users']]);
  for (var n = 0; n < 5; n++) {
    var nc = Q[n * 2 + 1];                   // statements 2,4,6,8,10
    sheet.getRange(20 + n, 6).setValue(NEGATIVE_LABELS[n]);
    sheet.getRange(20 + n, 7).setFormula(
      '=IFERROR(ROUND(COUNTIF(' + src + '!' + nc + '2:' + nc + ',">=4")' +
      '/COUNT(' + src + '!' + nc + '2:' + nc + ')*100,1),0)');
  }

  styleAnalysisSheet(sheet);
}

function styleAnalysisSheet(sheet) {
  sheet.getRange('A1').setFontSize(14).setFontWeight('bold');
  sheet.getRange('A10').setFontWeight('bold');
  sheet.getRange('F9').setFontWeight('bold');
  sheet.getRange('F18').setFontWeight('bold');
  sheet.getRange('A3:A8').setFontWeight('bold');
  sheet.getRange('B4').setFontSize(20).setFontWeight('bold');

  [ 'A11:D11', 'F10:G10', 'F19:G19' ].forEach(function (r) {
    sheet.getRange(r).setFontWeight('bold').setBackground('#e8eefb');
  });

  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 160);
  sheet.setColumnWidth(3, 190);
  sheet.setColumnWidth(4, 90);
  sheet.setColumnWidth(5, 30);
  sheet.setColumnWidth(6, 220);
  sheet.setColumnWidth(7, 90);
  sheet.setFrozenRows(1);
}


// ───────────────────────────────────────────────────────────────────────────
//  Optional: draw the two bar charts once responses are in
// ───────────────────────────────────────────────────────────────────────────

/**
 * Run this after you have responses. It adds the two horizontal bar charts
 * the write-up needs. Running it twice replaces the old charts.
 */
function addCharts() {
  var files = DriveApp.getFilesByName(FORM_TITLE + ' — Responses');
  if (!files.hasNext()) { Logger.log('Response spreadsheet not found.'); return; }
  var ss = SpreadsheetApp.open(files.next());
  var sheet = ss.getSheetByName('SUS Analysis');
  if (!sheet) { Logger.log('SUS Analysis sheet not found.'); return; }

  sheet.getCharts().forEach(function (c) { sheet.removeChart(c); });

  sheet.insertChart(sheet.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(sheet.getRange('F10:G15'))
    .setPosition(2, 9, 0, 0)
    .setOption('title', 'SUS responses — positive statements')
    .setOption('hAxis', { title: 'Percentage of users who agreed' })
    .setOption('vAxis', { title: 'Statements' })
    .setOption('colors', ['#3b82f6'])
    .setOption('legend', { position: 'none' })
    .setOption('width', 560).setOption('height', 300)
    .build());

  sheet.insertChart(sheet.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(sheet.getRange('F19:G24'))
    .setPosition(20, 9, 0, 0)
    .setOption('title', 'SUS responses — negative statements')
    .setOption('hAxis', { title: 'Percentage of users who agreed' })
    .setOption('vAxis', { title: 'Statements' })
    .setOption('colors', ['#b91c1c'])
    .setOption('legend', { position: 'none' })
    .setOption('width', 560).setOption('height', 300)
    .build());

  Logger.log('Charts added: ' + ss.getUrl());
}

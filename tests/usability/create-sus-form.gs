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
 * RUN `createSusForm` ONCE, AND ONCE ONLY
 *   It builds a new form and a new spreadsheet every time. It cannot adopt the
 *   ones you already have, so a second run leaves your responses stranded in
 *   the old file behind a form nobody is answering. Every other function here
 *   works on the study you already have.
 *
 * IF THE SCORES STAY ON ZERO
 *   Run `repairAnalysisSheet` — not `createSusForm`. Google adds the response
 *   tab a moment after the form is linked, so on a first run the scoring
 *   formulas can end up pointing at a tab or columns that do not exist yet, and
 *   they then read as blank for ever. The repair rebuilds them against the
 *   sheet as it actually is now, and prints what it found in the Execution log.
 *
 * IF YOU ALREADY RAN IT TWICE
 *   Run `listSusFiles`. It prints every form and spreadsheet of this study with
 *   its id, creation date and response count, so you can tell the one holding
 *   your responses from the empty duplicate. Paste that spreadsheet's id into
 *   SHEET_ID below, run `repairAnalysisSheet`, then bin the empty pair.
 *
 * The ten statements are Brooke's originals and their order matters — odd items
 * are positive, even items are negative, and the scoring assumes that. Do not
 * reorder them.
 */

/**
 * Leave blank normally. Paste the response spreadsheet's id here only if
 * `repairAnalysisSheet` reports more than one file with the same name and picks
 * the wrong one. The id is the long string in the sheet URL between /d/ and
 * /edit.
 */
var SHEET_ID = '';

/**
 * Safety catch on `createSusForm`. While false it refuses to run once a
 * response spreadsheet for this study already exists, which stops a second run
 * from orphaning the responses you have. Set it true only if you genuinely want
 * a second, separate study.
 */
var ALLOW_DUPLICATE_FORM = false;

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
  if (duplicateRunBlocked()) return null;

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
  addAnalysisSheet(sheet);

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


/**
 * `createSusForm` builds a new form and a new spreadsheet every run and cannot
 * adopt existing ones. A second run therefore strands the responses you have
 * already collected in the old file and hands out a form nobody is answering,
 * which is easy to do by accident when all you wanted was to update the script.
 * So refuse, and point at the function that does what was actually meant.
 */
function duplicateRunBlocked() {
  if (ALLOW_DUPLICATE_FORM) return false;

  var it = DriveApp.getFilesByName(FORM_TITLE + ' — Responses');
  var total = 0, withResponses = 0;
  while (it.hasNext()) {
    total++;
    var tab = findResponseSheet(SpreadsheetApp.open(it.next()));
    if (tab && tab.getLastRow() > 1) withResponses++;
  }
  if (!total) return false;

  Logger.log('STOPPED. You already have ' + total + ' response spreadsheet(s) for ' +
             'this study' +
             (withResponses ? ', ' + withResponses + ' of them holding responses' : '') + '.');
  Logger.log('');
  Logger.log('createSusForm always makes a NEW form and a NEW spreadsheet — it ' +
             'cannot update the ones you have, and running it again would leave ' +
             'your existing responses behind.');
  Logger.log('');
  Logger.log('  To fix scores stuck on zero : run repairAnalysisSheet');
  Logger.log('  To see every copy you have  : run listSusFiles');
  Logger.log('  To draw the charts          : run addCharts');
  Logger.log('');
  Logger.log('If you really do want a second, separate study, set ' +
             'ALLOW_DUPLICATE_FORM = true at the top of this file.');
  return true;
}

/**
 * Every form and spreadsheet of this study in your Drive, with response counts.
 * Run it after an accidental second `createSusForm` to tell the file holding
 * your responses from the empty duplicate.
 */
function listSusFiles() {
  Logger.log('SPREADSHEETS named "' + FORM_TITLE + ' — Responses"');
  var sheets = DriveApp.getFilesByName(FORM_TITLE + ' — Responses');
  var n = 0;
  while (sheets.hasNext()) {
    var file = sheets.next();
    var ss = SpreadsheetApp.open(file);
    var tab = findResponseSheet(ss);
    var rows = tab ? tab.getLastRow() - 1 : -1;
    Logger.log('');
    Logger.log('  [' + (++n) + '] ' +
               (rows < 0 ? 'no form-linked tab' : rows + ' response(s)') +
               (rows > 0 ? '   <-- KEEP THIS ONE' : ''));
    Logger.log('      created  ' + file.getDateCreated());
    Logger.log('      id       ' + file.getId());
    Logger.log('      open     ' + ss.getUrl());
  }
  if (!n) Logger.log('  (none)');

  Logger.log('');
  Logger.log('FORMS named "' + FORM_TITLE + '"');
  var forms = DriveApp.getFilesByName(FORM_TITLE);
  var m = 0;
  while (forms.hasNext()) {
    var ffile = forms.next();
    Logger.log('');
    Logger.log('  [' + (++m) + '] created ' + ffile.getDateCreated());
    Logger.log('      id       ' + ffile.getId());
    try {
      var form = FormApp.openById(ffile.getId());
      var count = form.getResponses().length;
      Logger.log('      answers  ' + count + (count > 0 ? '   <-- KEEP THIS ONE' : ''));
      Logger.log('      share    ' + form.getPublishedUrl());
      var dest = null;
      try { dest = form.getDestinationId(); } catch (e) {}
      Logger.log('      writes to spreadsheet id ' + (dest || '(none)'));
    } catch (e) {
      Logger.log('      (could not open as a form: ' + e + ')');
    }
  }
  if (!m) Logger.log('  (none)');

  Logger.log('');
  Logger.log('Keep the form and spreadsheet that have responses — the share link ' +
             'your testers already have belongs to that form. Paste that ' +
             'spreadsheet id into SHEET_ID at the top of this file, run ' +
             'repairAnalysisSheet, then move the empty pair to the Drive bin.');
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

/** Creates the destination spreadsheet and returns it, response tab and all. */
function attachResponseSheet(form) {
  var ss = SpreadsheetApp.create(FORM_TITLE + ' — Responses');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  // setDestination returns before the response tab exists, and the tab exists
  // before its header row does. Both have to be there or the analysis sheet is
  // built against guesses.
  return waitForResponseSheet(ss.getId(), 60000);
}

/**
 * Re-opens the spreadsheet until the form-linked tab is there with a header
 * row, or the wait runs out. Returns the spreadsheet either way — the caller
 * logs the fallback rather than failing outright.
 */
function waitForResponseSheet(ssId, timeoutMs) {
  var deadline = new Date().getTime() + (timeoutMs || 60000);
  var ss;
  for (;;) {
    ss = SpreadsheetApp.openById(ssId);
    var sheet = findResponseSheet(ss);
    if (sheet && sheet.getLastColumn() > 1) return ss;
    if (new Date().getTime() >= deadline) {
      Logger.log('WARNING: the response tab did not appear within ' +
                 Math.round((timeoutMs || 60000) / 1000) + 's. Run ' +
                 'repairAnalysisSheet once the form has a response.');
      return ss;
    }
    Utilities.sleep(2000);
  }
}

/**
 * The sheet the form writes into. getFormUrl is the authoritative answer; the
 * name check is only for the case where the link has not propagated yet, and
 * covers both capitalisations Google has shipped.
 */
function findResponseSheet(ss) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getFormUrl()) return sheets[i];
  }
  for (var j = 0; j < sheets.length; j++) {
    var n = sheets[j].getName().toLowerCase();
    if (n.indexOf('form responses') === 0) return sheets[j];
  }
  return null;
}

/** Name of that sheet, falling back to Google's default. */
function findResponseSheetName(ss) {
  var sheet = findResponseSheet(ss);
  return sheet ? sheet.getName() : 'Form Responses 1';
}

/**
 * The response spreadsheet, for the functions you run on their own after the
 * form is out. Running createSusForm twice leaves two files with the same name
 * and the form only feeds one of them, so prefer the one holding responses and
 * say so when the choice was not clear-cut.
 */
function locateResponseSpreadsheet() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}

  var it = DriveApp.getFilesByName(FORM_TITLE + ' — Responses');
  var files = [];
  while (it.hasNext()) files.push(it.next());
  if (!files.length) {
    Logger.log('No spreadsheet named "' + FORM_TITLE + ' — Responses" in your Drive.');
    return null;
  }

  var best = null, bestRows = -1;
  for (var i = 0; i < files.length; i++) {
    var ss = SpreadsheetApp.open(files[i]);
    var sheet = findResponseSheet(ss);
    var rows = sheet ? sheet.getLastRow() - 1 : -1;
    if (files.length > 1) {
      Logger.log('  candidate ' + files[i].getId() + ' — ' +
                 (rows < 0 ? 'no form-linked tab' : rows + ' response(s)'));
    }
    if (rows > bestRows) { bestRows = rows; best = ss; }
  }
  if (files.length > 1) {
    Logger.log('WARNING: ' + files.length + ' spreadsheets share that name. Using ' +
               best.getId() + '. If that is the wrong one, paste the right id ' +
               'into SHEET_ID at the top of this file and run again.');
  }
  return best;
}

/**
 * Rebuilds the SUS Analysis sheet against the response tab as it stands today.
 * Run this if the scores sit on zero while responses are coming in: the
 * formulas written at creation time hard-code a tab name and ten column
 * letters, and if either was guessed wrong they read as blank for ever. Safe to
 * run repeatedly.
 */
function repairAnalysisSheet() {
  var ss = locateResponseSpreadsheet();
  if (!ss) return;

  var sheet = findResponseSheet(ss);
  Logger.log('Spreadsheet  : ' + ss.getName());
  Logger.log('               ' + ss.getUrl());
  if (!sheet) {
    Logger.log('No tab in this file is linked to a form, so nothing is being ' +
               'written here. Open the form, go to Responses, and check which ' +
               'spreadsheet it points at.');
    return;
  }

  var rows = sheet.getLastRow() - 1;
  Logger.log('Response tab : "' + sheet.getName() + '" — ' + rows + ' response(s), ' +
             sheet.getLastColumn() + ' columns');
  if (rows < 1) {
    Logger.log('That tab is empty. The responses you can see are going to a ' +
               'different file — open the form, Responses, and unlink then ' +
               'relink it to this spreadsheet.');
    return;
  }

  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (var c = 0; c < header.length; c++) {
    Logger.log('   ' + columnLetter(c + 1) + '  ' + header[c]);
  }

  addAnalysisSheet(ss);
  SpreadsheetApp.flush();
  Logger.log('SUS Analysis rebuilt against "' + sheet.getName() + '".');
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
    Logger.log('WARNING: found ' + cols.length + ' of the 10 statement columns in ' +
               'the header row — falling back to F–O. If the scores come out wrong ' +
               'or stay on zero, run repairAnalysisSheet once a response has landed.');
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
 * Adds a sheet that scores responses live, replacing any earlier one so the
 * repair path can reuse it.
 *
 * SUS scoring: odd statements contribute (answer - 1), even ones (5 - answer);
 * the ten contributions are summed and multiplied by 2.5, giving 0-100.
 * Checked against the Satori reference workbook — all 20 of its participant
 * scores and its 64.5 average reproduce exactly.
 */
function addAnalysisSheet(ss) {
  var sheetName = findResponseSheetName(ss);
  var src = "'" + sheetName.replace(/'/g, "''") + "'";
  var Q = findStatementColumns(ss, sheetName);
  var roleCol = findColumnByHeader(ss, sheetName, 'Your role', 'C');

  var existing = ss.getSheetByName('SUS Analysis');
  if (existing) ss.deleteSheet(existing);
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
  // The timestamp copies across as a raw date serial, so say how to show it.
  sheet.getRange('B12:B').setNumberFormat('d mmm yyyy, HH:mm');
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
  var ss = locateResponseSpreadsheet();
  if (!ss) return;
  var sheet = ss.getSheetByName('SUS Analysis');
  if (!sheet) { Logger.log('No SUS Analysis sheet — run repairAnalysisSheet first.'); return; }

  sheet.getCharts().forEach(function (c) { sheet.removeChart(c); });

  sheet.insertChart(sheet.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(sheet.getRange('F10:G15'))
    .setNumHeaders(1)
    .setPosition(2, 9, 0, 0)
    .setOption('title', 'SUS responses — positive statements')
    .setOption('hAxis', { title: 'Percentage of users who agreed',
                          viewWindow: { min: 0, max: 100 } })
    .setOption('vAxis', { title: 'Statements' })
    .setOption('colors', ['#3b82f6'])
    .setOption('legend', { position: 'none' })
    .setOption('width', 560).setOption('height', 300)
    .build());

  sheet.insertChart(sheet.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(sheet.getRange('F19:G24'))
    .setNumHeaders(1)
    .setPosition(20, 9, 0, 0)
    .setOption('title', 'SUS responses — negative statements')
    .setOption('hAxis', { title: 'Percentage of users who agreed',
                          viewWindow: { min: 0, max: 100 } })
    .setOption('vAxis', { title: 'Statements' })
    .setOption('colors', ['#b91c1c'])
    .setOption('legend', { position: 'none' })
    .setOption('width', 560).setOption('height', 300)
    .build());

  Logger.log('Charts added: ' + ss.getUrl());
}

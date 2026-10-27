/**
 * B.B.B.B 50 RSVP backend
 * Paste into the Sheet's Apps Script editor (Extensions > Apps Script).
 * Run setup() once, then Deploy > New deployment > Web app.
 */

const SHEET_NAME = 'RSVPs';
const NOTIFY_EMAIL = '';   // Optional: your email to get a ping on every RSVP. Leave '' to switch off.
const MAX_GUESTS = 6;
const FROM_EMAIL = 'bbbb50@brad-wright.com';   // Gmail 'Send mail as' alias. Falls back to your Gmail if the alias isn't found.
const DAILY_EMAIL_CAP = 60;   // Stops a bot burning the ~100/day Gmail limit. Real RSVPs still save if hit.
const SITE = 'https://bbbb50.brad-wright.com';
const ICS_URL = SITE + '/BBBB50.ics';   // hosted calendar file, replaces the attachment
const LOGO_URL = SITE + '/assets/bbbb50-still.jpg';   // the B.B.B.B Fifty mark, already live on the site
const MAP_URL = 'https://www.google.com/maps/search/?api=1&query=Sofitel+Sydney+Wentworth+61-101+Phillip+St+Sydney+NSW+2000';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EVENT = {
  title: "B.B.B.B 50 – Brad’s Big Birthday Bash",
  when: 'Saturday 21 November 2026, 2pm to 6pm',
  where: 'Wentworth Bar (Level 5), Sofitel Sydney Wentworth, 61–101 Phillip Street, Sydney NSW 2000',
  startUtc: '20261121T030000Z',  // 2pm AEDT
  endUtc: '20261121T070000Z',    // 6pm AEDT
  dress: 'Garden party vibes. The Wentworth Bar has covered areas, so we’re on rain or shine.'
};

const HEADERS = ['Received', 'Name', 'Mobile', 'Email', 'Coming?', 'Plus', 'Party size',
                 'Arrival', 'Message for Brad', 'Updated'];
const COL = { mobile: 3, email: 4, attending: 5, message: 9, updated: 10 };  // 1-based

/** Run once from the editor to create the tab and headers. Safe to run again. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sheet.getRange(1, 1, 1, sheet.getMaxColumns()).clearContent();  // clears old headers
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
  sheet.getRange('C:C').setNumberFormat('@');  // keep the leading 0 on mobiles
  sheet.setFrozenRows(1);
}

/** Health check: open the web app URL in a browser to confirm it's live. */
function doGet() {
  return ContentService.createTextOutput('B.B.B.B 50 RSVP endpoint is live.');
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const p = (e && e.parameter) || {};
    if (p.website) return json_({ ok: true });  // spam trap filled in: ignore quietly

    const name = clean_(p.name, 80);
    const rawMobile = clean_(p.mobile, 20);
    const mobile = mobileKey_(rawMobile).length >= 8 ? rawMobile : '';   // optional
    const rawEmail = clean_(p.email, 120);
    const email = EMAIL_RE.test(rawEmail) ? rawEmail : '';               // optional
    const attending = ['Yes', 'Maybe', 'No'].indexOf(p.attending) > -1 ? p.attending : '';
    if (!name || !attending || (!mobile && !email)) return json_({ ok: false, error: 'Missing fields' });

    const guests = attending === 'No' ? 0 : Math.max(0, Math.min(MAX_GUESTS, parseInt(p.guests, 10) || 0));
    const party = attending === 'No' ? 0 : guests + 1;
    const message = clean_(p.message, 1000);
    const now = new Date();

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const found = findRow_(sheet, mobile, email);
    let changed = true;

    if (found) {
      // Same mobile or email as an earlier RSVP: update that row so the headcount stays right.
      const old = found.values;
      changed = old[COL.attending - 1] !== attending;
      const row = [old[0], name, mobileCell_(mobile) || old[COL.mobile - 1], email || old[COL.email - 1], attending, guests, party,
                   clean_(p.arrival, 20), message || old[COL.message - 1], now];
      sheet.getRange(found.index, 1, 1, row.length).setValues([row.map(safeCell_)]);
    } else {
      const row = [now, name, mobileCell_(mobile), email, attending, guests, party,
                   clean_(p.arrival, 20), message, ''];
      sheet.appendRow(row.map(safeCell_));
    }

    if (attending !== 'No' && email && okToEmail_(email, attending)) sendConfirmation_(name, email, attending, party);
    if (NOTIFY_EMAIL) {
      MailApp.sendEmail(NOTIFY_EMAIL,
        `${found ? 'Updated RSVP' : 'RSVP'}: ${name} – ${attending}${party > 1 ? ' (party of ' + party + ')' : ''}`,
        [`Mobile: ${mobile}`, `Email: ${email}`, `Arrival: ${clean_(p.arrival, 20)}`, `Message: ${message}`,
         found && changed ? 'Changed their answer.' : ''].join('\n'));
    }
    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Something went wrong' });
  } finally {
    lock.releaseLock();
  }
}

/** Finds an earlier RSVP with the same mobile (last 9 digits) or email. */
function findRow_(sheet, mobile, email) {
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const values = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  const mKey = mobileKey_(mobile), eKey = email.toLowerCase();
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if ((mKey && mobileKey_(String(v[COL.mobile - 1])) === mKey) ||
        (eKey && String(v[COL.email - 1]).toLowerCase() === eKey)) {
      return { index: i + 2, values: v };
    }
  }
  return null;
}
function mobileKey_(m) { return String(m || '').replace(/\D/g, '').slice(-9); }

function sendConfirmation_(name, email, attending, party) {
  const first = esc_(name.split(/\s+/)[0]);
  const yes = attending === 'Yes';
  const intro = yes ? `You’re in, ${first}.` : `Noted as a maybe, ${first}.`;
  const lede = yes
    ? 'Thanks for your RSVP.<br>Here are the details to keep handy.'
    : 'No stress.<br>Here are the details in case you can make it.';
  const partyLine = party > 1 ? `<br>Party of ${party}.` : '';
  const gcal = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + '&text=' + encodeURIComponent(EVENT.title)
    + '&dates=' + EVENT.startUtc + '/' + EVENT.endUtc
    + '&details=' + encodeURIComponent('Bar tab from 2pm. Snacks from 3pm. Happy hour from 4pm. Garden party vibes. ' + SITE)
    + '&location=' + encodeURIComponent(EVENT.where);

  // Light, email-safe palette from the brand: Eerie Black text on white, Crusta for actions,
  // French Wine for labels (Turquoise only works on black, so it's out here).
  const C = { ink: '#1B1B1B', soft: '#55505A', line: '#ECE6E6', page: '#F7F3F3', card: '#FFFFFF',
              label: '#AC1E44', crusta: '#FF7E2C' };
  const font = "Montserrat,'Helvetica Neue',Helvetica,Arial,sans-serif";
  const label = `margin:0 0 4px;font-size:12px;line-height:16px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${C.label}`;
  const body = `margin:0;font-size:16px;line-height:24px;color:${C.ink}`;
  const small = `margin:0;font-size:14px;line-height:21px;color:${C.soft}`;
  // Every detail uses one text style, one sentence per line.
  const row = (title, lines) => `
          <tr><td style="padding:0 0 20px">
            <p style="${label}">${title}</p>
            <p style="${body}">${lines.join('<br>')}</p>
          </td></tr>`;
  const btn = (href, text, solid) => `<a href="${href}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 22px;border-radius:999px;font-family:${font};font-size:15px;line-height:20px;font-weight:600;text-decoration:none;`
    + (solid ? `background:${C.crusta};color:${C.ink};border:1px solid ${C.crusta}` : `background:${C.card};color:${C.ink};border:1px solid ${C.ink}`)
    + `">${text}</a>`;

  const html = `<!DOCTYPE html>
<html lang="en-AU"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>B.B.B.B 50</title>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${yes ? 'See you Saturday 21 November, 2pm to 6pm, Wentworth Bar.' : 'Saturday 21 November, 2pm to 6pm, Wentworth Bar. RSVP by Sat 14 Nov.'}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page}">
  <tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:${C.card};border:1px solid ${C.line};border-radius:16px;font-family:${font}">
      <tr><td style="padding:0">
        <a href="${SITE}" style="display:block;text-decoration:none"><img src="${LOGO_URL}" width="560" alt="B.B.B.B FIFTY" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:15px 15px 0 0;background:#000000;color:#FFFDFD;font-family:${font};font-size:22px;letter-spacing:0.3em;text-align:center"></a>
      </td></tr>
      <tr><td style="padding:28px 28px 8px">
        <p style="margin:0 0 12px;font-size:12px;line-height:16px;font-weight:600;letter-spacing:0.3em;color:${C.soft}">BRAD’S BIG BIRTHDAY BASH</p>
        <h1 style="margin:0 0 12px;font-family:${font};font-size:28px;line-height:34px;font-weight:400;color:${C.ink}">${intro}</h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:24px;color:${C.soft}">${lede}${partyLine}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.line}">
          <tr><td style="padding:20px 0 0"></td></tr>${
          row('When', ['Saturday 21 November', '2:00pm to 6:00pm'])}${
          row('Where', ['Wentworth Bar', 'Sofitel Sydney Wentworth', `<a href="${MAP_URL}" style="color:${C.ink};text-decoration:underline">Level 5, 61–101 Phillip St, Sydney</a>`])}${
          row('What’s on', ['Bar tab from 2pm until it runs out.', 'Snacks from 3pm.', 'Happy hour from 4pm.'])}${
          row('Dress code', ['Garden party vibes.', 'The Wentworth Bar has covered areas, so we’re on rain or shine.'])}${
          row('Getting there', ['Martin Place train station is a short walk.', 'The Metro is across the road.', 'Plenty of CBD bus routes.', 'Paid parking close by.', 'Lift access to Level 5.'])}${
          row('Dietary needs or allergies?', ['Reply to this email so Brad can sort the snacks.'])}
        </table>
      </td></tr>
      <tr><td style="padding:4px 28px 20px;border-top:1px solid ${C.line}">
        <p style="${label};margin:20px 0 12px">Add it to your calendar</p>
        ${btn(ICS_URL, 'Add to calendar', true)}${btn(gcal, 'Google Calendar', false)}
        <p style="${small};margin:4px 0 0">On an iPhone or Mac? Use Add to calendar.<br>Google Calendar asks you to sign in to Google.</p>
      </td></tr>
      <tr><td style="padding:20px 28px 28px;border-top:1px solid ${C.line}">
        <p style="${body}">Plans change?<br>Reply to this email or <a href="${SITE}/#rsvp" style="color:${C.ink};text-decoration:underline">RSVP again</a> with the same mobile or email.</p>
        <p style="${body};margin-top:16px">See you at the Wentworth Bar.<br>Brad</p>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;font-family:${font}">
      <tr><td style="padding:16px 28px 0;font-size:12px;line-height:18px;color:${C.soft}">
        B.B.B.B 50. Fifty years in the making.<br>
        <a href="${SITE}/memories.html" style="color:${C.soft};text-decoration:underline">See the memories.</a><br><br>
        Your RSVP sits in a private Google Sheet only Brad can see.<br>
        It will be deleted by 1 December 2026.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const text = [
    yes ? `You’re in, ${name.split(/\s+/)[0]}.` : `Noted as a maybe, ${name.split(/\s+/)[0]}.`,
    party > 1 ? `Party of ${party}.` : null,
    '',
    'When: Saturday 21 November, 2:00pm to 6:00pm',
    'Where: Wentworth Bar, Sofitel Sydney Wentworth. Level 5, 61–101 Phillip St, Sydney',
    'What’s on: Bar tab from 2pm until it runs out. Snacks from 3pm. Happy hour from 4pm.',
    'Dress code: ' + EVENT.dress,
    'Getting there: Martin Place station is a short walk. The Metro is across the road. Lift access to Level 5.',
    '',
    'Add to calendar (Apple or Outlook): ' + ICS_URL,
    'Google Calendar (needs a Google sign-in): ' + gcal,
    '',
    'Dietary needs or allergies? Reply to this email.',
    'Plans change? Reply to this email or RSVP again at ' + SITE + ' with the same mobile or email.',
    '',
    'See you at the Wentworth Bar.',
    'Brad'
  ].filter(l => l !== null).join('\n');

  const opts = { htmlBody: html, name: 'Brad Wright', replyTo: FROM_EMAIL };
  if (GmailApp.getAliases().indexOf(FROM_EMAIL) > -1) opts.from = FROM_EMAIL;

  const subject = yes ? 'You’re in: Brad’s 50th, Sat 21 Nov' : 'Noted as a maybe: Brad’s 50th, Sat 21 Nov';
  GmailApp.sendEmail(email, subject, text, opts);
}

/* ---------- helpers ---------- */
// One invite per address, and a daily cap. Logs a skip so Brad can follow up by text.
function okToEmail_(email, attending) {
  const props = PropertiesService.getScriptProperties();
  const key = 'sent:' + email.toLowerCase() + ':' + attending;   // new invite only when the answer changes
  if (props.getProperty(key)) return false;
  const dayKey = 'count:' + Utilities.formatDate(new Date(), 'Australia/Sydney', 'yyyyMMdd');
  const count = Number(props.getProperty(dayKey) || 0);
  if (count >= DAILY_EMAIL_CAP || MailApp.getRemainingDailyQuota() < 5) {
    console.warn('Email cap reached, skipped: ' + email);
    return false;
  }
  props.setProperty(key, '1');
  props.setProperty(dayKey, String(count + 1));
  return true;
}
// Keeps the leading 0 on mobiles, even if the column loses its text format.
function mobileCell_(m) { return m ? "'" + m : ''; }

/** Testing helper: run from the editor to let the same email get a confirmation again. */
function resetEmailLog() {
  const props = PropertiesService.getScriptProperties();
  Object.keys(props.getProperties()).forEach(k => { if (k.indexOf('sent:') === 0) props.deleteProperty(k); });
  console.log('Email log cleared. Test RSVPs will send again.');
}
function clean_(v, max) { return String(v || '').trim().slice(0, max); }
// Stops typed text being read as a spreadsheet formula.
function safeCell_(v) { return (typeof v === 'string' && /^[=+\-@]/.test(v)) ? "'" + v : v; }
function esc_(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

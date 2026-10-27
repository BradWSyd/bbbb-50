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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EVENT = {
  title: "B.B.B.B 50 – Brad’s Big Birthday Bash",
  when: 'Saturday 21 November 2026, 2pm to 6pm',
  where: 'Wentworth Bar (Level 5), Sofitel Sydney Wentworth, 61-101 Phillip Street, Sydney NSW 2000',
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
  const first = name.split(/\s+/)[0];
  const intro = attending === 'Yes'
    ? `You’re in, ${first}.`
    : `Noted as a maybe, ${first}. Let Brad know if that changes.`;
  const partyLine = party > 1 ? `<p style="margin:0 0 16px">Party of ${party}.</p>` : '';
  const gcal = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + '&text=' + encodeURIComponent(EVENT.title)
    + '&dates=' + EVENT.startUtc + '/' + EVENT.endUtc
    + '&details=' + encodeURIComponent('Bar tab from 2pm. Snacks from 3pm. Happy hour from 4pm. Garden party vibes. ' + SITE)
    + '&location=' + encodeURIComponent(EVENT.where);
  const btn = 'display:inline-block;margin:0 8px 8px 0;padding:12px 20px;border-radius:999px;font-weight:600;text-decoration:none;';

  const html = `
  <div style="background:#000000;color:#FFFDFD;font-family:Montserrat,Helvetica,Arial,sans-serif;padding:32px 24px;line-height:1.55">
    <p style="margin:0 0 8px;letter-spacing:0.3em;font-size:12px">B.B.B.B 50</p>
    <h1 style="margin:0 0 16px;font-weight:300;font-size:28px;color:#71E6E8">${esc_(intro)}</h1>
    ${partyLine}
    <p style="margin:0 0 4px"><b>When</b></p>
    <p style="margin:0 0 16px">${EVENT.when}. Drop in, drop out.</p>
    <p style="margin:0 0 4px"><b>Where</b></p>
    <p style="margin:0 0 16px">${EVENT.where}</p>
    <p style="margin:0 0 4px"><b>What’s on</b></p>
    <p style="margin:0 0 16px">Bar tab from 2pm until it runs out. Snacks from 3pm. Happy hour from 4pm.</p>
    <p style="margin:0 0 4px"><b>Dress code</b></p>
    <p style="margin:0 0 16px">${EVENT.dress}</p>
    <p style="margin:0 0 4px"><b>Dietary needs or allergies?</b></p>
    <p style="margin:0 0 24px">Just reply to this email so Brad can sort the snacks.</p>
    <p style="margin:0 0 8px"><b>Add it to your calendar</b></p>
    <p style="margin:0 0 24px">
      <a href="${ICS_URL}" style="${btn}background:#FF7E2C;color:#000000">Apple or Outlook calendar</a>
      <a href="${gcal}" style="${btn}border:1px solid #FFFDFD;color:#FFFDFD">Google Calendar</a>
    </p>
    <p style="margin:-16px 0 24px;font-size:13px;color:rgba(255,253,253,0.66)">On an iPhone or Mac? Use the first button. Google Calendar asks you to sign in to Google.</p>
    <p style="margin:0;color:rgba(255,253,253,0.66)">Plans change? RSVP again at <a href="${SITE}" style="color:#FFFDFD">${SITE.replace('https://', '')}</a> with the same mobile or email. See you on the terrace.</p>
  </div>`;

  const opts = { htmlBody: html, name: 'Brad Wright', replyTo: FROM_EMAIL };
  if (GmailApp.getAliases().indexOf(FROM_EMAIL) > -1) opts.from = FROM_EMAIL;

  GmailApp.sendEmail(email, 'You’re on the list: B.B.B.B 50, Sat 21 Nov',
    `${intro}\n\nWhen: ${EVENT.when}\nWhere: ${EVENT.where}\nDress code: ${EVENT.dress}\n\n`
    + `Apple or Outlook calendar: ${ICS_URL}\nGoogle Calendar (needs a Google sign-in): ${gcal}\n\n`
    + `Dietary needs or allergies? Just reply to this email.\nPlans change? RSVP again at ${SITE}`, opts);
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

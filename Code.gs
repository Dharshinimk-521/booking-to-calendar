
function parseBookingEmails() {
  processIRCTC();
  processKSRTC();
  processForwarded();
}

function gmailButton(threadId) {
  const link = `https://mail.google.com/mail/u/0/#all/${threadId}`;
  return `\n🔗 Open Confirmation Email:\n${link}`;
}

const REMINDERS = {
  useDefault: false,
  overrides: [
    { method: 'email', minutesBeforeStart: 5 * 24 * 60 },
    { method: 'popup', minutesBeforeStart: 5 * 24 * 60 },
    { method: 'email', minutesBeforeStart: 3 * 24 * 60 },
    { method: 'popup', minutesBeforeStart: 3 * 24 * 60 },
    { method: 'email', minutesBeforeStart: 1 * 24 * 60 },
    { method: 'popup', minutesBeforeStart: 1 * 24 * 60 },
    { method: 'popup', minutesBeforeStart: 60 }
  ]
};

// KSRTC BODY PARSER 
function parseKSRTCBody(body) {

  const pnrMatch       = body.match(/PNR\s*No\.?\s*[:\s]+([A-Z0-9]+)/i);
  const dateMatch      = body.match(/Date of Journey\s*[:\s]+(\d{1,2}-\w+-\d{4})/i);
  const departureMatch = body.match(/Departure Time\s*[:\s]+(\d{1,2}:\d{2})\s*hrs/i);
  const fromMatch      = body.match(/Start Place\s*[:\s]+([A-Z][A-Z\s]+)/i);
  const toMatch        = body.match(/End Place\s*[:\s]+([A-Z][A-Z\s]+)/i);
  const seatMatch      = body.match(/Seat\s*No[^:\d]*[:\s]+(\d+)/i);
  const classMatch     = body.match(/Class of Service\s*[:\s]+([^\n\r]+)/i);

  const pnr      = pnrMatch       ? pnrMatch[1].trim()   : 'N/A';
  const dateStr  = dateMatch      ? dateMatch[1]         : null;
  const timeStr  = departureMatch ? departureMatch[1]    : '00:00';
  const fromCity = fromMatch      ? fromMatch[1].trim()  : 'N/A';
  const toCity   = toMatch        ? toMatch[1].trim()    : 'N/A';
  const seat     = seatMatch      ? seatMatch[1].trim()  : 'N/A';
  const busClass = classMatch     ? classMatch[1].trim() : 'N/A';

  let eventDate = dateStr ? new Date(dateStr) : new Date();
  if (!isNaN(eventDate) && timeStr) {
    const [hours, mins] = timeStr.split(':').map(Number);
    eventDate.setHours(hours, mins, 0, 0);
  }
  if (isNaN(eventDate)) eventDate = new Date();

  const endDate = new Date(eventDate.getTime() + 6 * 60 * 60 * 1000);

  return { pnr, fromCity, toCity, timeStr, seat, busClass, eventDate, endDate };
}
// IRCTC BODY PARSER
function parseIRCTCBody(subject, body) {

  const NEXT_FIELDS = 'PNR|Train No|Quota|Transaction|Date & Time|Class|From|Date of Journey|To\\b|Boarding At|Date Of Boarding|Scheduled Departure|Reservation Up to|Scheduled Arrival|Adult|Passenger Mobile|Distance|Insurance';

  function extract(label) {
    const rx = new RegExp(
      label + '\\s*[:\\t\\s]+([\\s\\S]+?)(?=' + NEXT_FIELDS + '|$)',
      'i'
    );
    const m = body.match(rx);
    return m ? m[1].replace(/[\*\s]+$/, '').trim() : null;
  }

  // ── PNR ──
  const pnrRaw = extract('PNR\\s*No\\.?');
  const pnr    = pnrRaw ? (pnrRaw.match(/(\d{9,10})/) || [])[1] || 'N/A' : 'N/A';

  // ── Train No ──
  const trainRaw    = extract('Train\\s*No\\.?\\s*\\/\\s*Name');
  const trainNo     = trainRaw ? (trainRaw.match(/(\d+)/) || [])[1] || 'Unknown' : 'Unknown';
  const trainSubMatch = subject.match(/Train:\s*(\d+)/i);
  const finalTrainNo  = trainNo !== 'Unknown' ? trainNo : (trainSubMatch ? trainSubMatch[1] : 'Unknown');

  // ── Class ──
  const classRaw    = extract('Class');
  const travelClass = classRaw ? classRaw.replace(/[^A-Z\s]/gi, '').trim() : 'N/A';

  // ── From/To ──
  const subjectFlat = subject.replace(/[\n\r]+/g, ' ');
  const subjectRouteMatch = subjectFlat.match(/,\s*[0-9]{1,2}-[A-Za-z]{3}-[0-9]{4},\s*[A-Z0-9]+,\s*([A-Z]{2,5})\s*-\s*([A-Z]{2,5})/i)
                          || subjectFlat.match(/,\s*([A-Z]{2,5})\s*-\s*([A-Z]{2,5})/i);

  const fromStn = subjectRouteMatch ? subjectRouteMatch[1] : (
    (extract('From') || '').match(/\(([A-Z]{2,5})\)/)?.[1] || 'N/A'
  );

  const toStn = subjectRouteMatch ? subjectRouteMatch[2] : (
    (extract('\\bTo') || '').match(/\(([A-Z]{2,5})\)/)?.[1] || 'N/A'
  );

  // ──  DIRECT regex for departure (no extract dependency) ──
  const departureMatch = body.match(/Scheduled Departure\*?\s*:[\s\S]*?(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(\d{2}:\d{2})/i);
  const arrivalMatch   = body.match(/Scheduled Arrival\s*[:\s]+(\d{1,2}-[A-Za-z]{3}-\d{4})\s+(\d{2}:\d{2})/i);
  const journeyMatch   = body.match(/Date of Journey\s*[:\s]+(\d{1,2}-[A-Za-z]{3}-\d{4})/i);

  function makeDate(d, t) {
    const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
    const [day, mon, year] = d.split('-');
    let h = 0, m = 0;
    if (t) [h, m] = t.split(':').map(Number);
    return new Date(+year, months[mon], +day, h, m);
  }

  let eventDate = null;
  if (departureMatch) {
    eventDate = makeDate(departureMatch[1], departureMatch[2]); 
  } else if (journeyMatch) {
  eventDate = makeDate(journeyMatch[1], "22:40"); // fallback with time
}

  let endDate = null;
  if (arrivalMatch) {
    endDate = makeDate(arrivalMatch[1], arrivalMatch[2]);
  } else if (eventDate) {
    endDate = new Date(eventDate.getTime() + 6 * 60 * 60 * 1000);
  }

  // --seat extraction ──
  let seats = [];
  const passengerBlock = body.split('Passenger Details')[1];

  if (passengerBlock) {
    const lines = passengerBlock.split('\n');

    lines.forEach(line => {
      const m = line.match(/\b(?:CNF|WL|RAC)\b\s+([A-Z]\d+)?\s+(\d{1,3})\b/);
      if (m) seats.push(m[2]); // full number only
    });
  }

  const seat = seats.length ? seats.join(',') : 'N/A';

  // ── Coach ──
  const coachMatch = body.match(/(?:CNF|WL|RAC)\s*([A-Z]\d+)/i);
  const coach      = coachMatch ? coachMatch[1] : 'N/A';

  Logger.log(`IRCTC parse → train:${finalTrainNo} from:${fromStn} to:${toStn} class:${travelClass} pnr:${pnr} coach:${coach} seat:${seat} date:${eventDate}`);

  return { trainNo: finalTrainNo, travelClass, fromStn, toStn, pnr, coach, seat, eventDate, endDate };
}

//IRCTC FUNCTION 
function processIRCTC() {
  const label     = GmailApp.getUserLabelByName('irctc-booking');
  const doneLabel = GmailApp.getUserLabelByName('added-to-calendar');
  const calendar  = CalendarApp.getDefaultCalendar();

  if (!label) { Logger.log('irctc-booking label not found'); return; }

  label.getThreads().forEach(thread => {
    if (thread.getLabels().some(l => l.getName() === 'added-to-calendar')) return;

    const msg     = thread.getMessages()[0];
    const subject = msg.getSubject();
    const body    = msg.getPlainBody();

    const d = parseIRCTCBody(subject, body);

    if (!d.eventDate) {
      Logger.log(`IRCTC: No date found. Skipping: ${subject}`);
      thread.addLabel(doneLabel);
      return;
    }

    const title = `🚂 Train ${d.trainNo} | ${d.fromStn} → ${d.toStn} | ${d.travelClass}`;
    const description = [
      `PNR: ${d.pnr}`,
      `Train: ${d.trainNo}`,
      `From: ${d.fromStn} → To: ${d.toStn}`,
      `Coach: ${d.coach} | Seat: ${d.seat}`,
      `Class: ${d.travelClass}`,
      gmailButton(thread.getId())
    ].join('\n');

    calendar.createEvent(title, d.eventDate, d.endDate, {
      description,
      reminders: REMINDERS
    });

    Logger.log(`IRCTC: ${title} | ${d.eventDate}`);
    thread.addLabel(doneLabel);
  });
}

// KSRTC FUNCTION 
function processKSRTC() {
  const label     = GmailApp.getUserLabelByName('ksrtc-booking');
  const doneLabel = GmailApp.getUserLabelByName('added-to-calendar');
  const calendar  = CalendarApp.getDefaultCalendar();

  if (!label) { Logger.log('ksrtc-booking label not found'); return; }

  label.getThreads().forEach(thread => {
    if (thread.getLabels().some(l => l.getName() === 'added-to-calendar')) return;

    const msg  = thread.getMessages()[0];
    const body = msg.getPlainBody();

    const d = parseKSRTCBody(body);

    const title = `🚌 KSRTC Bus | ${d.fromCity} → ${d.toCity}`;
    const description = [
      `PNR: ${d.pnr}`,
      `From: ${d.fromCity} → To: ${d.toCity}`,
      `Departure: ${d.timeStr} hrs`,
      `Seat: ${d.seat}`,
      `Class: ${d.busClass}`,
      gmailButton(thread.getId())
    ].join('\n');

    calendar.createEvent(title, d.eventDate, d.endDate, {
      description,
      reminders: REMINDERS
    });

    Logger.log(`KSRTC: ${title} | ${d.eventDate}`);
    thread.addLabel(doneLabel);
  });
}

// FORWARDED FUNCTION
function processForwarded() {
  const label     = GmailApp.getUserLabelByName('forwarded-mail');
  const doneLabel = GmailApp.getUserLabelByName('added-to-calendar');
  const calendar  = CalendarApp.getDefaultCalendar();

  if (!label) { Logger.log('forwarded-mail label not found'); return; }

  label.getThreads().forEach(thread => {
    if (thread.getLabels().some(l => l.getName() === 'added-to-calendar')) return;

    const messages = thread.getMessages();
    const msg  = messages[0];
    const body = msg.getRawContent();


    const isIRCTC = body.includes('ticketadmin@irctc.co.in') ||
                    body.includes('Booking Confirmation on IRCTC') ||
                    body.includes('Scheduled Departure') ||
                    body.includes('IRCTC');

    const isKSRTC = body.includes('donotreply@ksrtc.org') ||
                    body.includes('KSRTC Bus Reservation') ||
                    body.includes('Karnataka State Road Transport') ||
                    (body.includes('Date of Journey') && body.includes('Departure Time'));

    // ───────── IRCTC (FIXED ONLY THIS PART) ─────────
    if (isIRCTC) {

      const subjectMatch = body.match(/Subject:\s*([\s\S]+?)\r?\nTo:/i);
      const extractedSubject = subjectMatch
        ? subjectMatch[1].replace(/\n/g, ' ').trim()
        : '';

      const d = parseIRCTCBody(extractedSubject, body);

      // fallback date WITH TIME (22:40 instead of 00:00)
      if (!d.eventDate && extractedSubject) {
        const m = extractedSubject.match(/(\d{1,2}-[A-Za-z]{3}-\d{4})/);
        if (m) {
          const [day, mon, year] = m[1].split('-');
          const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};

          const parsed = new Date(+year, months[mon], +day, 22, 40); // 
          if (!isNaN(parsed)) {
            d.eventDate = parsed;
            d.endDate = new Date(parsed.getTime() + 6 * 60 * 60 * 1000);
          }
        }
      }

      if (!d.eventDate) {
        Logger.log(`Forwarded IRCTC: No date found. Skipping. Snippet: ${body.substring(0, 300)}`);
        thread.addLabel(doneLabel);
        return;
      }

      const title = `🚂 Train ${d.trainNo} | ${d.fromStn} → ${d.toStn} | ${d.travelClass}`;
      const description = [
        `PNR: ${d.pnr}`,
        `Train: ${d.trainNo}`,
        `From: ${d.fromStn} → To: ${d.toStn}`,
        `Coach: ${d.coach} | Seat: ${d.seat}`,
        `Class: ${d.travelClass}`,
        `📨 via: Forwarded Email`,
        gmailButton(thread.getId())
      ].join('\n');

      calendar.createEvent(title, d.eventDate, d.endDate, {
        description,
        reminders: REMINDERS
      });

      Logger.log(`Forwarded IRCTC: ${title} | ${d.eventDate}`);
    }

    // KSRTC
    else if (isKSRTC) {

      const d = parseKSRTCBody(body);

      const title = `🚌 KSRTC Bus | ${d.fromCity} → ${d.toCity}`;
      const description = [
        `PNR: ${d.pnr}`,
        `From: ${d.fromCity} → To: ${d.toCity}`,
        `Departure: ${d.timeStr} hrs`,
        `Seat: ${d.seat}`,
        `Class: ${d.busClass}`,
        `📨 via: Forwarded Email`,
        gmailButton(thread.getId())
      ].join('\n');

      calendar.createEvent(title, d.eventDate, d.endDate, {
        description,
        reminders: REMINDERS
      });

      Logger.log(`Forwarded KSRTC: ${title} | ${d.eventDate}`);
    }

    else {
      Logger.log(`Could not detect type: ${msg.getSubject()}`);
    }

    thread.addLabel(doneLabel);
  });
}

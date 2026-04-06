# 📅 Booking To Calendar

Automatically parses IRCTC train and KSRTC bus booking confirmation emails from Gmail using regex expressions and creates Google Calendar events with smart reminders — no third-party tools, no API keys, runs free forever on Google's servers.

---

## 💡 What It Does

- Detects booking confirmation emails from **IRCTC** and **KSRTC** in your Gmail inbox
- Supports emails arriving **directly**, **forwarded via Cloudflare** custom domain, or **forwarded from another Gmail account**
- Parses journey details: train/bus number, route, PNR, coach, seat, departure & arrival times
- Creates a **Google Calendar event** on the exact journey date with full details
- Adds a **direct link** in the event description that opens the original confirmation email
- Sets **4 automatic reminders**: 5 days, 3 days, 1 day, and 1 hour before departure
- Runs automatically every 15 minutes via a time-based trigger — zero manual effort after setup

---

## 🗂️ Repo Structure

```
booking-to-calendar/
│
├── Code.gs              ← Main Apps Script (paste this into script.google.com)
└── README.md            ← This file
```

---

## ⚙️ Setup Steps

### Step 1 — Create Gmail Labels

Go to **Gmail → Settings → Labels → Create new label** and create these 4 labels:

| Label | Purpose |
|---|---|
| `irctc-booking` | Direct IRCTC confirmation emails |
| `ksrtc-booking` | Direct KSRTC confirmation emails |
| `forwarded-mail` | Emails forwarded from another account containing booking info |
| `added-to-calendar` | Auto-applied by script to prevent duplicate events |

---

### Step 2 — Create Gmail Filters

Go to **Gmail → Settings → Filters and Blocked Addresses → Create a new filter**

**Filter 1 — IRCTC direct:**
- From: `ticketadmin@irctc.co.in`
- Action: Apply label → `irctc-booking`
- Also apply to matching conversations ✅

**Filter 2 — KSRTC direct:**
- From: `donotreply@ksrtc.org`
- Action: Apply label → `ksrtc-booking`
- Also apply to matching conversations ✅

**Filter 3 — Forwarded bookings (from another Gmail/person):**
- From: `your-other-email@gmail.com` *(the account that forwards to you)*
- Has the words: `"From: <ticketadmin@irctc.co.in>" OR "From: Karnataka State Road Transport Corporation - KSRTC <donotreply@ksrtc.org>"`
- Action: Apply label → `forwarded-mail`
- Also apply to matching conversations ✅

> **Note on Cloudflare:** If your custom domain email (e.g. you@yourdomain.com) is set up with Cloudflare Email Routing to forward to Gmail, those emails arrive with the original sender intact (e.g. `ticketadmin@irctc.co.in`) so Filters 1 and 2 above catch them automatically — no extra filter needed.

---

### Step 3 — Set Up Google Apps Script

1. Go to [script.google.com](https://script.google.com)
2. Click **New Project**
3. Rename the project to `booking-to-calendar`
4. Delete all default code
5. Paste the entire contents of `Code.gs` from this repo
6. Click **Save** (Ctrl+S)
7. Click **Run ▶** on the `parseBookingEmails` function
8. Click **Review Permissions → Advanced → Go to booking-to-calendar (unsafe) → Allow**

---

### Step 4 — Set Automatic Trigger

1. In Apps Script, click the **clock icon** (Triggers) on the left sidebar
2. Click **+ Add Trigger** (bottom right)
3. Configure:
   - Function: `parseBookingEmails`
   - Deployment: `Head`
   - Event source: `Time-driven`
   - Type: `Minutes timer`
   - Interval: `Every 15 minutes`
4. Click **Save**

---

## 🔔 Reminder Schedule

Every calendar event created gets these automatic reminders:

| When | Type |
|---|---|
| 5 days before | Email + Popup |
| 3 days before | Email + Popup |
| 1 day before | Email + Popup |
| 1 hour before | Popup |

---

## 📅 Calendar Event Format

**IRCTC Train:**
```
🚂 Train 12658 | SBC → MAS | THIRD AC

PNR: 4855721109
Train: 12658
From: SBC → To: MAS
Coach: B3 | Seat: 15
Class: THIRD AC

🔗 Open Confirmation Email:
https://mail.google.com/mail/u/0/#all/...
```

**KSRTC Bus:**
```
🚌 KSRTC Bus | BENGALURU → CHENNAI

PNR: KS17910829
From: BENGALURU → To: CHENNAI
Departure: 22:52 hrs
Seat: 24
Class: AIRAVAT CLUB CLASS 2.0

🔗 Open Confirmation Email:
https://mail.google.com/mail/u/0/#all/...
```

---

## 📧 Supported Email Sources

| Source | How it's handled |
|---|---|
| Direct IRCTC email to Gmail | `irctc-booking` label → `processIRCTC()` |
| Direct KSRTC email to Gmail | `ksrtc-booking` label → `processKSRTC()` |
| Cloudflare forwarded to Gmail | Original sender preserved → caught by same filters above |
| Forwarded from another Gmail | `forwarded-mail` label → `processForwarded()` detects IRCTC or KSRTC from body |

---

## 🔧 How It Works Internally

```
Email arrives in Gmail
        ↓
Gmail filter applies label automatically
        ↓
Apps Script wakes up every 15 mins
        ↓
Reads emails with booking labels
        ↓
Parses: PNR, train/bus no, route, seat, departure time
        ↓
Creates Google Calendar event with reminders + Gmail link
        ↓
Labels email "added-to-calendar" → never duplicated
```

---

## 📋 Resource Usage

Google Apps Script free tier limits vs actual usage:

| Resource | Free Limit | This Script |
|---|---|---|
| Daily runtime | 6 hours | ~5 mins/day |
| Triggers | 20 | 1 |
| Runs per day | Unlimited | 96 (every 15 mins) |

Well within free limits — this runs comfortably forever at no cost.

---

## 🛠️ Troubleshooting

**Event created with wrong date:**
Check the execution log in Apps Script (View → Logs) — the `IRCTC parse →` line shows exactly what was parsed.

**Event not created at all:**
- Check that the Gmail label was applied correctly
- Make sure `added-to-calendar` label doesn't already exist on that thread
- Check logs for `⚠️` warning messages

**Forwarded IRCTC email not detected:**
Make sure the forwarded email body contains either `ticketadmin@irctc.co.in` or `Booking Confirmation on IRCTC` or `Scheduled Departure` — these are the detection keywords.

**Gmail link not opening the right email:**
The link uses `#all/threadId` which searches all mail — it works even if the email is archived or labelled.

---

## 📌 Notes

- The script only processes emails **not yet labelled** `added-to-calendar` — so it never creates duplicate events
- Apps Script runs on Google's servers — your PC does not need to be on
- Google may ask you to re-authorize permissions after ~6 months — just click Allow again
- To test without a real booking: send yourself a fake email with IRCTC/KSRTC format, manually apply the label, and run the script manually

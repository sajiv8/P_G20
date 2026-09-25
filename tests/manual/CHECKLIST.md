# Manual Test Checklist

The cases automation cannot reach. Each one maps to a test case ID in
`tests/traceability/test-cases.json`, so results drop straight into the
traceability matrix.

Run these before a release. Record the date, who ran it, and the outcome.

---

## Accessibility

### TC-A11Y-09 — Screen reader pass
**Tool:** VoiceOver (built into macOS: `Cmd + F5`) or NVDA (free, Windows).

| Check | Pass | Notes |
|---|---|---|
| Heading order is logical on each page (no jump from h1 to h3) | | |
| The password-reveal button announces "Show password" / "Hide password" and its pressed state | | |
| Toasts are announced when they appear, without stealing focus | | |
| The suspended-account screen reads sensibly (the 🚫 emoji should not be read as gibberish) | | |
| Booking status is announced as text, not inferred from colour | | |
| Form validation errors are announced, not just shown | | |
| The sidebar is announced as navigation, and links read as links | | |

> The first four were changed during this test cycle and have never been heard
> through a real screen reader — only verified structurally by axe.

### TC-A11Y-01 — Keyboard-only journey
Cypress cannot press Tab natively, so the automated suite only checks that
controls are focusable. This is the real test.

**Unplug or ignore the mouse entirely.** Then:

| Step | Pass | Notes |
|---|---|---|
| Reach and complete the login form using only Tab, Shift+Tab and Enter | | |
| Focus is visible at every single step (never lost or invisible) | | |
| Navigate to Bookings using only the keyboard | | |
| Open the new-booking form, fill every field, and submit | | |
| Open a modal (image crop or borrow) — Tab must not escape it | | |
| Close the modal with Escape | | |
| Dismiss a toast with the keyboard | | |

### TC-A11Y-04, TC-A11Y-05, TC-A11Y-10 — Not yet automated
| Check | Pass | Notes |
|---|---|---|
| Submit an invalid form: the error is announced, not only displayed | | |
| Enable "Reduce motion" in OS settings — animations stop | | |

### Colour-blindness (supports TC-A11Y-06)
**Tool:** macOS Display settings → Colour Filters, or Chrome DevTools →
Rendering → Emulate vision deficiencies.

| Check | Pass | Notes |
|---|---|---|
| Pending / approved / bumped / cancelled remain distinguishable under deuteranopia | | |
| Error and success toasts are distinguishable without colour | | |
| Required-field indicators do not rely on red alone | | |

---

## Cross-browser

Selenium covers Chrome. These need setup or another machine.

### Safari
Enable the driver once:
```bash
sudo safaridriver --enable
```
Then `npm run test:crossbrowser` picks Safari up automatically. If you would
rather check by hand:

| Check | Pass | Notes |
|---|---|---|
| Login works (Safari is strictest about third-party storage — Firebase auth is the risk) | | |
| Date and time inputs are usable (Safari renders them differently from Chrome) | | |
| Layout holds at desktop and on iOS Safari at 390px | | |
| No console errors | | |

### Firefox and Edge
Neither is installed on the current test machine. Install at least Firefox — it
is a genuinely different engine from both Chrome and Safari.

| Browser | Login | Booking flow | Layout | Notes |
|---|---|---|---|---|
| Firefox | | | | |
| Edge | | | | |

---

## Email delivery — TC-NOT-02

Automation stops at "we called Resend correctly". Only a real mailbox proves
delivery.

| Check | Pass | Notes |
|---|---|---|
| Signup verification code arrives, within a minute | | |
| The code in the email actually works | | |
| Password-reset code arrives and works | | |
| Booking-approval notification arrives | | |
| Emails render correctly in Gmail **and** on a phone | | |
| Nothing lands in spam | | |
| Sender address is one a student would trust | | |

---

## TLS — TC-SEC-06

Only testable against the public host, not localhost.

| Check | Target | Result |
|---|---|---|
| SSL Labs grade for the public domain | A or better | |
| TLS 1.2 and 1.3 only, no older protocols | | |
| Certificate not near expiry | | |
| Security headers present over HTTPS (they were only on port 80 before this cycle) | | |

> Blocked by defect **D-01** until the committed TLS private key is rotated.
> Testing the current certificate is pointless while its key is in git history.

---

## Resilience spot-checks

Quick to do by hand, and they cover realistic failure modes.

| Scenario | How | Expected | Pass |
|---|---|---|---|
| Redis down | `docker compose stop redis` | Bookings still succeed; OTP endpoints fail with a clear message | |
| One service down | `docker compose stop notification-service` | Other pages keep working; no blank screen | |
| Network drops mid-action | DevTools → Offline, then submit | Readable error; recovers when back online | |
| Token expires | Leave a tab idle over an hour, then act | Refreshes silently; user never sees a 401 | |
| Double submit | Click "Create booking" three times fast | Exactly one booking created | |

---

## Sign-off

| | |
|---|---|
| Build / commit | |
| Date | |
| Run by | |
| Blocking issues found | |
| Safe to release? | |

After completing a section, update the corresponding case in
`tests/traceability/test-cases.json` if its status changes, then regenerate the
matrix:

```bash
node tests/traceability/build-matrix.mjs
```

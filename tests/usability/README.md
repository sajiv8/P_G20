# Usability testing (SUS)

Materials for the beta usability study on CampusRSO. The study measures the
System Usability Scale (Brooke, 1996) across 20–25 external testers who work
through a fixed task list, so their scores are comparable.

## What's here

| File | What it is |
|---|---|
| `participant-guide.html` | Source for the task sheet. Edit this, not the PDF. |
| `participant-guide.pdf` | The 3-page guide you send to testers. |
| `render-pdf.sh` | Rebuilds the PDF from the HTML via headless Chrome. |
| `create-sus-form.gs` | Apps Script that builds the Google Form and the scoring sheet. |
| `sus-score.mjs` | CLI scorer, for when you would rather work from a CSV. |
| `responses.example.csv` | Input format for the CLI scorer. |

## 1. Create the form

Paste `create-sus-form.gs` into a new project at
[script.google.com](https://script.google.com), run `createSusForm`, and
approve the permission prompt. The execution log prints four links: the one you
share with testers, the long form URL, the form editor, and the results
spreadsheet.

**Run `createSusForm` once and once only.** It builds a new form and a new
spreadsheet every time and cannot adopt the ones you already have, so a second
run strands your responses in the old file behind a form nobody is answering.
It now refuses to run when a response spreadsheet already exists; every other
function in the file works on the study you already have. If you have already
run it twice, `listSusFiles` prints every form and spreadsheet with its id,
creation date and response count so you can tell which pair to keep.

The form is three pages — four demographic questions, the ten SUS statements as
1–5 scales, then six open questions. The statements are Brooke's originals in
their original order; odd items are positive and even items are negative, and
the scoring depends on that, so don't reorder them.

Responses land in a spreadsheet with a **SUS Analysis** sheet that scores them
as they arrive: each participant's 0–100 score, the average, the grade against
the 68 benchmark, and the agreement percentages for the two bar charts. Once
you have responses, run `addCharts` to draw the charts.

The scoring reproduces all 20 participant scores and the 64.5 average from the
Satori reference workbook exactly, and uses the same Sauro-Lewis grade bands as
`sus-score.mjs`, so the two never disagree.

**If the SUS Analysis sheet sits on zero while responses are arriving**, run
`repairAnalysisSheet` from the same script project. Google creates the response
tab a moment after the form is linked, so on a first run the scoring formulas
can be written against a tab name or column letters that were still a guess —
and a wrong guess reads as blank rather than as an error, which is why the
sheet looks fine and stays empty. The repair rebuilds the formulas against the
response tab as it actually is, and prints the tab name, the response count and
the full header row to the Execution log so you can see what it matched. It
picks the spreadsheet holding the most responses; if that is the wrong one,
paste the right id into `SHEET_ID` at the top of the script and run it again.

If you would rather not work in Sheets, export the responses as CSV, reshape
them to match `responses.example.csv`, and run the CLI scorer instead:

```bash
node tests/usability/sus-score.mjs responses.csv
```

It prints the same figures plus the three weakest items, which is a quick way
to see which part of the experience is dragging the score down.

## 2. Build the guide

The HTML holds placeholders, never real values. `render-pdf.sh` substitutes
them into a throwaway copy at render time, so the source stays safe to commit
and you can re-render whenever a link changes. Anything you leave unset renders
as a visible fill-in box, and the script lists what is still empty when it
finishes.

Keep the values in a local `.render.env` (gitignored) rather than your shell
history:

```bash
# .render.env
SYSTEM_URL=https://rso.hnasiaexport.com
FACULTY_CODE_A=CIVIL
FACULTY_CODE_B=FOC
ADMIN_EMAIL=...
ADMIN_PW=...
SUS_FORM_URL=https://forms.gle/xxxx
```

```bash
set -a; . ./.render.env; set +a; ./render-pdf.sh
```

**The rendered PDF carries the shared admin login, so it is gitignored.** Send
it to testers directly and keep it off anywhere public.

## 3. Run the study

Send testers the PDF and nothing else — the form link is inside it, and the
guide tells them to do the tasks before answering. Watch for:

- **Faculty spread.** Testers pick either `CIVIL` or `FOC` at signup and land in
  that tenant. If either one has no resources, the testers who chose it cannot
  do Part A at all. Seed both before you send anything out.
- **The admin login is shared.** Part C uses one `main_admin` account that every
  admin tester signs into, and it can delete resources, suspend users and change
  roles. The guide scopes the tasks to non-destructive ones and says so in bold,
  but nothing in the app enforces that. Safer options, in order: give Part C to
  two or three people you know rather than the whole group; or create a
  throwaway `tenant_admin` in a scratch faculty and use that instead; or change
  the password once testing closes. See "Splitting the guide" below.
- **Email verification is the usual drop-off point.** Tell people to use an
  inbox they can open on the spot.

### Splitting the guide

If you would rather the general testers never see the admin login, render twice
— once with `ADMIN_EMAIL`/`ADMIN_PW` unset for the ~20 general testers, and once
with them set for the two or three doing Part C. Rename the first output so the
second render does not overwrite it.

Aim for 20–25 completed responses. Below about 20 the average moves too much
with each new response to quote with confidence.

## Reading the result

68 is the accepted average, so a score of 68 means "about average" — it is not
a percentage. The curved grades both tools use:

| Score | Grade | |
|---|---|---|
| 80.3+ | A | excellent, top 10% |
| 74–80.3 | B | good |
| 68–74 | C | okay, at the average |
| 51–68 | D | poor |
| below 51 | F | unacceptable |

Report the average alongside the number of participants and who they were, and
quote the confidence interval with it. Then use the open-ended answers to
explain what drove the number — that is what the write-up needs, not the score
on its own.

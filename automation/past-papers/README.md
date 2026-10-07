# Past-paper downloader

Opens the PapaCambridge IGCSE listing in Chromium (Playwright), types the subject into the search box,
follows the matching subject pages and downloads every PDF one at a time into
`past-papers/igcse/<subject>/`. Each file must return HTTP 200, start with `%PDF-` and be under 50 MB.
Files already present (or listed in that folder's `manifest.json`) are skipped, so re-runs only add new papers.

## Upload to the website from GitHub (recommended)

Actions → **Upload past papers** → **Run workflow** (`.github/workflows/upload-past-papers.yml`). It
downloads the subject's question papers on the runner, renames them with `prepare-for-upload.js`
(`0452_s23_qp_12.pdf` → `IGCSE-ACCOUNTING - 0452-12 - May-June 2023.pdf`) and uploads them, unchanged,
with `functions/scripts/bulk-upload-past-papers.cjs`. That script skips papers already on the site and
PDFs whose printed paper code or session doesn't match the name. Nothing is committed to the repository.

- The first run should keep **dry run** ticked and a small **max files**; the upload report is attached to
  the run as an artifact.
- Mark schemes and examiner reports are not uploaded: the site keeps one PDF per paper code, session and year.
- Needs the `FIREBASE_UPLOAD_SERVICE_ACCOUNT` repository secret (service-account JSON key with Cloud
  Datastore User, Storage Object Admin and Firebase Authentication Viewer roles).

## Run locally

```bash
cd automation/past-papers
npm ci
npx playwright install chromium
SEARCH_TERM=Accounting MAX_FILES=10 npm run download
```

Other settings: `START_URL`, `OUT_DIR`, `MAX_DEPTH` (default 3), `DELAY_MS` (default 1500),
`FILE_FILTER` (regex, e.g. `_(qp|ms)_`), `HEADLESS=false` to watch the browser, `CHROMIUM_PATH`.

`npm test` runs the downloader against a local mock of the site.

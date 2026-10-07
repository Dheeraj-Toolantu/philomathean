# Past-paper downloader

Opens the PapaCambridge IGCSE listing in Chromium (Playwright), types the subject into the search box,
then opens the subject's folders and every subfolder inside them (year › session › paper › …, however
deep the site goes) until it reaches the PDFs. Each folder's PDFs are downloaded, one at a time, as soon
as that folder is opened, into `past-papers/igcse/<subject>/`. The log prints the folder tree as it goes,
no folder is opened twice, and once `MAX_FILES` is reached no further folders are opened. Each file must return HTTP 200, start with `%PDF-` and be under 50 MB.
Files already present (or listed in that folder's `manifest.json`) are skipped, so re-runs only add new papers.
PDFs are saved exactly as downloaded.

Search terms match on every word, so `Mathematics 0444` finds "Mathematics - US (0444)" but not 0580.
`FILE_FILTER=solved` keeps only solved papers (CAIE mark schemes, `_ms_`, or links labelled solved / mark scheme / answers).

Advertisements: requests to the common ad networks are blocked, and any ad that still appears, including
Google's full-screen vignette (`#google_vignette`), is closed with its own close/dismiss button before
the script clicks or types, after every page load (`ads.js`). Set `BLOCK_ADS=false` to let ads load and only close them.

## Save to the repository from GitHub

Actions → **Save past papers to repo** → **Run workflow** (`.github/workflows/save-past-papers.yml`).
Defaults to `Mathematics 0444` with `solved`, and commits the PDFs under `past-papers/igcse/<subject>/`
on the branch you run it from.

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
SEARCH_TERM="Mathematics 0444" FILE_FILTER=solved MAX_FILES=10 npm run download
```

Other settings: `START_URL`, `OUT_DIR`, `MAX_DEPTH` (default 0 = keep opening subfolders until none are left), `MAX_PAGES` (safety cap, default 5000), `DELAY_MS` (default 1500),
`FILE_FILTER` (`solved` or a regex on file name and link text), `BLOCK_ADS`, `HEADLESS=false` to watch the browser, `CHROMIUM_PATH`.

`npm test` runs the downloader against a local mock of the site.

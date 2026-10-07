# Past-paper downloader

## Choose what to download: `search-terms.txt`

Put one search per line in [`search-terms.txt`](search-terms.txt):

```text
# lines starting with # are ignored
Mathematics 0444
Physics 0625
Accounting 0452
```

Each line is searched on its own and saved to its own folder, `past-papers/igcse/<search-text>/`
(e.g. `mathematics-0444/`). Every word must appear in the subject's name or code, so include the code
to pick one syllabus. A line that matches nothing is reported and skipped; the others still run.

## What it does

Opens the PapaCambridge IGCSE listing in Chromium (Playwright) and, for each search term, types it into
the search box, then opens the subject's folders and every subfolder inside them (year › session › paper › …, however
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

Edit and commit `search-terms.txt`, then Actions → **Save past papers to repo** → **Run workflow**
(`.github/workflows/save-past-papers.yml`). By default it downloads every PDF for every line of the file
and commits them under `past-papers/igcse/<search-text>/` on the branch you run it from. Optional inputs:
a single search term (overrides the file), `solved` or a regex to filter PDFs, and a per-term file limit.

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
npm run download                                   # every line of search-terms.txt
SEARCH_TERMS_FILE=my-list.txt npm run download     # another list
SEARCH_TERM="Mathematics 0444" MAX_FILES=10 npm run download   # one subject only
```

Other settings: `START_URL`, `OUT_DIR` (with several terms, each gets a subfolder of it), `MAX_FILES` (per term), `MAX_DEPTH` (default 0 = keep opening subfolders until none are left), `MAX_PAGES` (safety cap, default 5000), `DELAY_MS` (default 1500),
`FILE_FILTER` (`solved` or a regex on file name and link text), `BLOCK_ADS`, `HEADLESS=false` to watch the browser, `CHROMIUM_PATH`.

`npm test` runs the downloader against a local mock of the site.

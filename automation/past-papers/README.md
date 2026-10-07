# Past-paper downloader

Opens the PapaCambridge IGCSE listing in Chromium (Playwright), types the subject into the search box,
follows the matching subject pages and downloads every PDF one at a time into
`past-papers/igcse/<subject>/`. Each file must return HTTP 200, start with `%PDF-` and be under 50 MB.
Files already present (or listed in that folder's `manifest.json`) are skipped, so re-runs only add new papers.

## Run on GitHub (recommended)

Actions → **Download past papers** → **Run workflow**. Choose the branch, the subject (default
`Accounting`), an optional file limit and an optional file-name regex. The workflow commits the new PDFs
back to that branch.

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

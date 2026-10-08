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

## Philomathean watermark and file names

Every PDF is rebranded straight after it is downloaded (`rebrand-pdf.js`):

- **PapaCambridge watermark removed**: the tiled background logo, the faint diagonal overlay, the
  "PapaCambridge · papacambridge.com" footer, its hidden "Licensed for hosting on papacambridge.com /
  Trace ID" text, and the PapaCambridge document properties and XMP metadata. The paper itself is untouched.
- **"www.PapaCambridge.com" corner ribbon removed** (older papers): the ribbon image or stamp in the top
  corner of the first pages, the ribbon's "www.PapaCambridge.com" text, and the link to papacambridge.com
  over it. Only an image touching both the top and a side edge while covering a small part of the page
  counts as a ribbon, so the paper's own logos, diagrams and full-page scans are kept.
- **Diagonal red "PapaCambridge" logo removed**: the large logo stamped at a slant across the middle of
  a page (often over graphs), whether drawn as shapes, as text, or as an image or form, also inside forms.
  Only drawing that is coloured, see-through and slanted is removed; exam content is upright, opaque or
  black and grey, so graphs, grids, highlights and diagrams are kept.
- **Philomathean watermark added** to every page: the logo from [`logo.png`](../../logo.png) at the
  repository root with "PHILOMATHEAN" beneath it, centred and faint, plus a small
  "Philomathean Career Institute" footer. The PDF's title and author are set to Philomathean.
- **Named after its year and content**:

  | Downloaded as | Saved as |
  | --- | --- |
  | `0452_s23_qp_12.pdf` | `2023 May-June - Accounting 0452 - Question Paper - Paper 12.pdf` |
  | `0452_w22_ms_21.pdf` | `2022 Oct-Nov - Accounting 0452 - Mark Scheme - Paper 21.pdf` |
  | `0444_m24_er.pdf` | `2024 Feb-March - Mathematics 0444 - Examiner Report.pdf` |
  | `0452_s26_gt.pdf` | `2026 May-June - Accounting 0452 - Grade Thresholds.pdf` |

  The subject comes from the search term; the content type (question paper, mark scheme, examiner
  report, grade thresholds, insert, specimen, …), session and year from the CAIE file name. Other names
  fall back to the PDF's own title.

`manifest.json` stays keyed by the original name and records the new one (`savedAs`), so re-runs still
skip papers that were renamed. Set `REBRAND=false` to keep PDFs exactly as downloaded, or
`WATERMARK_LOGO=path/to/logo.png` to stamp another logo.

To rebrand a folder downloaded before this existed: `npm run rebrand -- ../../past-papers/igcse/accounting-0452`
(add `--subject "Accounting 0452"` if the folder name isn't the search term).

Search terms match on every word, so `Mathematics 0444` finds "Mathematics - US (0444)" but not 0580.
`FILE_FILTER=solved` keeps only solved papers (CAIE mark schemes, `_ms_`, or links labelled solved / mark scheme / answers).

Advertisements: requests to the common ad networks are blocked, and any ad that still appears, including
Google's full-screen vignette (`#google_vignette`), is closed with its own close/dismiss button before
the script clicks or types, after every page load (`ads.js`). Set `BLOCK_ADS=false` to let ads load and only close them.

## Save to the repository from GitHub

Edit and commit `search-terms.txt`, then Actions → **Save past papers to repo** → **Run workflow**
(`.github/workflows/save-past-papers.yml`). By default it downloads every PDF for every line of the file
rebrands them (see above) and commits them under `past-papers/igcse/<search-text>/` on the branch you run it from. Optional inputs:
a single search term (overrides the file), `solved` or a regex to filter PDFs, and a per-term file limit.

## Upload to the website from GitHub (recommended)

Actions → **Upload past papers** → **Run workflow** (`.github/workflows/upload-past-papers.yml`). It
downloads and rebrands the subject's question papers on the runner, renames them with `prepare-for-upload.js`
(`0452_s23_qp_12.pdf` → `IGCSE-ACCOUNTING - 0452-12 - May-June 2023.pdf`, found through `manifest.json`) and uploads them
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
`FILE_FILTER` (`solved` or a regex on file name and link text), `BLOCK_ADS`, `REBRAND`, `WATERMARK_LOGO`, `HEADLESS=false` to watch the browser, `CHROMIUM_PATH`.

`npm test` runs the downloader against a local mock of the site and checks the rebranding on PDFs stamped the way PapaCambridge stamps them.

// Keeps advertisements out of the way of the downloader:
//  - blockAds stops requests to the common ad networks before they load,
//  - dismissAds clicks the close/dismiss button of any ad that still appears (including Google's
//    full-screen "vignette" ad, which adds #google_vignette to the URL) and removes leftover overlays,
//  - watchForAds makes Playwright call dismissAds automatically whenever an ad overlay is covering
//    the page before it clicks or types.

const AD_REQUESTS =
  /(^|\.)(googlesyndication\.com|doubleclick\.net|googleadservices\.com|adservice\.google\.[a-z.]+|adnxs\.com|amazon-adsystem\.com|pubmatic\.com|taboola\.com|outbrain\.com|criteo\.(com|net)|rubiconproject\.com|media\.net)$/i

// Overlays that cover the page while an ad is showing.
export const AD_OVERLAYS = [
  'ins.adsbygoogle[data-vignette-loaded="true"]',
  'ins.adsbygoogle[data-anchor-status]',
  'iframe[id^="aswift_"][style*="fixed"]',
  '[id^="google_ads_iframe"]',
  '[data-ad-overlay]',
]

// Close buttons inside ad frames, or on ad / popup containers on the page itself.
const CLOSE_IN_AD_FRAMES = ['#dismiss-button', '[aria-label="Close ad"]', '[aria-label*="close" i]', 'button:has-text("Close")', 'text=/^\\s*(close|skip ad|dismiss)\\s*$/i']
const CLOSE_ON_PAGE = [
  '[data-ad-overlay] [aria-label*="close" i]',
  '[class*="popup" i] [class*="close" i]',
  '[class*="modal" i][class*="ad" i] [class*="close" i]',
  '[id*="ad" i][class*="overlay" i] [class*="close" i]',
]

export const isAdRequest = (url) => {
  try {
    return AD_REQUESTS.test(new URL(url).hostname)
  } catch {
    return false
  }
}

export const blockAds = (context) => context.route((url) => isAdRequest(url.href), (route) => route.abort())

const clickIfVisible = async (locator) => {
  if (!(await locator.isVisible().catch(() => false))) return false
  await locator.click({ timeout: 2_000, force: true }).catch(() => {})
  return true
}

export const dismissAds = async (page) => {
  let closed = 0
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue
    for (const selector of CLOSE_IN_AD_FRAMES) if (await clickIfVisible(frame.locator(selector).first())) closed += 1
  }
  for (const selector of CLOSE_ON_PAGE) if (await clickIfVisible(page.locator(selector).first())) closed += 1

  // Anything still covering the page is removed, and scrolling the vignette disabled is restored.
  closed += await page
    .evaluate((selectors) => {
      const overlays = document.querySelectorAll(selectors.join(','))
      overlays.forEach((node) => node.remove())
      document.documentElement.style.removeProperty('overflow')
      document.body?.style.removeProperty('overflow')
      if (location.hash === '#google_vignette') history.replaceState(null, '', location.pathname + location.search)
      return overlays.length
    }, AD_OVERLAYS)
    .catch(() => 0)
  if (closed) console.log(`  (closed ${closed} advertisement element(s))`)
  return closed
}

export const watchForAds = (page) =>
  page.addLocatorHandler(page.locator(AD_OVERLAYS.join(', ')).first(), () => dismissAds(page), { noWaitAfter: true })

/**
 * Lightweight GA4 shim.
 *
 * Design goals:
 *   - Zero impact on initial render (script loads after window.load)
 *   - No-op if env not set, in dev mode, or if user has DNT enabled
 *   - All events use snake_case `object_action` naming
 *   - Single source of truth for event names — typed by EventName union
 *
 * Setup:
 *   1. Create a GA4 property in Google Analytics; copy the Measurement ID
 *      (looks like `G-XXXXXXXXXX`)
 *   2. On Railway: storify-app → Variables → add `VITE_GA_MEASUREMENT_ID=G-...`
 *   3. Redeploy. Tracking goes live; no code change needed.
 *
 * Verify:
 *   - GA4 → Configure → DebugView (events should appear in real-time when
 *     the site is opened with the GA Debug View browser extension)
 *   - Or: `?gtm_debug=true` URL param + browser DevTools network tab,
 *     look for `collect?v=2` requests
 */

type Primitive = string | number | boolean
type EventParams = Record<string, Primitive | undefined>

// Strongly-typed event names — add new ones here.
export type EventName =
  // Page lifecycle
  | 'page_view'
  // Landing — primary CTAs
  | 'hero_cta_click'
  | 'secondary_cta_click'
  | 'midcta_cta_click'
  | 'finalcta_cta_click'
  // Landing — content engagement
  | 'plan_card_view'
  | 'plan_card_click'
  | 'pricing_toggle_yearly'
  | 'faq_open'
  // Register funnel
  | 'register_start'
  | 'register_submit'
  | 'register_success'
  | 'register_failure'
  // Login funnel
  | 'login_submit'
  | 'login_success'
  | 'login_failure'

// gtag types
declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined
const IS_PROD = import.meta.env.PROD === true
const DNT =
  typeof navigator !== 'undefined' &&
  (navigator.doNotTrack === '1' ||
    // Some browsers expose it on window
    (window as unknown as { doNotTrack?: string }).doNotTrack === '1')

const enabled = Boolean(GA_ID) && IS_PROD && !DNT

let booted = false

function bootGtag() {
  if (booted || !enabled || typeof window === 'undefined') return
  booted = true

  window.dataLayer = window.dataLayer || []
  // gtag is just a thin pusher to dataLayer; the real GA script consumes it
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', GA_ID, {
    // We track page views manually on route change (SPA)
    send_page_view: false,
    anonymize_ip: true,
    // Don't store granular geolocation
    allow_google_signals: false,
  })

  // Load the actual script lazily so it doesn't block render
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(s)
}

// Schedule boot after the page is fully loaded so it doesn't fight for
// network with the React bundle on slow Egyptian mobile connections.
if (typeof window !== 'undefined' && enabled) {
  if (document.readyState === 'complete') {
    queueMicrotask(() => setTimeout(bootGtag, 0))
  } else {
    window.addEventListener('load', () => {
      // Yield to any post-load layout work first
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(bootGtag, { timeout: 2000 })
      } else {
        setTimeout(bootGtag, 200)
      }
    })
  }
}

/**
 * Fire a tracked event. No-ops if analytics is disabled.
 * `gtag()` itself is safe to call before the GA script has loaded —
 * calls go to dataLayer and are flushed when GA initializes.
 */
export function track(event: EventName, params: EventParams = {}): void {
  if (!enabled) return
  if (!window.gtag) return
  // Strip undefined values — GA4 logs them as the literal string "undefined"
  const clean: Record<string, Primitive> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) clean[k] = v
  }
  window.gtag('event', event, clean)
}

/** Track an SPA route change as a page view. */
export function trackPageView(path: string, title?: string): void {
  track('page_view', {
    page_location: typeof window !== 'undefined' ? window.location.origin + path : path,
    page_path: path,
    page_title: title ?? (typeof document !== 'undefined' ? document.title : ''),
  })
}

/** Test helper — exposed for debugging only. */
export function _isAnalyticsEnabled(): boolean {
  return enabled
}

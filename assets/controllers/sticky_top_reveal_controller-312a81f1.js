import { Controller } from "@hotwired/stimulus"

// Hides the sticky results-toolbar with a slide-up transform while the user
// is actively scrolling up, and reveals it again once scrolling has
// stopped. Deliberately the inverse of the common "hide on scroll down,
// reveal on scroll up" pattern — this app's own request (2026-09-04) was
// specifically hide-on-scroll-up / reveal-on-stop. Scrolling down never
// hides it. Pure transform + the element's own CSS transition (see
// _search_results.html.erb) — this controller only toggles a class.
//
// Fixes over original: (1) tracks hidden state to avoid redundant DOM
// mutations that reset the CSS transition mid-animation; (2) longer stop
// delay (400 ms) prevents flicker when scroll events are spaced >150 ms
// apart on a slow trackpad; (3) no-op when near the top of the page (y ≤ 80)
// — the bar is about to un-stick anyway, so hiding it is jarring.
export default class extends Controller {
  static values = { revealDelay: { type: Number, default: 400 } }

  connect() {
    this.lastY = window.scrollY
    this._hidden = false
    this.stopTimer = null
    this.onScroll = this.onScroll.bind(this)
    window.addEventListener("scroll", this.onScroll, { passive: true })
  }

  onScroll() {
    const y = window.scrollY
    const scrollingUp = y < this.lastY
    this.lastY = y

    if (scrollingUp && y > 80) this.hide()

    clearTimeout(this.stopTimer)
    this.stopTimer = setTimeout(() => this.reveal(), this.revealDelayValue)
  }

  hide() {
    if (this._hidden) return
    this._hidden = true
    this.element.classList.add("-translate-y-full")
  }

  reveal() {
    if (!this._hidden) return
    this._hidden = false
    this.element.classList.remove("-translate-y-full")
  }

  disconnect() {
    window.removeEventListener("scroll", this.onScroll)
    clearTimeout(this.stopTimer)
  }
}

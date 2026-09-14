import { Controller } from "@hotwired/stimulus"

// Auto-scrolling mosaic strip for the collections browse pages (/collections
// and /collections/:slug), matching the continuous horizontal auto-scroll +
// single pause/resume toggle confirmed on a live Google Arts & Culture
// partner page (~10.6px/s linear scroll; toggle button aria-label swaps
// "Pause animation" / "Play animation" — the WCAG 2.2.2 Pause/Stop/Hide
// pattern for auto-moving content, not decoration).
//
// The track's real content is duplicated once so the CSS animation can loop
// seamlessly (translateX 0 -> -50%); the clone is marked `inert` so it never
// reaches the accessibility tree or the tab order — keyboard/AT users only
// ever see the original tiles once.
//
// Defaults: plays automatically UNLESS the user's OS requests reduced
// motion, in which case it starts paused and never auto-plays. `playing` is
// tracked explicitly (not read back off the DOM class) so toggle() always
// reflects the user's actual last choice.
export default class extends Controller {
  static targets = ["track", "button"]
  static values = { speed: { type: Number, default: 14 } } // px/second (half the initial 28px/s — too fast per user feedback)

  connect() {
    this.playing = false
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    this.cloneTrack()
    this.sizeAnimation()

    if (!this.reduceMotion && this.canScroll) this.play()
    else this.reflectState()

    this.resizeObserver = new ResizeObserver(() => this.sizeAnimation())
    this.resizeObserver.observe(this.trackTarget)
  }

  disconnect() {
    this.resizeObserver?.disconnect()
  }

  cloneTrack() {
    if (this.trackTarget.dataset.cloned) return

    const clone = this.trackTarget.cloneNode(true)
    clone.setAttribute("aria-hidden", "true")
    clone.setAttribute("inert", "")
    clone.removeAttribute("data-motion-mosaic-target")
    this.trackTarget.insertAdjacentElement("afterend", clone)
    this.trackTarget.dataset.cloned = "true"
  }

  sizeAnimation() {
    const width = this.trackTarget.scrollWidth
    this.canScroll = width > this.element.clientWidth
    if (!this.canScroll) return

    const duration = width / this.speedValue
    this.element.style.setProperty("--motion-mosaic-distance", `-${width}px`)
    this.element.style.setProperty("--motion-mosaic-duration", `${duration}s`)
  }

  toggle() {
    if (this.playing) {
      this.pause()
    } else {
      this.play()
    }
  }

  play() {
    if (!this.canScroll) return
    this.playing = true
    this.element.classList.add("is-playing")
    this.reflectState()
  }

  pause() {
    this.playing = false
    this.element.classList.remove("is-playing")
    this.reflectState()
  }

  reflectState() {
    if (!this.hasButtonTarget) return

    this.buttonTarget.setAttribute("aria-label", this.playing ? "Pause animation" : "Play animation")
    this.buttonTarget.dataset.state = this.playing ? "playing" : "paused"
  }
}

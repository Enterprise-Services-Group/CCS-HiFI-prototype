import { Controller } from "@hotwired/stimulus"

// Hover/focus-revealed tooltip for the homepage hero image tiles (real
// item title + collection + a "View record" link). Distinct from
// popover_controller.js (click-toggle, dismiss on outside click): a
// tooltip is conventionally hover/focus-revealed, and has to tolerate the
// pointer moving from the trigger onto the panel itself to reach the link
// inside it, rather than dismissing the instant the pointer leaves the
// trigger — scheduleHide()'s short delay is what makes that crossing
// possible; entering the panel cancels the pending hide.
export default class extends Controller {
  static targets = ["trigger", "panel"]

  connect() {
    this.hideTimeout = null
  }

  show() {
    clearTimeout(this.hideTimeout)
    this.panelTarget.hidden = false
    this.triggerTarget.setAttribute("aria-expanded", "true")
  }

  scheduleHide() {
    clearTimeout(this.hideTimeout)
    this.hideTimeout = setTimeout(() => this.hide(), 150)
  }

  hide() {
    this.panelTarget.hidden = true
    this.triggerTarget.setAttribute("aria-expanded", "false")
  }

  toggle() {
    if (this.panelTarget.hidden) {
      this.show()
    } else {
      this.hide()
    }
  }

  onKeydown(event) {
    if (event.key !== "Escape") return
    this.hide()
    this.triggerTarget.focus()
  }

  disconnect() {
    clearTimeout(this.hideTimeout)
  }
}

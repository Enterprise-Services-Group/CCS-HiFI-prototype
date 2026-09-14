import { Controller } from "@hotwired/stimulus"

// Generic "copy text to clipboard" utility (item page citation/permalink
// actions today) — data-copy-text-value holds what to copy, an optional
// data-copy-target="status" element gets an aria-live confirmation. See
// share_controller.js for the same pattern specialised to the current URL
// with a native-share fallback.
export default class extends Controller {
  static values = { text: String, copiedLabel: { type: String, default: "Copied!" } }
  static targets = ["status", "button"]

  async copy() {
    try {
      await navigator.clipboard.writeText(this.textValue)
      this.announce("Copied to clipboard")
      this.showCopied()
    } catch {
      this.announce("Couldn't copy — select and copy the text manually")
    }
  }

  showCopied() {
    if (!this.hasButtonTarget) return
    const button = this.buttonTarget
    if (this.originalLabel === undefined) this.originalLabel = button.textContent
    clearTimeout(this.resetTimeout)
    button.textContent = this.copiedLabelValue
    this.resetTimeout = setTimeout(() => {
      button.textContent = this.originalLabel
    }, 2000)
  }

  announce(message) {
    if (!this.hasStatusTarget) return
    this.statusTarget.textContent = message
    clearTimeout(this.announceTimeout)
    this.announceTimeout = setTimeout(() => { this.statusTarget.textContent = '' }, 2000)
  }
}

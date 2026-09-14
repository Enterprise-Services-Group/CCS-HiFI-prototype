import { Controller } from "@hotwired/stimulus"

// /collections page "Share" button — uses the native Web Share API where
// available, falling back to copying the page URL to the clipboard with an
// aria-live confirmation for browsers/platforms without either.
export default class extends Controller {
  static targets = ["status"]

  async share() {
    const url = window.location.href
    const title = document.title

    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch (error) {
        if (error.name !== "AbortError") this.copy(url)
      }
      return
    }

    this.copy(url)
  }

  async copy(url) {
    try {
      await navigator.clipboard.writeText(url)
      this.announce("Link copied to clipboard")
    } catch {
      this.announce("Couldn't copy the link — copy it from the address bar")
    }
  }

  announce(message) {
    if (!this.hasStatusTarget) return
    this.statusTarget.textContent = message
  }
}

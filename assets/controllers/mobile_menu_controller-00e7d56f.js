import { Controller } from "@hotwired/stimulus"

// Toggles the mobile hamburger drawer / search panel in the site header,
// mirroring the desktop/tablet/mobile state machine in the React app's
// src/components/Header.tsx (default / search-open / menu-open).
export default class extends Controller {
  static targets = ["panel"]

  connect() {
    this.trigger = null
    document.addEventListener("keydown", this.onKeydown)
  }

  toggle(event) {
    const name = event.currentTarget.dataset.panel
    const target = this.panelTargets.find((p) => p.dataset.panel === name)
    const opening = target && target.hidden

    this.trigger = event.currentTarget

    this.panelTargets.forEach((panel) => {
      if (!panel.hidden) this.resetSearchPanel(panel)
      panel.hidden = true
    })

    if (target) target.hidden = !opening

    if (opening) {
      const focusable = target.querySelector("input, button, a, select, textarea, [tabindex]:not([tabindex='-1'])")
      focusable?.focus()
    } else {
      this.trigger?.focus()
    }
  }

  close() {
    this.panelTargets.forEach((panel) => {
      if (!panel.hidden) this.resetSearchPanel(panel)
      panel.hidden = true
    })
    this.trigger?.focus()
  }

  // Mirrors the desktop header search reset — reopening the mobile search
  // panel should always start from a blank slate, not a stale query/results.
  resetSearchPanel(panel) {
    if (panel.dataset.panel !== "search") return
    const input = panel.querySelector("input[type='text']")
    if (input) {
      input.value = ""
      input.setAttribute("aria-expanded", "false")
    }
    const results = panel.querySelector("[data-search-suggest-target='results']")
    if (results) { results.hidden = true; results.innerHTML = "" }
  }

  onKeydown = (event) => {
    if (event.key !== "Escape") return

    const hasOpenPanel = this.panelTargets.some((panel) => !panel.hidden)
    if (!hasOpenPanel) return

    event.preventDefault()
    this.close()
  }

  disconnect() {
    document.removeEventListener("keydown", this.onKeydown)
  }
}

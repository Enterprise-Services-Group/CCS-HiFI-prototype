import { Controller } from "@hotwired/stimulus"

// "Cite This Record" side-card (item show page) — CatalogHelper#citation_text
// pre-renders all 4 styles server-side, one per <option>'s data attributes
// (data-citation-text: the HTML shown, with its <em>; data-citation-plain:
// the same citation with tags stripped, for the clipboard). This controller
// only swaps which one is visible/copied — no citation formatting logic is
// duplicated in JS, CatalogHelper::CITATION_STYLES stays the single source
// of truth for the actual text.
//
// copy() mirrors copy_controller.js's own try/catch/announce shape rather
// than reusing that controller directly: the text to copy changes with the
// selected style, but Stimulus values (what copy_controller reads) are set
// once at render and don't update on their own when a sibling controller's
// state changes.
export default class extends Controller {
  static targets = ["select", "text", "status"]

  update() {
    this.textTarget.innerHTML = this.selectedOption.dataset.citationText
  }

  async copy() {
    try {
      await navigator.clipboard.writeText(this.selectedOption.dataset.citationPlain)
      this.announce("Citation copied")
    } catch {
      this.announce("Couldn't copy — select and copy the text manually")
    }
  }

  get selectedOption() {
    return this.selectTarget.selectedOptions[0]
  }

  announce(message) {
    if (!this.hasStatusTarget) return
    this.statusTarget.textContent = message
  }
}

import { Controller } from "@hotwired/stimulus"

// One facet's dropdown/popover in the persistent filter sidebar (Phase 6a,
// replacing the old flyout-modal system). Deliberately lightweight compared
// to the retired facet_modal_controller — this is an inline popover, not a
// modal, so no focus trap, backdrop, or scroll lock; just open/close +
// outside-click/Escape to close.
export default class extends Controller {
  static targets = ["button", "panel"]

  toggle() {
    if (this.panelTarget.hidden) {
      this.open()
    } else {
      this.close()
    }
  }

  open() {
    this.panelTarget.hidden = false
    this.buttonTarget.setAttribute("aria-expanded", "true")
    document.addEventListener('click', this.onOutsideClick)
    document.addEventListener('keydown', this.onKeydown)
  }

  close() {
    if (this.panelTarget.hidden) return

    this.panelTarget.hidden = true
    this.buttonTarget.setAttribute("aria-expanded", "false")
    document.removeEventListener('click', this.onOutsideClick)
    document.removeEventListener('keydown', this.onKeydown)
  }

  onOutsideClick = (event) => {
    if (!this.element.contains(event.target)) this.close()
  }

  onKeydown = (event) => {
    if (event.key !== 'Escape') return

    event.preventDefault()
    this.close()
    this.buttonTarget.focus()
  }

  disconnect() {
    document.removeEventListener('click', this.onOutsideClick)
    document.removeEventListener('keydown', this.onKeydown)
  }
}

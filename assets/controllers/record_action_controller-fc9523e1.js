import { Controller } from "@hotwired/stimulus"

// Drives the item-record action cards (open dialog by ID) and the dialogs
// themselves (close button + backdrop click-to-close).
// One controller instance lives on the actions <aside> (open behaviour);
// separate instances live on each <dialog> (close + backdrop behaviour).
export default class extends Controller {
  open({ params: { dialogId } }) {
    document.getElementById(dialogId)?.showModal()
  }

  closeDialog() {
    if (this.element.tagName === "DIALOG") this.element.close()
  }

  backdropClose(event) {
    if (event.target === this.element) this.element.close()
  }
}

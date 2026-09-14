import { Controller } from "@hotwired/stimulus"

// Generic toggle/outside-click/escape popover (search tips + keyboard
// shortcuts today — see _search_results.html.erb). Same behaviour as
// facet_dropdown_controller.js, which is functionally identical but named
// for its one current use; kept as a separate, honestly-named controller
// rather than reusing that one under a misleading identifier.
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
    document.addEventListener("click", this.onOutsideClick)
    document.addEventListener("keydown", this.onKeydown)
  }

  close() {
    if (this.panelTarget.hidden) return

    this.panelTarget.hidden = true
    this.buttonTarget.setAttribute("aria-expanded", "false")
    document.removeEventListener("click", this.onOutsideClick)
    document.removeEventListener("keydown", this.onKeydown)
  }

  onOutsideClick = (event) => {
    if (!this.element.contains(event.target)) this.close()
  }

  onKeydown = (event) => {
    if (event.key !== "Escape") return

    event.preventDefault()
    this.close()
    this.buttonTarget.focus()
  }

  disconnect() {
    document.removeEventListener("click", this.onOutsideClick)
    document.removeEventListener("keydown", this.onKeydown)
  }
}

import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["panel", "chevron"]

  connect() {
    document.addEventListener("click", this.onClickOutside)
    document.addEventListener("keydown", this.onKeydown)
  }

  disconnect() {
    document.removeEventListener("click", this.onClickOutside)
    document.removeEventListener("keydown", this.onKeydown)
  }

  toggle(event) {
    const button = event.currentTarget
    const menu = button.dataset.menu
    const panel = this.panelTargets.find(p => p.dataset.menu === menu)
    if (!panel) return

    const isOpen = panel.hasAttribute("data-open")
    this.closeAll()

    if (!isOpen) {
      panel.setAttribute("data-open", "")
      button.setAttribute("aria-expanded", "true")
      this.chevronTargets
        .filter(c => c.dataset.menu === menu)
        .forEach(c => c.setAttribute("data-open", ""))
    }
  }

  closeAll() {
    this.panelTargets.forEach(p => p.removeAttribute("data-open"))
    this.chevronTargets.forEach(c => c.removeAttribute("data-open"))
    this.element.querySelectorAll("button[data-menu]")
      .forEach(b => b.setAttribute("aria-expanded", "false"))
  }

  onClickOutside = (event) => {
    if (!this.element.contains(event.target)) this.closeAll()
  }

  onKeydown = (event) => {
    if (event.key === "Escape") this.closeAll()
  }
}

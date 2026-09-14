import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["tab", "panel"]

  connect() {
    this.activeIndex = 0
    this.updateUI()
    this.boundOnKeydown = this.onKeydown.bind(this)
    this.element.addEventListener("keydown", this.boundOnKeydown)
  }

  disconnect() {
    this.element.removeEventListener("keydown", this.boundOnKeydown)
  }

  switchTab(event) {
    this.activeIndex = this.tabTargets.indexOf(event.currentTarget)
    this.updateUI()
  }

  onKeydown(event) {
    const tabs = this.tabTargets
    if (!tabs.includes(document.activeElement)) return
    if (event.key === "ArrowRight") {
      event.preventDefault()
      this.activeIndex = (this.activeIndex + 1) % tabs.length
      this.updateUI()
      tabs[this.activeIndex].focus()
    } else if (event.key === "ArrowLeft") {
      event.preventDefault()
      this.activeIndex = (this.activeIndex - 1 + tabs.length) % tabs.length
      this.updateUI()
      tabs[this.activeIndex].focus()
    } else if (event.key === "Home") {
      event.preventDefault()
      this.activeIndex = 0
      this.updateUI()
      tabs[0].focus()
    } else if (event.key === "End") {
      event.preventDefault()
      this.activeIndex = tabs.length - 1
      this.updateUI()
      tabs[this.activeIndex].focus()
    }
  }

  updateUI() {
    this.tabTargets.forEach((tab, i) => {
      tab.setAttribute("aria-selected", i === this.activeIndex)
    })
    this.panelTargets.forEach((panel, i) => {
      panel.hidden = i !== this.activeIndex
    })
  }
}

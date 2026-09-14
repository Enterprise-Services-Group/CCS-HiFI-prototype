import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["tagList", "submitButton", "tagOverflow", "tabBadge", "tabBadgeSr", "countAnnouncement"]
  static values = { countUrl: String }

  connect() {
    this.requestId = 0
    this.element.addEventListener("input", this.onChange)
    this.element.addEventListener("change", this.onChange)
    this.renderTags()
  }

  disconnect() {
    this.element.removeEventListener("input", this.onChange)
    this.element.removeEventListener("change", this.onChange)
    clearTimeout(this.timer)
  }

  onChange = () => {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.renderTags()
      this.fetchCount()
    }, 300)
  }

  // In-place form reset — no navigation, modal stays open
  clearAll(event) {
    event.preventDefault()
    this.element.querySelectorAll('input[type=checkbox], input[type=radio]').forEach(input => {
      input.checked = false
    })
    this.element.querySelectorAll('input[type=number]').forEach(input => {
      input.value = ""
    })
    this.renderTags()
    this.fetchCount()
  }

  renderTags() {
    if (!this.hasTagListTarget) return

    const tags = []

    this.element
      .querySelectorAll("input[type=checkbox]:checked[data-facet-value-label], input[type=radio]:checked[data-facet-value-label]")
      .forEach((input) => {
        const facetLabel = input.closest("[data-facet-label]")?.dataset.facetLabel
        tags.push({
          text: `${facetLabel}: ${input.dataset.facetValueLabel}`,
          onRemove: () => {
            input.checked = false
            input.dispatchEvent(new Event("change", { bubbles: true }))
          }
        })
      })

    const seenFields = new Set()
    this.element.querySelectorAll('input[name^="range["]').forEach((input) => {
      const match = input.name.match(/^range\[(.+)\]\[(?:begin|end)\]$/)
      if (!match) return

      const [, field] = match
      if (seenFields.has(field)) return
      seenFields.add(field)

      const beginInput = this.element.querySelector(`input[name="range[${field}][begin]"]`)
      const endInput = this.element.querySelector(`input[name="range[${field}][end]"]`)
      if (!beginInput?.value && !endInput?.value) return

      const facetLabel = beginInput.closest("[data-facet-label]")?.dataset.facetLabel || field
      const from = beginInput.value || "Any"
      const to = endInput.value || "Present"
      tags.push({
        text: `${facetLabel}: ${from}–${to}`,
        onRemove: () => {
          beginInput.value = ""
          endInput.value = ""
          beginInput.dispatchEvent(new Event("input", { bubbles: true }))
          endInput.dispatchEvent(new Event("input", { bubbles: true }))
        }
      })
    })

    document.dispatchEvent(new CustomEvent("live-filter:count", { detail: { count: tags.length } }))

    this.tagListTarget.replaceChildren(
      ...tags.map((tag) => {
        const li = document.createElement("li")
        const button = document.createElement("button")
        button.type = "button"
        button.className = "uom-ds-tag-dismissible"
        button.setAttribute("aria-label", `Remove ${tag.text}`)
        button.innerHTML =
          `<span class="min-w-0 truncate">${this.escapeHtml(tag.text)}</span>` +
          '<svg viewBox="0 0 24 24" fill="none" class="size-6 shrink-0"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        button.addEventListener("click", () => {
          tag.onRemove()
          this.renderTags()
          this.fetchCount()
        })
        li.append(button)
        return li
      })
    )

    this.updateTagOverflow()
    this.updateTabBadges()
  }

  updateTagOverflow() {
    if (!this.hasTagOverflowTarget || !this.hasTagListTarget) return
    const list = this.tagListTarget
    // Allow a frame for layout to settle
    requestAnimationFrame(() => {
      const overflowing = list.scrollHeight > list.clientHeight + 2
      if (overflowing) {
        const visible = Array.from(list.children).filter(
          li => li.offsetTop + li.offsetHeight <= list.clientHeight
        ).length
        const hidden = list.children.length - visible
        if (hidden > 0) {
          this.tagOverflowTarget.textContent = `+${hidden} more filter${hidden === 1 ? "" : "s"} selected (scroll to see all)`
          this.tagOverflowTarget.hidden = false
          return
        }
      }
      this.tagOverflowTarget.hidden = true
    })
  }

  updateTabBadges() {
    if (!this.hasTabBadgeTarget) return
    const panels = this.element.querySelectorAll('[role="tabpanel"]')

    this.tabBadgeTargets.forEach(badge => {
      const tabIndex = parseInt(badge.dataset.tabIndex, 10)
      const panel = panels[tabIndex]
      if (!panel) return

      let count = 0
      panel.querySelectorAll('input[type=checkbox]:checked[data-facet-value-label], input[type=radio]:checked[data-facet-value-label]').forEach(() => count++)

      const seenFields = new Set()
      panel.querySelectorAll('input[name^="range["]').forEach(input => {
        const match = input.name.match(/^range\[(.+)\]\[/)
        if (!match || seenFields.has(match[1])) return
        seenFields.add(match[1])
        const field = match[1]
        const begin = panel.querySelector(`input[name="range[${field}][begin]"]`)?.value
        const end = panel.querySelector(`input[name="range[${field}][end]"]`)?.value
        if (begin || end) count++
      })

      badge.textContent = count
      badge.hidden = count === 0

      const srBadge = this.tabBadgeSrTargets.find(el => el.dataset.tabIndex === badge.dataset.tabIndex)
      if (srBadge) srBadge.textContent = count === 0 ? '' : ` (${count} filter${count === 1 ? '' : 's'} applied)`
    })
  }

  escapeHtml(value) {
    const div = document.createElement("div")
    div.textContent = value
    return div.innerHTML
  }

  async fetchCount() {
    if (!this.hasSubmitButtonTarget || !this.hasCountUrlValue) return

    const requestId = ++this.requestId
    const btn = this.submitButtonTarget
    btn.textContent = "Counting…"
    btn.setAttribute("aria-busy", "true")
    if (this.hasCountAnnouncementTarget) this.countAnnouncementTarget.textContent = "Counting results…"

    const params = new URLSearchParams(new FormData(this.element))
    try {
      const response = await fetch(`${this.countUrlValue}?${params}`)
      if (requestId !== this.requestId) return
      btn.removeAttribute("aria-busy")
      if (!response.ok) {
        btn.textContent = "Search"
        if (this.hasCountAnnouncementTarget) this.countAnnouncementTarget.textContent = ""
        return
      }
      const { count } = await response.json()
      const label = `Show ${count} result${count === 1 ? "" : "s"}`
      btn.textContent = label
      if (this.hasCountAnnouncementTarget) this.countAnnouncementTarget.textContent = label
    } catch {
      if (requestId === this.requestId) {
        btn.removeAttribute("aria-busy")
        btn.textContent = "Search"
        if (this.hasCountAnnouncementTarget) this.countAnnouncementTarget.textContent = ""
      }
    }
  }
}

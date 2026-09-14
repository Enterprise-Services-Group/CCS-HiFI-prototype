import { Controller } from "@hotwired/stimulus"

// Global keyboard shortcuts (2026-09-04 search-features pass — see the
// "Search tips" popover in _search_results.html.erb, which is also where
// these are documented for users). Attached once on <body> (application.html.erb).
//
//   /  focus the search box (sticky results-toolbar box if present, else
//      the always-visible header search field)
//   f  open the Filters modal
//
// Both are ignored while focus is already in a text input/textarea/select
// or a contenteditable — otherwise typing "a/b" in the search box itself
// would refocus it mid-keystroke.
export default class extends Controller {
  connect() {
    this.onKeydown = this.onKeydown.bind(this)
    document.addEventListener("keydown", this.onKeydown)
  }

  disconnect() {
    document.removeEventListener("keydown", this.onKeydown)
  }

  onKeydown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (this.isTyping(event.target)) return

    if (event.key === "/") {
      event.preventDefault()
      this.focusSearch()
      return
    }

    if (event.key === "f") {
      event.preventDefault()
      this.openFilters()
    }
  }

  isTyping(target) {
    if (!target) return false
    const tag = target.tagName
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable
  }

  focusSearch() {
    const stickySearch = document.getElementById("sticky-search-q")
    if (stickySearch) {
      stickySearch.focus()
      stickySearch.select()
      return
    }

    // The header search field is always visible on desktop (the old
    // toggle-to-reveal header it replaced was removed 2026-09-09), so `/`
    // just focuses it — same as grabbing the sticky toolbar box above.
    // On <lg where the desktop bar is hidden, open the mobile search panel.
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      const mobileToggle = document.querySelector('[data-action="mobile-menu#toggle"][data-panel="search"]')
      mobileToggle?.click()
      return
    }

    const headerInput = document.getElementById("header-search-desktop-q")
    headerInput?.focus()
    headerInput?.select()
  }

  openFilters() {
    document.querySelector('[data-action="filter-modal#open"]')?.click()
  }
}

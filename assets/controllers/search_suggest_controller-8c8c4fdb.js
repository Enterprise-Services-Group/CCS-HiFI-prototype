import { Controller } from "@hotwired/stimulus"
import { renderSearchDropdown } from "controllers/search_dropdown_renderer"

// Search-as-you-type for every search field on the site: mobile header,
// hero banner, collections banner, sticky toolbar, and the always-visible
// desktop header field. All share the same dropdown states:
//   • focus + empty  → "Popular searches" (3 curated terms; when the field
//                      is scoped to a single named collection, the heading
//                      becomes "Popular searches in <collection>" and every
//                      term stays scoped to that collection via the form's
//                      hidden f[collection_ssim][] field)
//   • focus + typing → debounced /catalog/suggest.json → "Relevance" terms
//   • loading        → skeleton bars (after 150ms, to avoid flash)
//   • no results     → "No results found" copy
//
// Portal mode (data-search-suggest-portal-value="true"): the dropdown is
// appended to <body> and positioned via getBoundingClientRect(). Use this
// whenever the controller is inside an overflow:hidden ancestor (e.g. page
// banners) so the dropdown is not clipped.
const POPULAR_SEARCHES = ["Architecture", "Medicine", "Natural Sciences"]
const MIN_QUERY_LENGTH = 1
const DEBOUNCE_MS = 200
const LOADING_DELAY_MS = 150

export default class extends Controller {
  static targets = ["input", "dropdown"]
  static values = {
    searchUrl: { type: String, default: "" },
    portal: { type: Boolean, default: false },
  }

  connect() {
    this.requestId = 0
    this.debounceTimer = null
    this.loadingTimer = null
    this.rows = []
    this.activeIndex = -1

    // Cache the dropdown element now, before portal moves it out of scope.
    this._dd = this.dropdownTarget

    if (this.portalValue) {
      this._initPortal()
    }

    this._onClickOutside = this._onClickOutside.bind(this)
    document.addEventListener("click", this._onClickOutside, { capture: true })
  }

  disconnect() {
    clearTimeout(this.debounceTimer)
    clearTimeout(this.loadingTimer)
    document.removeEventListener("click", this._onClickOutside, { capture: true })

    if (this.portalValue) {
      window.removeEventListener("scroll", this._onScroll)
      window.removeEventListener("resize", this._onResize)
      this._dd?.remove()
    }
  }

  // ── Portal ────────────────────────────────────────────────────────────
  _initPortal() {
    this._dd.style.position = "fixed"
    this._dd.style.zIndex = "200"
    document.body.appendChild(this._dd)

    this._onScroll = () => this._positionPortal()
    this._onResize = () => this._positionPortal()
    window.addEventListener("scroll", this._onScroll, { passive: true })
    window.addEventListener("resize", this._onResize, { passive: true })
  }

  _positionPortal() {
    if (!this._dd) return
    const rect = this.element.getBoundingClientRect()
    this._dd.style.top = `${rect.bottom}px`
    this._dd.style.left = `${rect.left}px`
    this._dd.style.width = `${rect.width}px`
  }

  // ── Actions ───────────────────────────────────────────────────────────
  onFocus() {
    if (this.inputTarget.value.trim()) {
      this._debounce()
      return
    }
    this._renderPopular()
  }

  fetch() {
    this._debounce()
  }

  _debounce() {
    clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => this.runQuery(), DEBOUNCE_MS)
  }

  async runQuery() {
    const q = this.inputTarget.value.trim()

    if (!q) {
      this._renderPopular()
      return
    }

    if (q.length < MIN_QUERY_LENGTH) {
      this._hide()
      return
    }

    const thisRequestId = ++this.requestId
    clearTimeout(this.loadingTimer)
    this.loadingTimer = setTimeout(() => {
      if (thisRequestId === this.requestId) this._renderLoading()
    }, LOADING_DELAY_MS)

    let suggestions = [], collections = []
    try {
      const res = await fetch(`/catalog/suggest.json?q=${encodeURIComponent(q)}`)
      clearTimeout(this.loadingTimer)
      if (res.ok) {
        const payload = await res.json()
        suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : []
        collections = Array.isArray(payload.collections) ? payload.collections : []
      }
    } catch {
      clearTimeout(this.loadingTimer)
    }

    if (thisRequestId !== this.requestId) return

    if (!suggestions.length && !collections.length) {
      this._renderEmpty()
      return
    }

    // Collections are a real destination (own page + blurb), not a keyword
    // — link straight there instead of re-running the query as free text.
    const terms = [
      ...collections.map((c) => ({ label: c.name, href: `/collections/${c.slug}`, description: c.blurb, type: "collection" })),
      ...suggestions.map((label) => ({ label, href: this._termHref(label), type: "term" })),
    ].slice(0, 3)
    this._renderResults("Relevance", terms)
  }

  clear() {
    this._hide()
  }

  onKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault()
      this._hide()
      return
    }
    if (event.key === "ArrowDown") {
      event.preventDefault()
      this._moveActive(1)
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      this._moveActive(-1)
      return
    }
    if (event.key === "Enter" && this.activeIndex >= 0 && this.rows[this.activeIndex]) {
      event.preventDefault()
      this.rows[this.activeIndex].click()
    }
  }

  _onClickOutside(event) {
    if (this.element.contains(event.target)) return
    if (this._dd?.contains(event.target)) return
    this._hide()
  }

  // ── Rendering ─────────────────────────────────────────────────────────
  _searchUrl() {
    return this.searchUrlValue || this.element.querySelector("form")?.action || "/catalog"
  }

  // Hidden inputs replayed as far-field filter params for any dropdown row
  // that starts a new search (popular terms, as-you-type suggestions). A
  // search field that carries hidden filters — the collection page banner
  // (f[collection_ssim][] = the collection) or the results sticky bar
  // (every applied filter) — keeps that context on the row's href, so a
  // term clicked out of the dropdown stays scoped instead of silently
  // widening a collection-filtered search to the whole catalogue. Only the
  // search field itself (q) and pagination (page) are excluded: filtering
  // by term/date/etc. is exactly what should carry over.
  _filteredSearchUrl(label) {
    const url = new URL(this._searchUrl(), window.location.origin)
    this.element.querySelectorAll("form input[type='hidden']").forEach((el) => {
      if (!el.name || el.name === "q" || el.name === "page") return
      url.searchParams.append(el.name, el.value)
    })
    url.searchParams.append("q", label)
    return url.toString()
  }

  // The single collection this search field is scoped to (collection page
  // banner, or a results page narrowed to one collection), or null when the
  // field searches across everything (header) or across several collections
  // (/collections landing page). Drives the "Popular searches in <name>"
  // heading.
  _scopedCollectionName() {
    const collections = []
    this.element.querySelectorAll("form input[type='hidden'][name='f[collection_ssim][]']").forEach((el) => {
      if (el.value) collections.push(el.value)
    })
    return collections.length === 1 ? collections[0] : null
  }

  _termHref(label) {
    return this._filteredSearchUrl(label)
  }

  _renderPopular() {
    const collection = this._scopedCollectionName()
    const heading = collection ? `Popular searches in ${collection}` : "Popular searches"
    this.rows = renderSearchDropdown(this._dd, {
      heading,
      terms: POPULAR_SEARCHES.map((label) => ({ label, href: this._termHref(label), type: "term" })),
      action: 'data-action="search-suggest#clear"',
    })
    this._show()
    this._indexRows()
  }

  // `terms` are already fully-formed rows (see runQuery) — collections carry
  // their own destination and blurb, plain suggestions carry a search href.
  _renderResults(heading, terms) {
    this.rows = renderSearchDropdown(this._dd, {
      heading,
      terms,
      action: 'data-action="search-suggest#clear"',
    })
    this._show()
    this._indexRows()
  }

  _renderLoading() {
    renderSearchDropdown(this._dd, { state: "loading" })
    this._show()
    this._indexRows()
  }

  _renderEmpty() {
    renderSearchDropdown(this._dd, { state: "empty" })
    this._show()
    this._indexRows()
  }

  _show() {
    if (this.portalValue) this._positionPortal()
    this._dd.hidden = false
    this.inputTarget.setAttribute("aria-expanded", "true")
  }

  _hide() {
    this._dd.hidden = true
    this._dd.innerHTML = ""
    this.inputTarget.setAttribute("aria-expanded", "false")
    this.rows = []
    this.activeIndex = -1
    this.inputTarget.removeAttribute("aria-activedescendant")
  }

  // ── Keyboard navigation ───────────────────────────────────────────────
  _indexRows() {
    this.rows = Array.from(this._dd.querySelectorAll('[role="option"]'))
    this.rows.forEach((row, i) => {
      row.id = `search-suggest-row-${i}`
      row.setAttribute("aria-selected", "false")
    })
    this.activeIndex = -1
    this.inputTarget.removeAttribute("aria-activedescendant")
  }

  _moveActive(delta) {
    if (!this.rows.length) return
    const cls = "uom-ds-header-dropdown-row--active"

    if (this.rows[this.activeIndex]) {
      this.rows[this.activeIndex].classList.remove(cls)
      this.rows[this.activeIndex].setAttribute("aria-selected", "false")
    }

    this.activeIndex = (this.activeIndex + delta + this.rows.length) % this.rows.length
    const row = this.rows[this.activeIndex]
    row.classList.add(cls)
    row.setAttribute("aria-selected", "true")
    this.inputTarget.setAttribute("aria-activedescendant", row.id)
    row.scrollIntoView({ block: "nearest" })
  }
}

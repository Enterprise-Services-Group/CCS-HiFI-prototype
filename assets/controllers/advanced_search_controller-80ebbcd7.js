import { Controller } from "@hotwired/stimulus"

// Advanced search (/catalog/advanced) — dynamic search-term rows, filter
// add/remove, and per-filter AND/OR toggling.
//
// None of this needs a single backend change: Blacklight's SearchBuilder
// already understands clause[n][field]/[query]/[op] per row (op: must=AND,
// should=OR, must_not=NOT — see adv_search_clause in
// blacklight-9.0.0/lib/blacklight/solr/search_builder_behavior.rb) and
// f[field][] (AND — one fq per value) vs f_inclusive[field][] (OR — one fq
// covering all values) for facet filters (DefaultFilterQueryBuilder, same
// gem). This controller only ever changes field names/attributes on plain
// form inputs; the query itself is built entirely server-side, the same way
// for a hand-typed URL as for this form.
export default class extends Controller {
  static targets = ["termsList", "termTemplate", "filterRow", "addFilterSelect", "filterCheckbox", "filterSummaryText", "addTermButton"]

  connect() {
    this.termIndex = this.termsListTarget.querySelectorAll("[data-clause-index]").length
    this.updateTermDeleteButtons()
    this.refreshAddFilterOptions()
  }

  addTerm() {
    const html = this.termTemplateTarget.innerHTML.replaceAll("__INDEX__", this.termIndex)
    this.termsListTarget.insertAdjacentHTML("beforeend", html)
    this.termIndex += 1
    this.updateTermDeleteButtons()

    // Send focus straight to the new row's query input — the point of
    // clicking "+ Add row" is to type another term, not to re-find the row.
    this.termsListTarget.lastElementChild?.querySelector("input[type='text']")?.focus()
  }

  removeRow(event) {
    const row = event.currentTarget.closest("[data-advanced-search-row]")
    if (!row) return

    if (row.dataset.filterKey) {
      this.closeFilterDropdown(row)
      this.clearFilterRow(row)
      row.hidden = true
      this.refreshAddFilterOptions()
      // The row (and its own delete button) just disappeared — land focus
      // somewhere that still exists, so keyboard/AT users aren't dropped
      // back to the top of the document.
      if (this.hasAddFilterSelectTarget) this.addFilterSelectTarget.focus()
    } else {
      row.remove()
      this.updateTermDeleteButtons()
      if (this.hasAddTermButtonTarget) this.addTermButtonTarget.focus()
    }
  }

  addFilter(event) {
    const key = event.target.value
    if (!key) return

    const row = this.filterRowTargets.find((r) => r.dataset.filterKey === key)
    if (row) row.hidden = false
    event.target.value = ""
    this.refreshAddFilterOptions()
    // The dropdown trigger (pick values) is the row's primary control when
    // there is one; the Production Date row has no dropdown, so fall back
    // to its first input.
    row?.querySelector("[data-facet-dropdown-target='button'], select, input")?.focus()
  }

  // Closing a filter row while its value dropdown is open would otherwise
  // leave facet-dropdown's outside-click/Escape document listeners attached
  // to a hidden, inert panel.
  closeFilterDropdown(row) {
    const panel = row.querySelector("[data-facet-dropdown-target='panel']")
    const button = row.querySelector("[data-facet-dropdown-target='button']")
    if (!panel || panel.hidden) return

    panel.hidden = true
    button?.setAttribute("aria-expanded", "false")
  }

  toggleMatchType(event) {
    const select = event.target
    const row = select.closest("[data-advanced-search-row]")
    if (!row) return

    const name = select.value === "and" ? `f[${row.dataset.filterKey}][]` : `f_inclusive[${row.dataset.filterKey}][]`
    row.querySelectorAll("[data-advanced-search-target~='filterCheckbox']").forEach((checkbox) => {
      checkbox.name = name
    })
  }

  // Keeps a filter row's closed-dropdown button label ("Select values" vs.
  // a comma list of what's checked) in sync as checkboxes are toggled —
  // the initial render already gets this right server-side (see
  // _advanced_search_filter_row's summary text), this only handles updates
  // after the page has loaded.
  updateFilterSummary(event) {
    const row = event.target.closest("[data-advanced-search-row]")
    const summary = row?.querySelector("[data-advanced-search-target~='filterSummaryText']")
    if (!summary) return

    const labels = Array.from(row.querySelectorAll("[data-advanced-search-target~='filterCheckbox']:checked")).map((c) => c.dataset.itemLabel)
    summary.textContent = labels.join(", ") || "Select values"
    summary.classList.toggle("text-text-tertiary", labels.length === 0)
  }

  clearFilterRow(row) {
    row.querySelectorAll("input, select").forEach((field) => {
      if (field.type === "checkbox") {
        field.checked = false
      } else if (field.tagName === "SELECT" && field.multiple) {
        Array.from(field.options).forEach((o) => (o.selected = false))
      } else if (field.tagName === "SELECT") {
        // A deleted-then-re-added filter should come back at its default
        // ("Includes any") rather than remembering whatever AND/OR choice
        // was set before it was removed.
        if (field.matches("[data-action*='toggleMatchType']")) {
          field.value = "or"
          this.toggleMatchType({ target: field })
        } else {
          field.value = ""
        }
      } else if (field.type !== "hidden") {
        field.value = ""
      }
    })

    const summary = row.querySelector("[data-advanced-search-target~='filterSummaryText']")
    if (summary) {
      summary.textContent = "Select values"
      summary.classList.add("text-text-tertiary")
    }
  }

  // Keep at least one search-term row — deleting the last one would leave
  // no way to search at all.
  updateTermDeleteButtons() {
    const rows = this.termsListTarget.querySelectorAll("[data-clause-index]")
    rows.forEach((row) => {
      const btn = row.querySelector("[data-advanced-search-delete]")
      if (btn) btn.hidden = rows.length <= 1
    })
  }

  // "Add filter" only ever lists filters that are currently hidden.
  refreshAddFilterOptions() {
    if (!this.hasAddFilterSelectTarget) return

    this.addFilterSelectTarget.querySelectorAll("option[value]").forEach((option) => {
      if (!option.value) return
      const row = this.filterRowTargets.find((r) => r.dataset.filterKey === option.value)
      option.hidden = row ? !row.hidden : false
    })
  }
}

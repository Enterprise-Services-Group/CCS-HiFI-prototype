import { Controller } from "@hotwired/stimulus"

// "Search within" + "Show all" for searchbrowse facets (FacetGroups, control:
// :searchbrowse) — client-side only, no extra Solr query. Blacklight already
// returns the facet's values in one response; this just filters/reveals the
// rendered <label> rows, matching the prototype's data-facet-search behavior.
export default class extends Controller {
  static targets = ["row", "empty", "showAll"]

  filter(event) {
    const needle = event.target.value.trim().toLowerCase()
    let visible = 0

    this.rowTargets.forEach((row) => {
      const match = !needle || row.dataset.facetValue.includes(needle)
      row.hidden = !match
      if (match) visible += 1
    })

    if (this.hasEmptyTarget) this.emptyTarget.hidden = visible !== 0
    if (this.hasShowAllTarget) this.showAllTarget.hidden = needle.length > 0
  }

  showAll() {
    this.rowTargets.forEach((row) => { row.hidden = false })
    if (this.hasShowAllTarget) this.showAllTarget.hidden = true
  }

  // This search-within input's only job is narrowing the checkbox list —
  // filtering already happens live on every keystroke via `filter` above.
  // On the advanced search page it sits inside a real <form> with a submit
  // button, so a bare Enter (habit carried over from the query fields right
  // above it) would otherwise submit the whole search before anything is
  // checked. Harmless everywhere else this controller is used (the sidebar/
  // toolbar dropdowns aren't inside a <form> at all).
  preventSubmit(event) {
    event.preventDefault()
  }
}

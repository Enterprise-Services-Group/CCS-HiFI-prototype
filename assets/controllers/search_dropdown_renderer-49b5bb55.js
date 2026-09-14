// Shared renderer for SearchDropdownComponent. Keeps every search entry point
// on the same Figma dropdown anatomy and state markup.
export function escapeHtml(value) {
  const element = document.createElement("div")
  element.textContent = value
  return element.innerHTML
}

// Inlined from IconsHelper (search, arrow_right) — this markup is built by
// plain JS string templates with no access to the Rails view helpers, so the
// two glyphs the row anatomy needs are duplicated here rather than shared.
const SEARCH_ICON_PATH = "M19.6 21L13.3 14.7C12.8 15.1 12.225 15.4167 11.575 15.65C10.925 15.8833 10.2333 16 9.5 16C7.68333 16 6.14583 15.3708 4.8875 14.1125C3.62917 12.8542 3 11.3167 3 9.5C3 7.68333 3.62917 6.14583 4.8875 4.8875C6.14583 3.62917 7.68333 3 9.5 3C11.3167 3 12.8542 3.62917 14.1125 4.8875C15.3708 6.14583 16 7.68333 16 9.5C16 10.2333 15.8833 10.925 15.65 11.575C15.4167 12.225 15.1 12.8 14.7 13.3L21 19.6L19.6 21ZM9.5 14C10.75 14 11.8125 13.5625 12.6875 12.6875C13.5625 11.8125 14 10.75 14 9.5C14 8.25 13.5625 7.1875 12.6875 6.3125C11.8125 5.4375 10.75 5 9.5 5C8.25 5 7.1875 5.4375 6.3125 6.3125C5.4375 7.1875 5 8.25 5 9.5C5 10.75 5.4375 11.8125 6.3125 12.6875C7.1875 13.5625 8.25 14 9.5 14Z"
const ARROW_ICON_PATH = "M12.6 12L8 7.4L9.4 6L15.4 12L9.4 18L8 16.6L12.6 12Z"

function glyph(path, extraClass) {
  return `<svg viewBox="0 0 24 24" class="uom-ds-header-dropdown-glyph ${extraClass}" aria-hidden="true"><path d="${path}" fill="currentColor"/></svg>`
}

// A row is either a `collection` match (real destination, own blurb — gets
// the thumb + two-line copy + trailing arrow anatomy) or a plain `term`
// (search-icon + one or two lines, no arrow). Falls back to `term` so a bare
// string label from an older call site still renders correctly.
function renderRow({ label, href, description, type = "term" }, action) {
  const copy = `
    <span class="uom-ds-header-dropdown-copy">
      <strong>${escapeHtml(label)}</strong>
      ${description ? `<span>${escapeHtml(description)}</span>` : ""}
    </span>
  `

  if (type === "collection") {
    return `
      <a href="${href}" class="uom-ds-header-dropdown-row" ${action} role="option" aria-selected="false">
        <span class="uom-ds-header-dropdown-thumb" aria-hidden="true"></span>
        ${copy}
        ${glyph(ARROW_ICON_PATH, "uom-ds-header-dropdown-arrow")}
      </a>
    `
  }

  return `
    <a href="${href}" class="uom-ds-header-dropdown-row" ${action} role="option" aria-selected="false">
      <span class="uom-ds-header-dropdown-icon">${glyph(SEARCH_ICON_PATH, "")}</span>
      ${copy}
    </a>
  `
}

export function renderSearchDropdown(target, { heading, terms = [], state = "results", action = "" }) {
  if (state === "loading") {
    target.innerHTML = `
      <div class="uom-ds-header-loading" role="status" aria-label="Loading search suggestions">
        <span class="uom-ds-header-skeleton uom-ds-header-skeleton--heading" aria-hidden="true"></span>
        <span class="uom-ds-header-skeleton uom-ds-header-skeleton--one" aria-hidden="true"></span>
        <span class="uom-ds-header-skeleton uom-ds-header-skeleton--two" aria-hidden="true"></span>
        <span class="uom-ds-header-skeleton uom-ds-header-skeleton--three" aria-hidden="true"></span>
      </div>
    `
    return []
  }

  if (state === "empty") {
    target.innerHTML = `
      <div class="uom-ds-header-no-results">
        <p class="uom-ds-header-no-results-title">No results found</p>
        <p class="uom-ds-header-no-results-copy">Try a different search term</p>
      </div>
    `
    return []
  }

  const escapedHeading = escapeHtml(heading)
  target.innerHTML = `
    <div class="uom-ds-header-dropdown-heading">${escapedHeading}</div>
    ${terms.map((term) => renderRow(typeof term === "string" ? { label: term, href: "#" } : term, action)).join("")}
  `

  return Array.from(target.querySelectorAll('[role="option"]'))
}

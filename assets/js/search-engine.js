// Client-side replacement for the catalog search-results page's server-side
// search/facet/sort/pagination, driven entirely by the JSON export from
// `rake static:export_data` (../assets/data/*.json, relative to this page).
// Only this one page needs it: every other page was crawled and frozen as
// real Rails-rendered HTML with no further AJAX behavior (see
// script/crawl_static_site.rb).
//
// Design note: the existing Stimulus controllers already loaded on this
// page (filter_modal_controller.js, live_filter_controller.js,
// search_suggest_controller.js) are left completely untouched — they're
// almost entirely client-side already (tag list, tab badges, clear-all,
// modal open/close/focus-trap all operate on plain DOM state) and degrade
// gracefully when their one remaining fetch() fails. Rather than strip or
// rewrite them, this module (a) pre-bakes the filter modal's real content at
// build time so its fetch is skipped entirely (see
// StaticCrawl::Site#inject_catalog_extras), and (b) patches window.fetch to
// answer their two remaining endpoints (/catalog/count, /catalog/suggest.json)
// from this same in-memory dataset instead of hitting the network.
//
// Known simplifications versus the live app (documented, not accidental):
// - Records with no real image render no thumbnail block at all (matching
//   the server index rendering); list-row thumbnails use a single generic
//   icon rather than the real image.
// - The rights pill shows its category label without the per-category icon.
// - The sticky toolbar's "applied filter" chip row is not reproduced —
//   applied filters are visible inside the Filters modal itself instead.
(async function () {
  // Stacking fix: this page's search-results banner is `position:relative
  // z-[60]`, and the header's mega-menu panel is also z-60 but appears EARLIER
  // in the DOM — for equal z-index the later element paints on top, so the
  // banner covered the upper half of the open panel (nav dropdown "under the
  // banner-inner"). The panel must beat the banner and the sticky toolbar
  // (z-50), so pin it just above both (the filter modal stays safe on z-[200]).
  const headerStackingFix = document.createElement("style");
  headerStackingFix.textContent = ".mega-menu-panel { z-index: 70; }";
  document.head.appendChild(headerStackingFix);

  const DATA_BASE = "../assets/data/";
  const PLACEHOLDER_ICON_SVG =
    '<svg viewBox="0 0 24 24" fill="none" class="size-10 text-primary/40 md:size-12" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z" stroke="currentColor" stroke-width="1.5"/><path d="m4 16 4.5-4.5a2 2 0 0 1 2.8 0L16 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="15" cy="9" r="1.5" stroke="currentColor" stroke-width="1.5"/></svg>';

  // facet_groups.json isn't needed here — facet fields are derived directly
  // from the (real, crawled) checkbox/range input names already in the DOM.
  const [records, collections] = await Promise.all([
    fetchJSON(DATA_BASE + "records.json"),
    fetchJSON(DATA_BASE + "collections.json"),
  ]);

  function fetchJSON(url) {
    return fetch(url).then((r) => r.json());
  }

  function plainKey(field) {
    return field.replace(/_(tsim|ssim|ssi|isi|bsi|timv|ssort)$/, "");
  }

  function first(value) {
    return Array.isArray(value) ? value[0] : value;
  }

  function joinedText(value) {
    return (Array.isArray(value) ? value.join(" ") : value || "").toString().toLowerCase();
  }

  function titleOf(record) {
    return (first(record.title) || "").toString();
  }

  // ── Typo-tolerant matching (JS port of lib/fuzzy_query.rb) ─────────────
  // Same thresholds as the Rails app's SearchBuilder#add_fuzzy_query: only
  // bare alphanumeric words of at least 5 characters get fuzzy-matched, at
  // edit distance 1, against whole words in the candidate text — anything
  // shorter is left as a plain substring match (a short word fuzzed at
  // distance 1 is too loose to stay precise, confirmed live against Solr:
  // see fuzzy_query.rb's MIN_TERM_LENGTH comment).
  var FUZZY_MIN_TERM_LENGTH = 5;

  function isFuzzyCandidate(token) {
    return token.length >= FUZZY_MIN_TERM_LENGTH && /^[a-z0-9]+$/i.test(token);
  }

  // True if `a` and `b` differ by at most one single-character edit
  // (insertion, deletion, or substitution) — a lightweight edit-distance-1
  // check, not a full Levenshtein matrix, since fuzzy_query.rb only ever
  // asks for distance 1.
  function withinEditDistanceOne(a, b) {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    let j = 0;
    let edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        i++;
        j++;
        continue;
      }
      edits++;
      if (edits > 1) return false;
      if (a.length === b.length) {
        i++;
        j++;
      } else if (a.length > b.length) {
        i++;
      } else {
        j++;
      }
    }
    edits += a.length - i + (b.length - j);
    return edits <= 1;
  }

  function fuzzyIncludes(text, token) {
    if (!text) return false;
    if (text.includes(token)) return true;
    if (!isFuzzyCandidate(token)) return false;
    return text.split(/[^a-z0-9]+/i).some((word) => word.length >= 2 && withinEditDistanceOne(word, token));
  }

  // ── Natural-language date phrases (JS port of lib/query_date_parser.rb) ─
  // Same four patterns, same narrow-by-design scope (a wrong silent match on
  // ordinary text would be worse than not matching every date-shaped
  // phrase) — see query_date_parser.rb's own comment.
  var DATE_PATTERNS = {
    decade: /\b(\d{3})0s\b/i,
    century: /\b(\d{1,2})(?:st|nd|rd|th)[\s-]century\b/i,
    before: /\bbefore\s+(\d{3,4})\b/i,
    after: /\b(?:after|since)\s+(\d{3,4})\b/i,
  };

  function buildDateRange(query, matchText, from, to) {
    return {
      remainingQuery: query.replace(matchText, " ").replace(/\s+/g, " ").trim(),
      from: from,
      to: to,
    };
  }

  function extractDateRange(query) {
    if (!query) return null;
    let m = query.match(DATE_PATTERNS.decade);
    if (m) {
      const start = Number(m[1] + "0");
      return buildDateRange(query, m[0], start, start + 9);
    }
    m = query.match(DATE_PATTERNS.century);
    if (m) {
      const century = Number(m[1]);
      return buildDateRange(query, m[0], (century - 1) * 100 + 1, century * 100);
    }
    m = query.match(DATE_PATTERNS.before);
    if (m) return buildDateRange(query, m[0], null, Number(m[1]) - 1);
    m = query.match(DATE_PATTERNS.after);
    if (m) return buildDateRange(query, m[0], Number(m[1]) + 1, null);
    return null;
  }

  // Single place that turns a raw `state.q` into search tokens plus an
  // optional inferred year range — every caller that needs either (matching,
  // scoring, highlighting, the zero-result word-drop suggestion) goes
  // through this so they can never disagree about what the query means.
  function deriveQuery(q) {
    const raw = (q || "").trim();
    const dateRange = extractDateRange(raw);
    const remaining = dateRange ? dateRange.remainingQuery : raw;
    const tokens = remaining.toLowerCase().split(/\s+/).filter(Boolean);
    return {
      tokens: tokens,
      yearFrom: dateRange ? dateRange.from : null,
      yearTo: dateRange ? dateRange.to : null,
    };
  }

  // ── Rights category (port of RightsHelper#rights_category) ─────────────
  function rightsCategory(raw) {
    if (!raw) return null;
    const firstStatement = raw.toString().split("\\,")[0].trim();
    const bracketMatch = firstStatement.match(/^\[([^\]]+)\]\s*(.*)$/);
    const bracket = bracketMatch ? bracketMatch[1] : firstStatement;
    if (/public domain/i.test(bracket)) return "Public Domain";
    if (/request to view/i.test(bracket)) return "Request to view";
    if (/cultural conditions/i.test(bracket)) return "Cultural conditions apply";
    if (/copyright/i.test(bracket)) return "In copyright";
    if (bracketMatch) return "In copyright";
    return firstStatement;
  }

  // ── URL state ────────────────────────────────────────────────────────────
  function parseState(search) {
    const params = new URLSearchParams(search);
    const state = {
      q: params.get("q") || "",
      f: {},
      range: {},
      sort: params.get("sort") || "relevance",
      page: parseInt(params.get("page"), 10) || 1,
      perPage: parseInt(params.get("per_page"), 10) || 20,
      view: params.get("view") === "list" ? "list" : "grid",
    };
    for (const [key, value] of params.entries()) {
      let m = key.match(/^f\[(.+)\]\[\]$/);
      if (m) {
        (state.f[m[1]] ||= []).push(value);
        continue;
      }
      m = key.match(/^range\[(.+)\]\[(begin|end)\]$/);
      if (m) (state.range[m[1]] ||= {})[m[2]] = value;
    }
    return state;
  }

  function stateToParams(state) {
    const params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    for (const [field, values] of Object.entries(state.f)) {
      values.forEach((v) => params.append(`f[${field}][]`, v));
    }
    for (const [field, bounds] of Object.entries(state.range)) {
      if (bounds.begin) params.set(`range[${field}][begin]`, bounds.begin);
      if (bounds.end) params.set(`range[${field}][end]`, bounds.end);
    }
    if (state.sort !== "relevance") params.set("sort", state.sort);
    if (state.page !== 1) params.set("page", state.page);
    if (state.perPage !== 20) params.set("per_page", state.perPage);
    if (state.view !== "grid") params.set("view", state.view);
    return params;
  }

  let state = parseState(window.location.search);

  // ── Matching ─────────────────────────────────────────────────────────────
  function searchScore(record, tokens) {
    if (!tokens.length) return 0;
    const fields = [
      [joinedText(record.title), 5],
      [joinedText(record.creator), 3],
      [joinedText(record.description), 2],
      [joinedText(record.subject), 1],
    ];
    let score = 0;
    for (const token of tokens) {
      let matched = false;
      for (const [text, weight] of fields) {
        if (fuzzyIncludes(text, token)) {
          score += weight;
          matched = true;
        }
      }
      if (!matched) return -1;
    }
    return score;
  }

  function matchesYearRange(record, yearFrom, yearTo) {
    if (yearFrom == null && yearTo == null) return true;
    const year = Number(record.year);
    if (Number.isNaN(year)) return false;
    if (yearFrom != null && year < yearFrom) return false;
    if (yearTo != null && year > yearTo) return false;
    return true;
  }

  function matchesFacet(record, field, selected) {
    if (!selected || !selected.length) return true;
    if (field === "has_digital_asset_bsi") {
      return selected.includes(String(!!record.has_digital_asset));
    }
    const values = [].concat(record[plainKey(field)] || []).map(String);
    return selected.some((v) => values.includes(v));
  }

  function matchesRange(record, field, bounds) {
    if (!bounds || (!bounds.begin && !bounds.end)) return true;
    const value = Number(record[plainKey(field)]);
    if (Number.isNaN(value)) return false;
    if (bounds.begin && value < Number(bounds.begin)) return false;
    if (bounds.end && value > Number(bounds.end)) return false;
    return true;
  }

  // Matches against `s`, optionally excluding one facet's own field — used
  // to compute "if I also picked this value" counts against everything else
  // that's currently applied.
  function computeMatches(s, excludeField) {
    const { tokens, yearFrom, yearTo } = deriveQuery(s.q);
    return records.filter((r) => {
      if (tokens.length && searchScore(r, tokens) < 0) return false;
      if (!matchesYearRange(r, yearFrom, yearTo)) return false;
      for (const field of Object.keys(s.f)) {
        if (field === excludeField) continue;
        if (!matchesFacet(r, field, s.f[field])) return false;
      }
      for (const field of Object.keys(s.range)) {
        if (field === excludeField) continue;
        if (!matchesRange(r, field, s.range[field])) return false;
      }
      return true;
    });
  }

  function sortRecords(list, s) {
    const { tokens } = deriveQuery(s.q);
    const scored = list.map((r) => ({ r, score: tokens.length ? searchScore(r, tokens) : 0 }));
    if (s.sort === "year-asc") {
      scored.sort((a, b) => (Number(a.r.year) || Infinity) - (Number(b.r.year) || Infinity));
    } else if (s.sort === "year-desc") {
      scored.sort((a, b) => (Number(b.r.year) || -Infinity) - (Number(a.r.year) || -Infinity));
    } else {
      scored.sort((a, b) => b.score - a.score || titleOf(a.r).localeCompare(titleOf(b.r)));
    }
    return scored.map((x) => x.r);
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  const heading = document.getElementById("search-results-heading");
  const description = heading?.nextElementSibling;
  const documentsEl = document.getElementById("documents");
  const paginationEl = document.querySelector('nav[data-component="Pagination"]');
  const controlsEl = document.querySelector(".uom-ds-search-results-banner-controls");
  const dropdowns = controlsEl ? controlsEl.querySelectorAll('[data-controller="facet-dropdown"]') : [];
  const sortDropdown = dropdowns[0];
  const perPageDropdown = dropdowns[1];
  const viewLinks = document.querySelectorAll(".uom-ds-search-results-view-toggle a");
  const assetToggle = document.querySelector(".uom-ds-asset-toggle");
  const filterButtons = document.querySelectorAll('[data-action="filter-modal#open"]');

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  function highlightSnippet(record, tokens) {
    if (!tokens.length) return null;
    const text = first(record.description) || first(record.title);
    if (!text) return null;
    let html = escapeHtml(text);
    tokens.forEach((t) => {
      if (!t) return;
      html = html.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"), "<mark>$1</mark>");
    });
    return html;
  }

  function thumbnailHTML(record) {
    // Mirrors ResultCardComponent's index rendering (show_placeholder:false):
    // a record with no real image gets no thumbnail block at all, not a
    // generic placeholder — otherwise imageless cards render ~2x taller
    // than the server's (212px vs 427px for the same record).
    if (!record.thumbnail) return "";
    const src = record.thumbnail.startsWith("http") ? record.thumbnail : "../" + record.thumbnail.replace(/^\//, "");
    return `<div class="uom-ds-placeholder-surface w-full"><img src="${escapeHtml(src)}" alt="" class="block w-full" loading="lazy"></div>`;
  }

  function metadataItems(record) {
    return [first(record.collection), first(record.objectType), record.date].filter(Boolean);
  }

  function rightsPillHTML(record) {
    const category = rightsCategory(record.rights);
    if (!category) return "";
    return `<div class="flex w-fit items-center gap-1.5 rounded-full bg-[#f2f2f2] px-2.5 py-1"><span class="text-xs font-semibold text-[#555555]">${escapeHtml(category)}</span></div>`;
  }

  function cardHTML(record, tokens) {
    const href = `../catalog/${record.id}/index.html`;
    const snippet = highlightSnippet(record, tokens);
    return `
      <article aria-label="${escapeHtml(titleOf(record))}" class="w-full overflow-hidden rounded-[4px] bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.08)] transition-shadow hover:shadow-[0_2px_8px_0_rgba(0,0,0,0.12)]">
        <a href="${href}" class="flex flex-col w-full no-underline">
          ${thumbnailHTML(record)}
          <div class="flex w-full flex-1 flex-col gap-4 p-4">
            <span class="text-[18px] font-semibold leading-[1.5] text-text-primary">${escapeHtml(titleOf(record))}</span>
            ${snippet ? `<p class="line-clamp-3 text-[13px] leading-snug text-text-tertiary [&_mark]:bg-transparent [&_mark]:font-semibold [&_mark]:text-text-brand">${snippet}</p>` : ""}
            ${metadataItems(record).length ? `<ul class="flex flex-col gap-1">${metadataItems(record).map((i) => `<li class="text-xs font-semibold uppercase tracking-wider text-text-tertiary">${escapeHtml(i)}</li>`).join("")}</ul>` : ""}
            ${rightsPillHTML(record)}
          </div>
        </a>
      </article>`;
  }

  function listRowHTML(record, tokens) {
    const href = `../catalog/${record.id}/index.html`;
    const snippet = highlightSnippet(record, tokens);
    return `
      <article class="flex w-full items-center gap-4 border-b border-stroke-weaker py-4">
        ${record.thumbnail ? `
        <a href="${href}" class="block shrink-0" tabindex="-1" aria-hidden="true">
          <div class="uom-ds-placeholder-surface flex size-20 items-center justify-center">${PLACEHOLDER_ICON_SVG}</div>
        </a>` : ""}
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <a href="${href}" class="font-sans text-base font-semibold text-text-brand no-underline hover:underline">${escapeHtml(titleOf(record))}</a>
          ${metadataItems(record).length ? `<p class="line-clamp-1 text-sm text-text-tertiary">${escapeHtml(metadataItems(record).join(" · "))}</p>` : ""}
          ${snippet ? `<p class="line-clamp-1 text-sm text-text-primary [&_mark]:bg-transparent [&_mark]:font-semibold [&_mark]:text-text-brand">${snippet}</p>` : ""}
        </div>
        ${rightsCategory(record.rights) ? `<p class="flex w-fit shrink-0 items-center gap-1 rounded-full bg-bg-light-hover px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-text-tertiary">${escapeHtml(rightsCategory(record.rights))}</p>` : ""}
      </article>`;
  }

  // Zero-result multi-word recovery (JS port of CatalogController's
  // build_word_drop_suggestion): tries dropping each token in turn and
  // returns whichever single drop returns the most results, so the empty
  // state can offer one concrete next step instead of just generic advice.
  // Only tried once truly zero results come back (not fuzzy — same
  // deliberate choice as the Rails version, so the count shown is exact).
  function wordDropSuggestion(tokens) {
    if (tokens.length < 2) return null;
    let best = null;
    tokens.forEach((word, i) => {
      const remaining = tokens.filter((_, j) => j !== i).join(" ");
      const count = computeMatches(Object.assign({}, state, { q: remaining })).length;
      if (count > 0 && (!best || count > best.count)) {
        best = { dropped: word, query: remaining, count: count };
      }
    });
    return best;
  }

  function renderResults(pageRecords, tokens, total) {
    if (!documentsEl) return;
    if (state.view === "list") {
      documentsEl.className = "flex w-full flex-col";
      documentsEl.innerHTML = pageRecords.map((r) => listRowHTML(r, tokens)).join("");
    } else {
      documentsEl.className = "w-full columns-1 gap-x-6 sm:columns-2 xl:columns-4 [&>*]:mb-6 [&>*]:break-inside-avoid";
      documentsEl.innerHTML = pageRecords.map((r) => cardHTML(r, tokens)).join("");
    }
    if (!pageRecords.length) {
      const suggestion = total === 0 ? wordDropSuggestion(tokens) : null;
      const suggestionHTML = suggestion
        ? `<p class="mt-2"><button type="button" data-word-drop-query="${escapeHtml(suggestion.query)}" class="uom-ds-link-underlined font-semibold">Try without “${escapeHtml(suggestion.dropped)}”</button> — ${suggestion.count.toLocaleString()} result${suggestion.count === 1 ? "" : "s"}</p>`
        : "";
      documentsEl.innerHTML = `<div class="w-full py-16 text-center text-text-tertiary"><p>No results match your search and filters. Try removing a filter or broadening your search term.</p>${suggestionHTML}</div>`;
    }
  }

  function renderHeading(total) {
    if (!heading) return;
    heading.textContent = `Showing ${total.toLocaleString()} results${state.q ? ` for “${state.q}”` : ""}`;
    if (description) {
      const start = total === 0 ? 0 : (state.page - 1) * state.perPage + 1;
      const end = Math.min(total, state.page * state.perPage);
      description.textContent = `Showing ${start.toLocaleString()}–${end.toLocaleString()} records`;
    }
  }

  function renderPagination(totalPages) {
    if (!paginationEl) return;
    const cur = state.page;
    const linkClasses = "flex size-11 items-center justify-center text-lg font-semibold";
    let html = `<button type="button" data-page-nav="prev" class="uom-ds-pagination-navigation-button${cur === 1 ? " pointer-events-none opacity-30" : ""}" aria-label="Previous page">‹</button>`;
    const pages = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - cur) <= 2) pages.push(p);
    }
    pages.forEach((p, i) => {
      if (i > 0 && p - pages[i - 1] > 1) html += '<span class="flex size-11 items-center justify-center text-lg text-text-brand">…</span>';
      html += `<button type="button" data-page-nav="${p}" class="${linkClasses} ${p === cur ? "bg-primary text-text-header" : "text-text-brand"}" aria-current="${p === cur}">${p}</button>`;
    });
    html += `<button type="button" data-page-nav="next" class="uom-ds-pagination-navigation-button${cur === totalPages ? " pointer-events-none opacity-30" : ""}" aria-label="Next page">›</button>`;
    paginationEl.innerHTML = html;
  }

  function updateDropdownSelection(dropdown, matchValue) {
    if (!dropdown) return;
    dropdown.querySelectorAll('[data-facet-dropdown-target="panel"] a[href]').forEach((a) => {
      const url = new URL(a.getAttribute("href"), window.location.href);
      const isCurrent = matchValue(url.searchParams);
      a.setAttribute("aria-current", String(isCurrent));
    });
    const label = dropdown.querySelector('[data-facet-dropdown-target="button"] span');
    const current = dropdown.querySelector('[data-facet-dropdown-target="panel"] a[aria-current="true"]');
    if (label && current) label.textContent = current.textContent;
  }

  function updateToggles() {
    viewLinks.forEach((a) => {
      const url = new URL(a.getAttribute("href"), window.location.href);
      const isList = url.searchParams.get("view") === "list";
      const active = isList === (state.view === "list");
      a.classList.toggle("is-active", active);
      a.classList.toggle("is-inactive", !active);
      a.setAttribute("aria-current", String(active));
    });
    if (assetToggle) {
      const on = (state.f.has_digital_asset_bsi || []).includes("true");
      assetToggle.setAttribute("aria-checked", String(on));
    }
    updateDropdownSelection(sortDropdown, (p) => (p.get("sort") || "relevance") === state.sort);
    updateDropdownSelection(perPageDropdown, (p) => (parseInt(p.get("per_page"), 10) || 20) === state.perPage);
    filterButtons.forEach((btn) => {
      const count = appliedFilterCount();
      // The label is a trailing text node after the icon <svg> (see
      // ButtonComponent usage in _search_results.html.erb: icon + "Filters"
      // + optional " (N)") — rewritten in place so the icon element is
      // never touched.
      const textNode = Array.from(btn.childNodes).find((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
      if (!textNode) return;
      const base = textNode.textContent.replace(/\s*\(\d+\)\s*$/, "").trim() || "Filters";
      textNode.textContent = `${base}${count ? ` (${count})` : ""}`;
    });
  }

  function appliedFilterCount() {
    let count = 0;
    for (const values of Object.values(state.f)) count += values.length;
    for (const bounds of Object.values(state.range)) {
      if (bounds.begin || bounds.end) count += 1;
    }
    return count;
  }

  // Finds the value-count badge next to a facet checkbox — its exact markup
  // varies by control type (_facet_checkbox.html.erb's "rounded-full" pill,
  // _facet_pill_chip.html.erb's "opacity-70" span, CardIconComponent's plain
  // number_with_delimiter span for icon-tile facets) so instead of one CSS
  // class, this looks for the last descendant <span> whose text is a bare
  // (optionally comma-formatted) number.
  function findCountBadge(container) {
    const spans = container?.querySelectorAll("span") || [];
    for (let i = spans.length - 1; i >= 0; i--) {
      if (/^[\d,]+$/.test(spans[i].textContent.trim())) return spans[i];
    }
    return null;
  }

  function updateFacetCounts() {
    document.querySelectorAll('input[name^="f["]').forEach((input) => {
      const m = input.name.match(/^f\[(.+)\]\[\]$/);
      if (!m) return;
      const field = m[1];
      const reduced = computeMatches(state, field);
      const badge = findCountBadge(input.closest("div, label"));
      if (badge) {
        const count = reduced.filter((r) => matchesFacet(r, field, [input.value])).length;
        badge.textContent = count.toLocaleString();
      }
    });
  }

  function syncControls() {
    document.querySelectorAll('input[type=checkbox][name^="f["], input[type=radio][name^="f["]').forEach((el) => {
      const m = el.name.match(/^f\[(.+)\]\[\]$/);
      if (!m) return;
      el.checked = (state.f[m[1]] || []).includes(el.value);
    });
    document.querySelectorAll('input[name^="range["]').forEach((el) => {
      const m = el.name.match(/^range\[(.+)\]\[(begin|end)\]$/);
      if (!m) return;
      el.value = (state.range[m[1]] || {})[m[2]] || "";
    });
    document.querySelectorAll('input[name="q"]').forEach((el) => {
      el.value = state.q;
    });
  }

  function readFacetStateFromDOM() {
    const f = {};
    document
      .querySelectorAll('input[type=checkbox][name^="f["]:checked, input[type=radio][name^="f["]:checked')
      .forEach((el) => {
        const m = el.name.match(/^f\[(.+)\]\[\]$/);
        if (!m) return;
        (f[m[1]] ||= []).push(el.value);
      });
    const range = {};
    document.querySelectorAll('input[name^="range["]').forEach((el) => {
      const m = el.name.match(/^range\[(.+)\]\[(begin|end)\]$/);
      if (!m || !el.value) return;
      (range[m[1]] ||= {})[m[2]] = el.value;
    });
    return { f, range };
  }

  function render({ pushUrl = true } = {}) {
    const matches = computeMatches(state);
    const { tokens } = deriveQuery(state.q);
    const sorted = sortRecords(matches, state);
    const totalPages = Math.max(1, Math.ceil(sorted.length / state.perPage));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    const pageRecords = sorted.slice((state.page - 1) * state.perPage, state.page * state.perPage);

    renderHeading(sorted.length);
    renderResults(pageRecords, tokens, sorted.length);
    renderPagination(totalPages);
    updateToggles();
    syncControls();
    updateFacetCounts();

    if (pushUrl) {
      const params = stateToParams(state);
      const qs = params.toString();
      history.pushState(state, "", qs ? `?${qs}` : window.location.pathname);
    }
  }

  // ── Events ───────────────────────────────────────────────────────────────
  document.addEventListener("change", (e) => {
    if (!e.target.matches('input[name^="f["], input[name^="range["]')) return;
    Object.assign(state, readFacetStateFromDOM());
    state.page = 1;
    render();
  });

  document.addEventListener("submit", (e) => {
    const form = e.target;
    if (!form.matches("form")) return;
    if (!form.querySelector('input[name="q"]') && !form.matches('[data-controller="live-filter"]')) return;
    e.preventDefault();
    const qInput = form.querySelector('input[name="q"]:not([type=hidden])') || form.querySelector('input[name="q"]');
    if (qInput) state.q = qInput.value;
    Object.assign(state, readFacetStateFromDOM());
    state.page = 1;
    render();
    document.querySelector('[data-action="filter-modal#close"]')?.dispatchEvent(new Event("click", { bubbles: true }));
  });

  document.addEventListener("click", (e) => {
    const wordDrop = e.target.closest("[data-word-drop-query]");
    if (wordDrop) {
      e.preventDefault();
      state.q = wordDrop.dataset.wordDropQuery;
      state.page = 1;
      render();
      return;
    }

    const pageNav = e.target.closest("[data-page-nav]");
    if (pageNav) {
      e.preventDefault();
      const nav = pageNav.dataset.pageNav;
      if (nav === "prev") state.page -= 1;
      else if (nav === "next") state.page += 1;
      else state.page = parseInt(nav, 10);
      render();
      return;
    }

    if (sortDropdown?.contains(e.target)) {
      const a = e.target.closest("a[href]");
      if (a) {
        e.preventDefault();
        state.sort = new URL(a.getAttribute("href"), window.location.href).searchParams.get("sort") || "relevance";
        state.page = 1;
        render();
      }
      return;
    }

    if (perPageDropdown?.contains(e.target)) {
      const a = e.target.closest("a[href]");
      if (a) {
        e.preventDefault();
        state.perPage = parseInt(new URL(a.getAttribute("href"), window.location.href).searchParams.get("per_page"), 10) || 20;
        state.page = 1;
        render();
      }
      return;
    }

    const viewLink = e.target.closest(".uom-ds-search-results-view-toggle a");
    if (viewLink) {
      e.preventDefault();
      state.view = new URL(viewLink.getAttribute("href"), window.location.href).searchParams.get("view") === "list" ? "list" : "grid";
      render();
      return;
    }

    if (e.target.closest(".uom-ds-asset-toggle")) {
      e.preventDefault();
      const on = (state.f.has_digital_asset_bsi || []).includes("true");
      state.f.has_digital_asset_bsi = on ? [] : ["true"];
      state.page = 1;
      render();
    }
  });

  window.addEventListener("popstate", () => {
    state = parseState(window.location.search);
    render({ pushUrl: false });
  });

  // The filter modal's real content is only injected into its mount point
  // the first time it's opened (filter_modal_controller.js's own fetch,
  // answered by the shim below) — resync those just-inserted controls
  // against current state as soon as they land, rather than only on the
  // next explicit render().
  const modalMount = document.querySelector('[data-filter-modal-target="mount"]');
  if (modalMount) {
    new MutationObserver(() => {
      syncControls();
      updateFacetCounts();
    }).observe(modalMount, { childList: true });
  }

  // ── Fetch shim for the untouched Stimulus controllers ───────────────────
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input.url;

    if (url.includes("/catalog/filters")) {
      const template = document.getElementById("static-filters-fragment");
      const html = template ? template.innerHTML : "";
      return Promise.resolve(new Response(html, { status: 200, headers: { "Content-Type": "text/html" } }));
    }

    if (url.includes("/catalog/count")) {
      const q = new URL(url, window.location.href).search;
      const tempState = parseState(q);
      const count = computeMatches(tempState).length;
      return Promise.resolve(new Response(JSON.stringify({ count }), { status: 200, headers: { "Content-Type": "application/json" } }));
    }

    if (url.includes("/catalog/suggest.json")) {
      const q = (new URL(url, window.location.href).searchParams.get("q") || "").trim().toLowerCase();
      let suggestions = [];
      let matchedCollections = [];
      if (q) {
        const titles = new Set();
        records.forEach((r) => {
          const t = titleOf(r);
          if (t && t.toLowerCase().includes(q)) titles.add(t);
        });
        suggestions = Array.from(titles).slice(0, 5);
        matchedCollections = collections
          .filter((c) => c.name?.toLowerCase().includes(q))
          .slice(0, 2)
          .map((c) => ({ name: c.name, slug: c.slug, blurb: c.blurb }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ suggestions, collections: matchedCollections }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }

    return realFetch(input, init);
  };

  render({ pushUrl: false });
})();

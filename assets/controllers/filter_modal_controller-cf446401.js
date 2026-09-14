import { Controller } from "@hotwired/stimulus"

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const CLOSE_BTN_SVG = `<svg class="size-6" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`

// Shared modal shell markup reused by the loading skeleton and error state
// so focus, backdrop, and animation all work before the real content arrives.
function modalShell(bodyHTML, ariaLabel = "Filters") {
  return `
    <div class="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4"
         role="dialog" aria-modal="true" aria-label="${ariaLabel}">
      <button type="button" class="fixed inset-0 bg-black/50"
              tabindex="-1" aria-hidden="true"
              data-action="filter-modal#close"></button>
      <div class="rea-filter-modal-dialog relative z-10 flex w-full flex-col overflow-hidden rounded-t-xl bg-white text-text-primary shadow-[0px_1px_4px_0px_rgba(0,0,0,0.16)] sm:max-w-[720px] sm:rounded-xl"
           style="max-height: min(90vh, 860px);">
        <div class="relative flex min-h-14 shrink-0 items-center justify-center border-b border-filter-divider px-12 py-3">
          <h2 class="text-[22px] font-semibold text-text-brand">Filters</h2>
          <button type="button" data-action="filter-modal#close" aria-label="Close filters"
                  class="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-filter-text transition-colors hover:bg-filter-hover-bg">
            ${CLOSE_BTN_SVG}
          </button>
        </div>
        ${bodyHTML}
      </div>
    </div>`
}

const SKELETON_BODY = `
  <div class="flex flex-1 items-center justify-center py-16 text-filter-muted">
    <div class="flex flex-col items-center gap-3">
      <svg class="size-6 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      <span class="text-sm" aria-live="polite" aria-busy="true">Loading filters…</span>
    </div>
  </div>`

const ERROR_BODY = `
  <div class="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
    <p class="text-base font-semibold text-filter-text">Couldn't load filters</p>
    <p class="text-sm text-filter-muted">Check your connection and try again.</p>
    <button type="button" data-action="filter-modal#reload"
            class="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover">
      Try again
    </button>
  </div>`

export default class extends Controller {
  static targets = ["mount"]
  static values = { url: String }

  connect() {
    this.onKeydown = this.onKeydown.bind(this)
    this.isOpen = false
    this.triggerEl = null
    this.abortController = null
  }

  async open(event) {
    this.triggerEl = event?.currentTarget ?? this.triggerEl ?? document.activeElement

    this.abortController?.abort()
    this.abortController = new AbortController()

    const needsFetch = !this.mountTarget.dataset.loaded

    if (needsFetch) {
      this.mountTarget.innerHTML = modalShell(SKELETON_BODY, "Filters loading")
    }

    this._openModal()

    if (needsFetch) {
      try {
        const response = await fetch(this.urlValue + window.location.search, {
          signal: this.abortController.signal
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const html = await response.text()
        if (this.abortController.signal.aborted) return
        this.mountTarget.innerHTML = html
        this.mountTarget.dataset.loaded = "1"
        // Re-focus the close button now that real content is in place
        requestAnimationFrame(() => this._focusCloseButton())
      } catch (err) {
        if (err.name === "AbortError") return
        if (!this.abortController.signal.aborted) {
          this.mountTarget.innerHTML = modalShell(ERROR_BODY, "Filters error")
          requestAnimationFrame(() => this._focusCloseButton())
        }
      }
    }
  }

  // Retry after error: wipe cached state and re-fetch
  reload() {
    delete this.mountTarget.dataset.loaded
    this.mountTarget.innerHTML = ""
    this.open()
  }

  close() {
    this.abortController?.abort()
    this.isOpen = false
    this.mountTarget.innerHTML = ""
    delete this.mountTarget.dataset.loaded
    document.removeEventListener("keydown", this.onKeydown)
    document.body.classList.remove("overflow-hidden")
    this.triggerEl?.focus()
    this.triggerEl = null
  }

  _openModal() {
    if (this.isOpen) return
    this.isOpen = true
    document.dispatchEvent(new CustomEvent("filter-modal:opened"))
    document.addEventListener("keydown", this.onKeydown)
    document.body.classList.add("overflow-hidden")
    requestAnimationFrame(() => this._focusCloseButton())
  }

  _focusCloseButton() {
    const dialog = this.mountTarget.querySelector('[role="dialog"]')
    const closeBtn = dialog?.querySelector('[data-action*="filter-modal#close"]:not([tabindex="-1"])')
    const target = closeBtn ?? dialog?.querySelectorAll(FOCUSABLE)[0]
    target?.focus()
  }

  onKeydown(event) {
    if (event.key === "Escape") {
      this.close()
      return
    }
    if (event.key !== "Tab") return
    this.trapFocus(event)
  }

  trapFocus(event) {
    const dialog = this.mountTarget.querySelector('[role="dialog"]')
    if (!dialog) return
    const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE))
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  disconnect() {
    this.abortController?.abort()
    document.removeEventListener("keydown", this.onKeydown)
  }
}

import { Controller } from "@hotwired/stimulus"

// Decade histogram + dual-range slider for :daterange facets with
// histogram: true (FacetGroups) — one instance per facet (Production Date,
// Creator Born, Creator Died), configured via min/max values. Keeps the
// From/To number inputs, the optional preset radios (Production Date only),
// and the two overlapping range-slider thumbs in sync with each other.
//
// Ports the same fix as the React sibling prototype's DateHistogramSection:
// two native <input type=range> share one visual track (pointer-events:none
// on the input, pointer-events:auto only on the thumb pseudo-element — see
// _facet_date_histogram.html.erb) and whichever thumb was last touched
// (pointerdown/focus) gets a z-30 class so it stays grabbable even when both
// thumbs sit at the same position — otherwise the second-painted thumb
// permanently blocks the other once they meet.
export default class extends Controller {
  static targets = ["fromInput", "toInput", "fromRange", "toRange", "track", "preset"]
  static values = { min: Number, max: Number }

  connect() {
    this.updateTrack()
    this.syncPresets()
  }

  fromInputChanged() {
    this.clampInput(this.fromInputTarget)
    this.pushInputsToRange()
    this.syncPresets()
  }

  toInputChanged() {
    this.clampInput(this.toInputTarget)
    this.pushInputsToRange()
    this.syncPresets()
  }

  fromRangeChanged() {
    const to = Number(this.toRangeTarget.value)
    const from = Math.min(Number(this.fromRangeTarget.value), to)
    this.fromRangeTarget.value = from
    this.fromInputTarget.value = from
    this.updateTrack()
    this.syncPresets()
  }

  toRangeChanged() {
    const from = Number(this.fromRangeTarget.value)
    const to = Math.max(Number(this.toRangeTarget.value), from)
    this.toRangeTarget.value = to
    this.toInputTarget.value = to
    this.updateTrack()
    this.syncPresets()
  }

  presetSelected(event) {
    const { presetFrom, presetTo } = event.currentTarget.dataset
    this.fromInputTarget.value = presetFrom
    this.toInputTarget.value = presetTo
    this.pushInputsToRange()
  }

  activateFrom() {
    this.fromRangeTarget.classList.add("z-30")
    this.toRangeTarget.classList.remove("z-30")
  }

  activateTo() {
    this.toRangeTarget.classList.add("z-30")
    this.fromRangeTarget.classList.remove("z-30")
  }

  // Clamp a manually-typed year to [min, max] — matches the plain
  // _facet_daterange.html.erb's forgiving-but-bounded behavior.
  clampInput(input) {
    if (!input.value.trim()) return

    const year = Math.trunc(Number(input.value))
    if (!Number.isFinite(year)) {
      input.value = ""
      return
    }
    input.value = Math.min(this.maxValue, Math.max(this.minValue, year))
  }

  pushInputsToRange() {
    if (this.hasFromRangeTarget) this.fromRangeTarget.value = this.fromInputTarget.value || this.minValue
    if (this.hasToRangeTarget) this.toRangeTarget.value = this.toInputTarget.value || this.maxValue
    this.updateTrack()
  }

  // No histogram buckets (e.g. a zero-result search) means the template
  // skips the slider entirely and only the plain Min/Max inputs render —
  // this controller still connects for those, so every slider-only target
  // access here must be guarded rather than assumed present.
  updateTrack() {
    if (!this.hasFromRangeTarget || !this.hasToRangeTarget || !this.hasTrackTarget) return

    const span = this.maxValue - this.minValue
    if (span <= 0) return

    const from = Number(this.fromRangeTarget.value)
    const to = Number(this.toRangeTarget.value)
    this.trackTarget.style.left = `${((from - this.minValue) / span) * 100}%`
    this.trackTarget.style.width = `${((to - from) / span) * 100}%`
  }

  // A preset is "selected" when its own from/to exactly matches the current
  // From/To inputs — computed fresh on every change, not a one-way push, so
  // manually editing Min/Max after picking a preset correctly un-highlights
  // it instead of leaving a stale, desynced-looking selection.
  syncPresets() {
    const from = this.fromInputTarget.value
    const to = this.toInputTarget.value
    this.presetTargets.forEach((radio) => {
      radio.checked = radio.dataset.presetFrom === from && radio.dataset.presetTo === to
    })
  }
}

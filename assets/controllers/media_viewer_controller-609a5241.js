import { Controller } from "@hotwired/stimulus"

// Europeana-style item record media viewer: one large stage (65vh inline,
// full-viewport when expanded) with a thumbnail rail, prev/next, a simple
// non-IIIF zoom/rotate (CSS transform on the current <img> — this app has
// no deep-zoom tile source, just flat JPGs), and an expand toggle that
// turns the SAME stage into a fullscreen lightbox rather than duplicating
// markup in a separate overlay.
export default class extends Controller {
  static targets = ["image", "thumbnail", "counter", "closeButton", "metadataPanel", "metadataToggle"]
  static values = { index: { type: Number, default: 0 }, count: { type: Number, default: 1 } }

  connect() {
    this.scale = 1
    this.rotation = 0
    this._boundKeydown = this._onKeydown.bind(this)
    document.addEventListener("keydown", this._boundKeydown)
    this.render()
  }

  disconnect() {
    document.removeEventListener("keydown", this._boundKeydown)
    document.body.classList.remove("overflow-hidden")
  }

  select(event) {
    this.setIndex(Number(event.currentTarget.dataset.index))
  }

  next() {
    this.setIndex((this.indexValue + 1) % this.countValue)
  }

  prev() {
    this.setIndex((this.indexValue - 1 + this.countValue) % this.countValue)
  }

  setIndex(index) {
    this.indexValue = index
    this.scale = 1
    this.rotation = 0
    this.render()
  }

  zoomIn() {
    this.scale = Math.min(this.scale + 0.25, 3)
    this.applyTransform()
  }

  zoomOut() {
    this.scale = Math.max(this.scale - 0.25, 1)
    this.applyTransform()
  }

  rotateLeft() {
    this.rotation -= 90
    this.applyTransform()
  }

  rotateRight() {
    this.rotation += 90
    this.applyTransform()
  }

  toggleExpand() {
    const expanded = this.element.classList.toggle("is-expanded")
    document.body.classList.toggle("overflow-hidden", expanded)
    if (this.hasCloseButtonTarget) this.closeButtonTarget.hidden = !expanded
    if (expanded) this.closeButtonTarget?.focus()
  }

  collapse() {
    if (!this.element.classList.contains("is-expanded")) return
    this.element.classList.remove("is-expanded")
    document.body.classList.remove("overflow-hidden")
    if (this.hasCloseButtonTarget) this.closeButtonTarget.hidden = true
  }

  // Europeana-style "Media metadata" panel toggle — docked beside the stage,
  // opened/closed from the info button in the viewer controls (or its own
  // close button), independent of the fullscreen/expand state above.
  toggleMetadata() {
    if (!this.hasMetadataPanelTarget) return
    this.metadataPanelTarget.hidden = !this.metadataPanelTarget.hidden
    this._syncMetadataToggle()
  }

  _syncMetadataToggle() {
    const expanded = this.hasMetadataPanelTarget && !this.metadataPanelTarget.hidden
    this.metadataToggleTargets.forEach((btn) => btn.setAttribute("aria-expanded", String(expanded)))
  }

  render() {
    this.imageTargets.forEach((img) => {
      img.hidden = Number(img.dataset.index) !== this.indexValue
    })
    this.thumbnailTargets.forEach((thumb) => {
      thumb.classList.toggle("is-active", Number(thumb.dataset.index) === this.indexValue)
    })
    if (this.hasCounterTarget) this.counterTarget.textContent = `${this.indexValue + 1}/${this.countValue}`
    this.applyTransform()
    const activeThumb = this.thumbnailTargets.find((t) => Number(t.dataset.index) === this.indexValue)
    activeThumb?.scrollIntoView({ block: "nearest" })
  }

  applyTransform() {
    const active = this.imageTargets.find((img) => Number(img.dataset.index) === this.indexValue)
    if (active) active.style.transform = `scale(${this.scale}) rotate(${this.rotation}deg)`
  }

  _onKeydown(event) {
    if (event.key === "Escape") {
      this.collapse()
      if (this.hasMetadataPanelTarget && !this.metadataPanelTarget.hidden) {
        this.metadataPanelTarget.hidden = true
        this._syncMetadataToggle()
      }
    }
    if (this.countValue <= 1) return
    if (event.key === "ArrowRight") this.next()
    if (event.key === "ArrowLeft") this.prev()
  }
}

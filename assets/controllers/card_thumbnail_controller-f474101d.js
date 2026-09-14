import { Controller } from "@hotwired/stimulus"

// Samples the perimeter border of a card thumbnail image and sets the
// container's background-color to the dominant border colour.
//
// Why perimeter: museum photography places subjects against clean studio
// backgrounds. The full perimeter (top + bottom rows, left + right columns)
// gives hundreds of background pixels rather than four corner spots, which
// is far more robust against JPEG compression artefacts and slight vignettes
// near the corners.
//
// Why median over mean: a single dark shadow pixel at a corner can drag the
// mean noticeably warm/dark. The median bucket from a simple 8-level
// histogram per channel is immune to outliers — it represents what "most of
// the border is" rather than "the average of everything including the shadow".
//
// Usage:
//   <div data-controller="card-thumbnail">
//     <%= image_tag filename, data: { card_thumbnail_target: "img" } %>
//   </div>
export default class extends Controller {
  static targets = ["img"]

  connect() {
    if (!this.hasImgTarget) return
    const img = this.imgTarget
    if (img.complete && img.naturalWidth > 0) {
      this.#apply(img)
    } else {
      img.addEventListener("load", () => this.#apply(img), { once: true })
    }
  }

  #apply(img) {
    try {
      const SIDE   = 80   // downsample resolution
      const BORDER = 10   // perimeter band width in sampled pixels

      const canvas = document.createElement("canvas")
      canvas.width  = SIDE
      canvas.height = SIDE
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      ctx.drawImage(img, 0, 0, SIDE, SIDE)

      // Collect every pixel in the perimeter band (top, bottom, left, right)
      const rBuckets = new Uint32Array(256)
      const gBuckets = new Uint32Array(256)
      const bBuckets = new Uint32Array(256)
      let total = 0

      const record = (data) => {
        for (let i = 0; i < data.length; i += 4) {
          rBuckets[data[i]]++
          gBuckets[data[i + 1]]++
          bBuckets[data[i + 2]]++
          total++
        }
      }

      record(ctx.getImageData(0,              0,              SIDE,   BORDER).data) // top
      record(ctx.getImageData(0,              SIDE - BORDER,  SIDE,   BORDER).data) // bottom
      record(ctx.getImageData(0,              BORDER,         BORDER, SIDE - BORDER * 2).data) // left
      record(ctx.getImageData(SIDE - BORDER,  BORDER,         BORDER, SIDE - BORDER * 2).data) // right

      // Median: walk histogram until we hit the 50th-percentile pixel
      const medianChannel = (buckets) => {
        const half = total / 2
        let seen = 0
        for (let v = 0; v < 256; v++) {
          seen += buckets[v]
          if (seen >= half) return v
        }
        return 255
      }

      const r = medianChannel(rBuckets)
      const g = medianChannel(gBuckets)
      const b = medianChannel(bBuckets)

      this.element.style.backgroundColor = `rgb(${r},${g},${b})`
    } catch (_) {
      // Canvas unavailable or tainted — placeholder background stands
    }
  }
}

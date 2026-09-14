import { Controller } from "@hotwired/stimulus"

// Horizontal scroll-snap carousel (homepage "New to the collections" row).
// Prev/next buttons scroll by one track's visible width; native scroll-snap
// (see .uom-ds-carousel-track in patterns.css) handles the rest, including
// touch/trackpad swipe, so this controller only drives the two buttons.
export default class extends Controller {
  static targets = ["track"]

  scrollBy(event) {
    const direction = event.params.direction === "prev" ? -1 : 1
    this.trackTarget.scrollBy({ left: direction * this.trackTarget.clientWidth * 0.9, behavior: "smooth" })
  }
}

import { Controller } from "@hotwired/stimulus"

// Purely-visual dismiss for a banner — no persistence, matching the
// reference prototype's own "Dismiss banner (purely visual)" behaviour
// (ccs-v1-script.js's renderHome, ack-banner-dismiss).
export default class extends Controller {
  close() {
    this.element.remove()
  }
}

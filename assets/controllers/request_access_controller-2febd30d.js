import { Controller } from "@hotwired/stimulus"

// Item record page's "Request to view/use" / "Contact collection" dialog
// (CatalogHelper#record_contact_href pre-renders one link per reason as an
// <option data-href>, same shape as citation_controller.js) — this only
// swaps the "Send request" link's href to match the selected reason.
export default class extends Controller {
  static targets = ["select", "link"]

  update() {
    this.linkTarget.href = this.selectTarget.selectedOptions[0].dataset.href
  }
}

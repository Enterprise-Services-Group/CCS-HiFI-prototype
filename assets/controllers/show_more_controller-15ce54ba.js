import { Controller } from "@hotwired/stimulus"

// Generic "Show more X" disclosure for the /collections page's browse
// sections (Themes, Topics, Centuries, Latest galleries, Providing
// institutions, Features) — reveals a hidden extra batch of cards in place
// and swaps the trigger label, matching Europeana's collections-page pattern.
export default class extends Controller {
  static targets = ["extra", "button", "label"]
  static values = {
    showText: { type: String, default: "Show more" },
    hideText: { type: String, default: "Show less" }
  }

  toggle() {
    const opening = this.extraTarget.hidden
    this.extraTarget.hidden = !opening
    this.labelTarget.textContent = opening ? this.hideTextValue : this.showTextValue
    this.buttonTarget.setAttribute("aria-expanded", opening ? "true" : "false")
  }
}

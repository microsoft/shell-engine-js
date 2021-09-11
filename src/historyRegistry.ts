import { Disposable } from "./lifecycle.js";

export class HistoryRegistry extends Disposable {
  entries: string[] = [];

  addEntry(entry: string) {
    // Don't add empty entry
    if (entry.length === 0) {
      return;
    }
    // Don't add duplicates
    if (this.entries.length > 0 && this.entries[this.entries.length - 1] === entry) {
      return;
    }
    this.entries.push(entry);
  }
}

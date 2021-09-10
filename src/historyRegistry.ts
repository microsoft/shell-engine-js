import { Disposable } from "./lifecycle";

export class HistoryRegistry extends Disposable {
  entries: string[] = [];
}

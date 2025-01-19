import type { Class } from "./utils/export-classes";

export const enum EventType {
    GoogleSync,
}

export interface GoogleSync {
    event: EventType.GoogleSync;
    classes: Class[];
}

export type ExtensionEvent = GoogleSync;

import type { Class } from "../utils/export-classes";

export const enum EventType {
    GoogleSync,
    RmpBasicMulti,
    WeeklyCalendar,
}

export interface GoogleSync {
    event: EventType.GoogleSync;
    classes: Class[];
}

export interface RmpBasicMulti {
    event: EventType.RmpBasicMulti;
    names: string[];
}

export type ExtensionEvent = GoogleSync | RmpBasicMulti;

import type { Class } from "../utils/export-classes";

export const enum EventType {
    GoogleCalendarList,
    GooglePush,
    RmpBasicMulti,
    WeeklyCalendar,
}

export interface GoogleCalendarList {
    event: EventType.GoogleCalendarList;
}

export interface GooglePush {
    event: EventType.GooglePush;
    classes: Class[];
}

export interface RmpBasicMulti {
    event: EventType.RmpBasicMulti;
    names: string[];
}

export type ExtensionEvent = GoogleCalendarList | GooglePush | RmpBasicMulti;

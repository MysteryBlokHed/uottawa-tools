import type { Class } from "../utils/export-classes";

export const enum EventType {
    GoogleCalendarList,
    GooglePush,
    RmpBasicMulti,
    WeeklyCalendar,
    ProfessorAiCompletion,
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

export interface ProfessorAiCompletion {
    event: EventType.ProfessorAiCompletion;
    professorId: string;
    courseCode: string;
    courseName: string;
    prompt: string;
}

export type ExtensionEvent =
    | GoogleCalendarList
    | GooglePush
    | RmpBasicMulti
    | ProfessorAiCompletion;

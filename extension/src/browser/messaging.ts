import type { Class } from "../utils/export-classes";

export const enum ExtensionEventType {
    GoogleCalendarList,
    GooglePush,
    RmpBasicMulti,
    WeeklyCalendar,
    ProfessorAiCompletion,
    MultiProfessorAiCompletion,
}

export interface GoogleCalendarList {
    event: ExtensionEventType.GoogleCalendarList;
}

export interface GooglePush {
    event: ExtensionEventType.GooglePush;
    classes: Class[];
}

export interface RmpBasicMulti {
    event: ExtensionEventType.RmpBasicMulti;
    names: string[];
}

export interface ProfessorAiCompletion {
    event: ExtensionEventType.ProfessorAiCompletion;
    professorId: string;
    courseCode: string;
    courseName: string;
    prompt: string;
}

export interface MultiProfessorContext {
    id: string;
    course: string;
    course_display: string;
}

export interface MultiProfessorAiCompletion {
    event: ExtensionEventType.MultiProfessorAiCompletion;
    professors: MultiProfessorContext[];
    prompt: string;
}

export type ExtensionEvent =
    | GoogleCalendarList
    | GooglePush
    | RmpBasicMulti
    | ProfessorAiCompletion
    | MultiProfessorAiCompletion;

export const enum IncomingExtensionEventType {
    ProfessorAiStreamStart,
    ProfessorAiStreamChunk,
    ProfessorAiStreamEnd,
    ProfessorAiStreamFail,
}

export interface ProfessorAiStreamStart {
    event: IncomingExtensionEventType.ProfessorAiStreamStart;
}

export interface ProfessorAiStreamChunk {
    event: IncomingExtensionEventType.ProfessorAiStreamChunk;
    delta: string;
}

export interface ProfessorAiStreamEnd {
    event: IncomingExtensionEventType.ProfessorAiStreamEnd;
}

export interface ProfessorAiStreamFail {
    event: IncomingExtensionEventType.ProfessorAiStreamFail;
    reason: unknown;
}

export type IncomingExtensionEvent =
    | ProfessorAiStreamStart
    | ProfessorAiStreamChunk
    | ProfessorAiStreamEnd
    | ProfessorAiStreamFail;

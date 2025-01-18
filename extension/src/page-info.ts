import type { Class } from "./utils/export-classes.js";
import { readSchedule } from "./utils/export-classes.js";

export enum CurrentPage {
    Unknown = -1,
    ClassSchedule,
}

export interface BasePageMeta {
    page: CurrentPage;
}

export interface UnknownPageMeta extends BasePageMeta {
    page: CurrentPage.Unknown;
}

export interface ClassScheduleMeta extends BasePageMeta {
    page: CurrentPage.ClassSchedule;
    classes: Class[];
}

export type PageMeta = UnknownPageMeta | ClassScheduleMeta;

export function identifyPage(): PageMeta {
    const classes = readSchedule();
    if (classes?.[0] != null)
        return {
            page: CurrentPage.ClassSchedule,
            classes,
        };
    return { page: CurrentPage.Unknown };
}

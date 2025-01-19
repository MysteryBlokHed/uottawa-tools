import type { Class } from "../utils/export-classes.js";
import { readSchedule } from "../utils/export-classes.js";

export enum CurrentPage {
    Unknown = -1,
    ClassSchedule,
    ClassSelector,
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

export interface ClassSelector extends BasePageMeta {
    page: CurrentPage.ClassSelector;
    rows: HTMLTableRowElement[];
}

export type PageMeta = UnknownPageMeta | ClassScheduleMeta | ClassSelector;

export function identifyPage(): PageMeta {
    // Class schedule page
    {
        const classes = readSchedule();
        if (classes?.[0] != null)
            return {
                page: CurrentPage.ClassSchedule,
                classes,
            };
    }

    // Class selection page
    {
        const rows = document.querySelectorAll<HTMLTableRowElement>("[id*=trSSR_CLSRCH_MTG1]");
        if (rows.length) return { page: CurrentPage.ClassSelector, rows: Array.from(rows) };
    }

    return { page: CurrentPage.Unknown };
}

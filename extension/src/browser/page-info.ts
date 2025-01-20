import type { Class } from "../utils/export-classes.js";
import { readSchedule } from "../utils/export-classes.js";

export enum CurrentPage {
    Unknown = -1,
    ClassSchedule,
    ClassSelector,
    WeeklyCalendar,
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

export interface WeeklyCalendarMeta extends BasePageMeta {
    page: CurrentPage.WeeklyCalendar;
    filtersContainer: HTMLDivElement;
}

export interface ClassSelector extends BasePageMeta {
    page: CurrentPage.ClassSelector;
    rows: HTMLTableRowElement[];
}

export type PageMeta = UnknownPageMeta | ClassScheduleMeta | ClassSelector | WeeklyCalendarMeta;

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

    // Weekly calendar
    {
        const container = document.querySelector<HTMLDivElement>("div[id*=DERIVED_CLASS_S_MONDAY_LBL]");
        if (container != null)
            return { page: CurrentPage.WeeklyCalendar, filtersContainer: container };
    }

    return { page: CurrentPage.Unknown };
}

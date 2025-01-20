import type { EventAttributes } from "ics";

export interface ClassEvent {
    location: string;
    instructor: string;
    startDate: string;
    endDate: string;
    time: string;
}

export interface ClassEventDates {
    location: string;
    instructor: string;
    startDate: Date;
    endEventDate: Date;
    endRecurDate: Date;
}

export interface ClassComponent {
    classNumber: number;
    section: string;
    component: string;
    event: ClassEventDates;
}

export interface Class {
    code: string;
    name: string;
    components: ClassComponent[];
}

/**
 * Reads the class list from the class schedule page and converts into a more usable object.
 * Dates and times still need to be processed into a useful format.
 */
export function readSchedule() {
    // Read all rows that correspond to courses
    const rows = document.querySelectorAll<HTMLTableRowElement>("tr[id*=trCLASS_MTG_VW]");

    const classes: Class[] = [];
    let lastParent: HTMLElement | null = null;
    let currentClass: Class | null = null;
    // Rows do not contain repeat information for some fields, so we need to know what was the last values were
    let lastClassNumber: number | null = null;
    let lastSection: string | null = null;
    let lastComponentName: string | null = null;

    for (const row of rows.values()) {
        // This row is part of a new class
        if (row.parentElement !== lastParent) {
            if (currentClass) classes.push(currentClass);
            // prettier-ignore
            const nameAndCode: string =
                // @ts-expect-error I am not annotating all of this
                row.parentElement.parentElement.parentElement.parentElement.parentElement
                    .parentElement.parentElement.parentElement.parentElement.parentElement
                    // @ts-expect-error I am not annotating all of this
                    .parentElement.parentElement.parentElement.parentElement.children[0].innerText;

            // Create new class
            const [code, name] = nameAndCode.split(" - ");
            currentClass = { name, code, components: [] };
            lastParent = row.parentElement;
        }
        // Get the columns of this row and read values accordingly
        const children = row.children as HTMLCollectionOf<HTMLTableColElement>;
        const classNumber: number = children[0].innerText.trim()
            ? parseInt(children[0].innerText.trim())
            : lastClassNumber!;
        lastClassNumber = classNumber;
        const section: string = children[1].innerText.trim() || lastSection!;
        lastSection = section;
        const component: string = children[2].innerText.trim() || lastComponentName!;
        lastComponentName = component;
        const time = children[3].innerText;
        const location = children[4].innerText;
        const instructor = children[5].innerText;
        const [startDateStr, endDateStr] = children[6].innerText.split(" - ");

        const [weekday, startTimeStr, endTimeStr] = eventToStartAndEnd(time);
        const startDate = getNextWeekday(startDateStr, weekday);

        const endRecurDate = new Date(endDateStr);

        const [, startHourStr, startMinuteStr, startPeriod] = startTimeStr.match(TIME_EXP)!;
        const [, endHourStr, endMinuteStr, endPeriod] = endTimeStr.match(TIME_EXP)!;

        const [startHour, startMinute] = timeTo24Hour(
            parseInt(startHourStr),
            parseInt(startMinuteStr),
            startPeriod as 'AM' | 'PM',
        );
        const [endHour, endMinute] = timeTo24Hour(
            parseInt(endHourStr),
            parseInt(endMinuteStr),
            endPeriod as 'AM' | 'PM',
        );

        startDate.setHours(startHour);
        startDate.setMinutes(startMinute);
        const endEventDate = structuredClone(startDate);
        endEventDate.setHours(endHour);
        endEventDate.setMinutes(endMinute);

        // Add this class component to our current class
        currentClass!.components.push({
            classNumber,
            section,
            component,
            event: { location, instructor, startDate, endEventDate, endRecurDate },
        });
    }

    // Add remaining class, and return
    classes.push(currentClass!);
    return classes;
}

/**
 * @param day The day to convert (eg. `"Su"`, `"Mo"`, ...)
 * @returns Weekday (0 = Sunday, ...)
 * @throws {Error} If the provided day is invalid
 */
export function twoLetterToWeekday(day: string): number {
    switch (day) {
        case "Su":
            return 0;
        case "Mo":
            return 1;
        case "Tu":
            return 2;
        case "We":
            return 3;
        case "Th":
            return 4;
        case "Fr":
            return 5;
        case "Sa":
            return 6;
    }
    throw new Error(`Invalid day: ${day}`);
}

/**
 * Given a start date, move it forwards to the next weekday
 * @param date The date to move forward, MM/DD/YYYY format.
 * @param day The weekday to forward to (0 = Sunday, ...)
 * @returns Adjusted {@link Date}
 */
export function getNextWeekday(date: string, day: number) {
    const d = new Date(date);
    const currentDay = d.getDay();
    const daysUntilTarget = (day - currentDay + 7) % 7;
    d.setDate(d.getDate() + daysUntilTarget);
    return d;
}

/**
 * Given a start date, move it backwards to the previous weekday
 * @param date The date to move forward, MM/DD/YYYY format.
 * @param day The weekday to forward to (0 = Sunday, ...)
 * @returns Adjusted {@link Date}
 */
export function getPrevWeekday(date: string, day: number) {
    const d = new Date(date);
    const currentDay = d.getDay();
    const daysUntilTarget = (currentDay - day + 7) % 7;
    d.setDate(d.getDate() - daysUntilTarget);
    return d;
}

/**
 * Parses an event into a weekday, start date, and end date.
 * Should call {@link getNextWeekday} and {@link getPrevWeekday} to fix dates.
 */
export function eventToStartAndEnd(time: string) {
    const weekdayStr = time.slice(0, 2);
    const weekday = twoLetterToWeekday(weekdayStr);
    const [startTime, endTime] = time.slice(3).split(" - ");
    return [weekday, startTime, endTime] as const;
}

/** Regex to match a start/end time */
const TIME_EXP = /^(\d{1,2}):(\d{1,2})([AP]M)$/;

function timeTo24Hour(hours: number, minutes: number, period: "AM" | "PM") {
    let formattedHours = hours;

    if (period === "PM" && hours !== 12) {
        formattedHours += 12;
    } else if (period === "AM" && hours === 12) {
        formattedHours = 0;
    }

    return [formattedHours, minutes];
}

export function classToEvents(classInfo: Class): EventAttributes[] {
    const { code, name, components } = classInfo;
    return components.map<EventAttributes>(component => {
        const { startDate, endEventDate, endRecurDate } = component.event;

        const recurrenceEnd = `${endRecurDate.getUTCFullYear().toString()}${(endRecurDate.getUTCMonth() + 1).toString().padStart(2, "0")}${endRecurDate.getUTCDate().toString().padStart(2, "0")}000000Z`;

        return {
            title: `${code} ${name} ${component.component}`,
            description: `Room: ${component.event.location}\nInstructor: ${component.event.instructor}\nSection: ${component.section}\n\nExported with uOttawa Tools`,
            startInputType: "utc",
            start: [
                startDate.getUTCFullYear(),
                startDate.getUTCMonth() + 1,
                startDate.getUTCDate(),
                startDate.getUTCHours(),
                startDate.getUTCMinutes(),
            ],
            end: [
                endEventDate.getUTCFullYear(),
                endEventDate.getUTCMonth() + 1,
                endEventDate.getUTCDate(),
                endEventDate.getUTCHours(),
                endEventDate.getUTCMinutes(),
            ],
            recurrenceRule: `FREQ=WEEKLY;UNTIL=${recurrenceEnd}`,
        };
    });
}

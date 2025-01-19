import type { ClassEvent, Class } from "./export-classes";

const BATCH_ENDPOINT = "https://www.googleapis.com/batch/calendar/v3";

export async function bulkCreateEvents(
    token: string,
    calendarId: string,
    classes: readonly Class[],
) {
    const batchRequests = classes
        .flatMap(classInfo =>
            classInfo.components.flatMap(component => {
                component.event.endRecurDate = new Date(component.event.endRecurDate);
                const recurrenceEnd = `${component.event.endRecurDate.getUTCFullYear().toString()}${(component.event.endRecurDate.getUTCMonth() + 1).toString().padStart(2, "0")}${component.event.endRecurDate.getUTCDate().toString().padStart(2, "0")}T000000Z`;
                console.log(recurrenceEnd);

                return {
                    summary: `${classInfo.code} ${classInfo.name} ${component.component}`,
                    description: `Room: ${component.event.location}\nInstructor: ${component.event.instructor}\nSection: ${component.section}\n\nExported with uOttawa Tools`,
                    location: component.event.location,
                    transparency: "opaque",
                    start: {
                        dateTime: component.event.startDate,
                        timeZone: "Etc/UTC",
                    },
                    end: {
                        dateTime: component.event.endEventDate,
                        timeZone: "Etc/UTC",
                    },
                    recurrence: [`RRULE:FREQ=WEEKLY;UNTIL=${recurrenceEnd}`],
                };
            }),
        )
        .map((event, index) => {
            const eventData = JSON.stringify(event);
            return `--batch_boundary
Content-Type: application/http
Content-ID: <item${index + 1}>

POST /calendar/v3/calendars/${calendarId}/events
Content-Type: application/json

${eventData}
`;
        })
        .join("\n");

    const batchBody = `${batchRequests}\n--batch_boundary--`;

    const response = await fetch(BATCH_ENDPOINT, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/mixed; boundary=batch_boundary",
        },
        body: batchBody,
    });

    if (!response.ok) {
        throw new Error("Failed to create events in batch");
    }

    return response.text();
}

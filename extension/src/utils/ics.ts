import * as ics from "ics";

export function createEvent(event: Parameters<(typeof ics)["createEvent"]>[0]): Promise<string> {
    return new Promise((resolve, reject) => {
        ics.createEvent(event, (error, value) => {
            if (error) reject(error);
            resolve(value);
        });
    });
}

export function createEvents(events: Parameters<(typeof ics)["createEvents"]>[0]): Promise<string> {
    return new Promise((resolve, reject) => {
        ics.createEvents(events, (error, value) => {
            if (error) reject(error);
            resolve(value);
        });
    });
}

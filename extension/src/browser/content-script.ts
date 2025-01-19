import { EventType, type ExtensionEvent } from "./messaging.js";
import { CurrentPage, identifyPage } from "./page-info.js";
import { classToEvents } from "../utils/export-classes";
import { createEvents } from "../utils/ics";

(async () => {
    const page = identifyPage();
    console.log("Identified page", page);

    switch (page.page) {
        case CurrentPage.ClassSchedule: {
            const row = document.querySelector<HTMLTableRowElement>("tr[id*=trCLASS_MTG_VW]");
            const btnContainer =
                // @ts-expect-error This UI is terrible and this is the best idea I've got
                row.parentElement.parentElement.parentElement.parentElement.parentElement
                    .parentElement.parentElement.parentElement.parentElement.parentElement
                    .parentElement.parentElement.parentElement.parentElement.parentElement
                    .parentElement.parentElement.parentElement.parentElement.parentElement
                    .parentElement;

            const icsButton = document.createElement("button");
            icsButton.type = "button";
            icsButton.style.width = "100%";
            icsButton.innerText = "Export to iCalendar (.ics)";
            icsButton.onclick = async ev => {
                ev.stopImmediatePropagation();
                const events = await createEvents(page.classes.flatMap(classToEvents));
                const blob = new Blob([events], { type: "text/calendar" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "schedule.ics";
                link.click();
            };

            const googleCalButton = document.createElement("button");
            googleCalButton.type = "button";
            googleCalButton.style.width = "100%";
            googleCalButton.innerText = "Export to Google Calendar";
            googleCalButton.onclick = async ev => {
                const response = await chrome.runtime.sendMessage<ExtensionEvent>({
                    event: EventType.GoogleSync,
                    classes: page.classes,
                });
                console.log(response);
            };

            btnContainer!.prepend(googleCalButton);
            btnContainer!.prepend(icsButton);
        }
    }
})();

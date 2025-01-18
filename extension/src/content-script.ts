import { CurrentPage, identifyPage } from "./page-info.js";
import { classToEvents } from "./utils/export-classes";
import { createEvent, createEvents } from "./utils/ics";

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

            const button = document.createElement("button");
            button.type = "button";
            button.style.width = "100%";
            button.innerText = "Export to iCalendar (.ics)";
            button.onclick = async ev => {
                ev.stopImmediatePropagation();
                const events = await createEvents(page.classes.flatMap(classToEvents));
                const blob = new Blob([events], { type: "text/calendar" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "schedule.ics";
                link.click();
            };

            btnContainer!.prepend(button);
        }
    }
})();

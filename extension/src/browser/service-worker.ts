/// <reference lib="webworker" />
import { EventType, type ExtensionEvent } from "./messaging.js";
import { bulkCreateEvents } from "../utils/google.js";

chrome.runtime.onMessage.addListener(async (message: ExtensionEvent, sender, sendResponse) => {
    switch (message.event) {
        case EventType.GoogleSync: {
            console.log("Sync request received");
            const token = await chrome.identity.getAuthToken({ interactive: true });
            if (!token.token) return;
            console.log("Got token");
            const response = await fetch(
                "https://www.googleapis.com/calendar/v3/users/me/calendarList",
                {
                    headers: {
                        Authorization: `Bearer ${token.token}`,
                    },
                },
            )
                .then(r => r.json())
                .catch(e => e || "error");
            console.log("got some form of response");
            const it = await response;
            console.log("response:", it);

            console.log("We are gonna try pushing calendar events");
            console.log("classes we got passed:", message.classes);
            const bulkR = await bulkCreateEvents(
                token.token,
                "placeholder",
                message.classes,
            ).catch(e => e || "error");
            console.log("bulk response:", bulkR);
        }
    }
});

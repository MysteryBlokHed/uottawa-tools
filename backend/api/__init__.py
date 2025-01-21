import aiohttp
from dotenv import load_dotenv
from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI

import os
from typing import Literal

from pydantic import BaseModel

from .ai import *
from .rmp import *

_ = load_dotenv()

app = FastAPI()

AI_MODEL = os.environ["OPENAI_MODEL"]
openai = AsyncOpenAI(
    base_url=os.environ.get("OPENAI_ENDPOINT"), api_key=os.environ["OPENAI_KEY"]
)


@app.get("/", description="Basic endpoint to verify that the API is running.")
def status() -> dict[Literal["status"], str]:
    return {"status": "Up and running."}


@app.get(
    "/stream_prof_feedback/{id}/{course}/{course_display}/{prompt}",
    description=(
        "Uses AI to get information about a professor based on Rate My Professors comments. "
        "Response are streamed instead of being returned all at once."
    ),
    response_description="The LLM completion result.",
    responses={
        404: {"description": "Professor feedback not found."},
        503: {"description": "Empty completion from AI."},
    },
)
async def stream_prof_feedback(id: str, course: str, course_display: str, prompt: str):
    # Get comments about prof
    async with aiohttp.ClientSession() as session:
        info = await get_professor_info(client=session, id=id, course=course)
    if info is None:
        raise HTTPException(status_code=404, detail="Professor feedback not found.")

    # Stream AI completion to frontend
    return StreamingResponse(
        generate_stream(
            client=openai,
            model=AI_MODEL,
            messages=create_prof_feedback_prompt(
                info=info,
                course=course,
                course_display=course_display,
            )
            + [
                {"role": "user", "content": prompt},
            ],
        ),
        media_type="text/plain",
    )


class MultiProfessorInfo(BaseModel):
    id: str
    course: str
    course_display: str


@app.post(
    "/stream_multi_prof_feedback/{prompt}",
    description=(
        "Uses AI to get information about multiple professors based on Rate My Professors comments. "
        "Response are streamed instead of being returned all at once."
    ),
    response_description="The LLM completion result.",
    responses={
        404: {"description": "Professor feedback not found."},
        503: {"description": "Failure from the AI."},
    },
)
async def stream_multi_prof_feedback(
    prompt: str,
    professors: list[MultiProfessorInfo] = Body(
        # pyright: ignore [reportCallInDefaultInitializer]
        ...
    ),
):
    async with aiohttp.ClientSession() as session:
        # Get professor names from IDs
        prof_data = await get_multi_basic_info(
            client=session,
            ids=map(
                lambda prof: prof.id,
                professors,
            ),
        )
        if prof_data is None:
            raise HTTPException(
                status_code=404,
                detail="Could not find professor(s) with specified ID(s).",
            )

        # Create ID->name mapping
        names_to_ids: dict[str, str] = {}
        for provided_info, returned_info in zip(professors, prof_data):
            name = f"{returned_info['firstName']} {returned_info['lastName']}"
            names_to_ids[name] = provided_info.id

        # Determine which professors we need information on
        try:
            identified = await identify_referenced_profs(
                client=openai,
                model=AI_MODEL,
                available_professors=names_to_ids,
                prompt=prompt,
            )
        except Exception as e:
            raise HTTPException(status_code=503, detail=str(e))

        ids_to_names = {v: k for k, v in names_to_ids.items()}
        print(
            "Determined that request is about:",
            ", ".join(map(lambda id: ids_to_names[id], identified)),
        )

        # Get more detailed information for relevant professors
        detailed_info = await get_multi_info(client=session, ids=identified)
        if detailed_info is None:
            raise HTTPException(
                status_code=404,
                detail="Failed to get info for identified professors.",
            )

    identified_prof_ids = filter(lambda prof: prof.id in identified, professors)
    multi_prof_context: map[MultiProfContext] = map(
        lambda x: {
            "info": x[1],
            "course": x[0].course,
            "course_display": x[0].course_display,
        },
        zip(identified_prof_ids, detailed_info),
    )

    # Finally, stream AI completion to frontend
    return StreamingResponse(
        generate_stream(
            client=openai,
            model=AI_MODEL,
            messages=(
                create_multi_prof_feedback_prompt(info=multi_prof_context)
                + [{"role": "user", "content": prompt}]
            ),
        ),
        media_type="text/plain",
    )

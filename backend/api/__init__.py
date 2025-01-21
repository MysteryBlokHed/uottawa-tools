import aiohttp
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI

import os
from typing import Literal

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
                id=id,
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

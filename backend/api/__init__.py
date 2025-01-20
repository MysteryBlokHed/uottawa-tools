import aiohttp
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam

import os
from typing import Literal

from .rmp import *

_ = load_dotenv()

app = FastAPI()

AI_MODEL = os.environ["OPENAI_MODEL"]
openai = AsyncOpenAI(
    base_url=os.environ.get("OPENAI_ENDPOINT"), api_key=os.environ["OPENAI_KEY"]
)

aio_client = aiohttp.ClientSession()


@app.get("/", description="Basic endpoint to verify that the API is running.")
def status() -> dict[Literal["status"], str]:
    return {"status": "Up and running."}


def format_feedback(feedback: dict[Literal["node"], ProfessorRating]) -> str:
    node = feedback["node"]
    return f"<userFeedback>\n<clarityRating>{node['clarityRating']}/5.0</clarityRating>\n<difficultyRating>{node['difficultyRating']}/5.0</difficultyRating>\n<helpfulRating>{node['helpfulRating']}/5.0</helpfulRating>\n<comment>{node['comment']}</comment>\n</userFeedback>"


def create_prof_feedback_prompt(
    *, info: ProfessorInfo, course: str, course_display: str
) -> list[ChatCompletionMessageParam]:
    prompt_comments = "\n".join(map(format_feedback, info["ratings"]["edges"]))
    return [
        {
            "role": "system",
            "content": "You are an assistant designed to help users get information on their professors at the University of Ottawa. The following is information on a particular professor. Answer any questions that a user may have about this professor. All ratings are on a five-point scale unless otherwise specified.",
        },
        {
            "role": "system",
            "content": f"<professorName>{info['firstName']} {info['lastName']}</professorName>\n<avgRating>{info['avgRating']}</avgRating>\n<avgDifficulty>{info['avgDifficulty']}</avgDifficulty>\n<courseCode>{course}</courseCode>\n<courseCodeDisplay>{course_display}</courseCodeDisplay>\n<userFeedbackSection>\n{prompt_comments}\n</userFeedbackSection>",
        },
    ]


@app.get(
    "/prof_feedback/{id}/{course}/{course_display}/{prompt}",
    description="Uses AI to get information about a professor based on Rate My Professors comments.",
    response_description="The LLM completion result.",
    responses={
        404: {"description": "Professor feedback not found."},
        503: {"description": "Empty completion from AI."},
    },
)
async def get_prof_feedback(
    id: str, course: str, course_display: str, prompt: str
) -> str:
    # Get comments about prof
    info = await get_professor_info(client=aio_client, id=id, course=course)
    if info is None:
        raise HTTPException(status_code=404, detail="Professor feedback not found.")

    # Get AI completion (not streamed)
    chat_completion = await openai.chat.completions.create(
        messages=create_prof_feedback_prompt(
            info=info, course=course, course_display=course_display
        )
        + [
            {"role": "user", "content": prompt},
        ],
        model=AI_MODEL,
        temperature=0.5,
    )
    result = chat_completion.choices[0].message.content
    if result is None:
        raise HTTPException(status_code=503, detail="Empty completion from AI.")
    return result

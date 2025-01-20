from dotenv import load_dotenv
from fastapi import FastAPI
from openai import OpenAI

import os

from rmp import *

_ = load_dotenv()

app = FastAPI()

AI_MODEL = os.environ["OPENAI_MODEL"]
openai = OpenAI(base_url=os.environ.get("OPENAI_ENDPOINT"),api_key=os.environ["OPENAI_KEY"])

@app.get("/", description="Basic endpoint to verify that the API is running.")
def read_root():
    return {"status": "Up and running."}


def format_feedback(feedback: Any):
    node = feedback["node"]
    return f"<userFeedback>\n<clarityRating>{node['clarityRating']}/5.0</clarityRating>\n<difficultyRating>{node['difficultyRating']}/5.0</difficultyRating>\n<helpfulRating>{node['helpfulRating']}/5.0</helpfulRating>\n<comment>{node['comment']}</comment>\n</userFeedback>"


@app.get(
    "/prof_feedback/{id}/{course}/{course_display}/{prompt}",
    description="Uses Groq to get information about a professor based on Rate My Professors comments.",
    response_description="The LLM completion result.",
)
def do_stuff(id: str, course: str, course_display: str, prompt: str):
    # Get comments about prof
    comments = get_professor_info(id, course)
    if comments is None:
        return None
    # Groq completion
    prompt_comments = "\n".join(map(format_feedback, comments["ratings"]["edges"]))

    chat_completion = openai.chat.completions.create(
        messages=[
            {
                "role": "system",
                "content": "You are an assistant designed to help users get information on their professors at the University of Ottawa. The following is information on a particular professor. Answer any questions that a user may have about this professor. All ratings are on a five-point scale unless otherwise specified.",
            },
            {
                "role": "system",
                "content": f"<professorName>{comments['firstName']} {comments['lastName']}</professorName>\n<avgRating>{comments['avgRating']}</avgRating>\n<avgDifficulty>{comments['avgDifficulty']}</avgDifficulty>\n<courseCode>{course}</courseCode>\n<courseCodeDisplay>{course_display}</courseCodeDisplay>\n<userFeedbackSection>\n{prompt_comments}\n</userFeedbackSection>",
            },
            {"role": "user", "content": prompt},
        ],
        model=AI_MODEL,
        temperature=0.5,
    )
    return chat_completion.choices[0].message.content

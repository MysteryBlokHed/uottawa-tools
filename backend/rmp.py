"""Wrappers around Rate My Professors APIs."""

from typing import Any
import requests

import base64
import json

ENDPOINT = "https://www.ratemyprofessors.com/graphql"
AUTH = f"Basic {base64.b64encode('test:test'.encode('utf-8')).decode()}"
SCHOOL_ID = base64.b64encode("School-1452".encode("utf-8")).decode()


def get_professor_info(id: str, course: str) -> Any | None:
    r = requests.post(
        ENDPOINT,
        headers={
            "Accept": "*/*",
            "Authorization": AUTH,
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
        },
        json={
            "query": f"""query {{ node(id: {json.dumps(id)} ) {{ ... on Teacher {{ firstName lastName avgRating avgDifficulty ratings(first: 25, courseFilter: {json.dumps(course)}) {{ edges {{ node {{ comment helpfulRating difficultyRating clarityRating }} }} }} }} }}  }}"""
        },
    )
    response = r.json()
    if "errors" in response:
        return None
    ratings = response["data"]["node"]["ratings"]["edges"]
    if len(ratings) == 0:
        # Do request without course filter
        r = requests.post(
            ENDPOINT,
            headers={
                "Accept": "*/*",
                "Authorization": AUTH,
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json",
            },
            json={
                "query": f"""query {{ node(id: {json.dumps(id)} ) {{ ... on Teacher {{ firstName lastName avgRating avgDifficulty ratings(first: 25) {{ edges {{ node {{ comment helpfulRating difficultyRating clarityRating }} }} }} }} }}  }}"""
            },
        )
        response = r.json()
        if "errors" in response:
            return None

    return response["data"]["node"]

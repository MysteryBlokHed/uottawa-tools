# uOttawa Tools Backend

This is a simple HTTP API, used to get AI completions for the "Ask AI" feature.

## Setup

### API Keys

This code will work with any OpenAI-compatible backend.
The project expects the following env variables:

```sh
# Optional, defaults to OpenAI
OPENAI_ENDPOINT=https://api.openai.com/v1
# Auth token for chosen endpoint
OPENAI_KEY=abcd
# LLM to use
OPENAI_MODEL=gpt-4o-mini
```

### Dependencies

First, it's best to create a new virtual environment:

```sh
python -m venv venv
source venv/bin/activate
```

Then, install the requirements:

```sh
pip install -r requirements.txt
```

## Running

To run the project, just run the following:

```sh
fastapi run main.py
```

By default, this listens on all interfaces on port 8000.

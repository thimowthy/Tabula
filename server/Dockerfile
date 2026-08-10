FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir -e ".[dev]"

EXPOSE 8420

CMD ["uvicorn", "tabula_server.main:app", "--app-dir", "src", "--host", "0.0.0.0", "--port", "8420", "--reload"]

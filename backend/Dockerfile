# Production image of the ModernSI backend: one image for the API, the worker and the one-shot init (migrations, demo seed).
# Dependencies come from uv.lock; the image runs as a non-root user.
# This work made by Anfinogentov Nikita
FROM python:3.14-slim-trixie AS build
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never UV_PROJECT_ENVIRONMENT=/app/.venv
RUN pip install --no-cache-dir uv==0.11.32
WORKDIR /app
# the dependencies first, so a code change does not reinstall them; the uv cache survives a uv.lock change
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev --no-install-project
COPY alembic.ini ./
COPY migrations ./migrations
COPY src ./src
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen --no-dev

FROM python:3.14-slim-trixie
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PATH=/app/.venv/bin:$PATH
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin modernsi
WORKDIR /app
COPY --from=build /app /app
USER modernsi
EXPOSE 8040
# The API by default; compose runs the worker and the init from the same image with another command
CMD ["uvicorn", "modernsi.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8040", "--no-server-header"]

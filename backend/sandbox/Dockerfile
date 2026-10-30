
FROM python:3.12-slim

ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTEST_DISABLE_PLUGIN_AUTOLOAD=1

RUN python -m pip install --no-cache-dir pytest==9.2.0

WORKDIR /workspace

# Run tests as an unprivileged user.
USER 65534:65534

# P0-INFRA-1: Convenience targets for idea2real development.
# Requires: Python 3.10+ and uv (or a venv with dev deps installed).

.PHONY: help bootstrap lint test docker-lint docker-test

help:
	@echo "Available targets:"
	@echo "  bootstrap    Set up local venv and install dev dependencies"
	@echo "  lint         Run flake8 on scripts/ and tests/"
	@echo "  test         Run pytest"
	@echo "  docker-lint  Run flake8 inside Docker"
	@echo "  docker-test  Run pytest inside Docker"

bootstrap:
	bash scripts/bootstrap.sh

lint:
	flake8 scripts/ tests/ --max-line-length=100

test:
	pytest tests/ -v

docker-lint:
	docker compose run --rm lint

docker-test:
	docker compose run --rm test

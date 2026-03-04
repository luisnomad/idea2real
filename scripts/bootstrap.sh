#!/usr/bin/env bash
# P0-INFRA-1: Local bootstrap — sets up Python venv and dev dependencies.
# Usage: bash scripts/bootstrap.sh
set -euo pipefail

VENV_DIR=".venv"
PYTHON_MIN="3.10"

# ── Python version check ──────────────────────────────────────────────────────
python_bin=""
for candidate in python3 python; do
    if command -v "$candidate" &>/dev/null; then
        version=$("$candidate" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        major=${version%%.*}
        minor=${version##*.}
        if [ "$major" -gt 3 ] || { [ "$major" -eq 3 ] && [ "$minor" -ge 10 ]; }; then
            python_bin="$candidate"
            break
        fi
    fi
done

if [ -z "$python_bin" ]; then
    echo "ERROR: Python ${PYTHON_MIN}+ is required but not found." >&2
    exit 1
fi

echo "Using $(${python_bin} --version)"

# ── Virtual environment ───────────────────────────────────────────────────────
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment at ${VENV_DIR}..."
    "$python_bin" -m venv "$VENV_DIR"
fi

# shellcheck disable=SC1091
source "${VENV_DIR}/bin/activate"

# ── Dependencies ──────────────────────────────────────────────────────────────
echo "Installing dev dependencies..."
pip install --quiet --upgrade pip
pip install --quiet pytest pyyaml flake8 requests

echo ""
echo "Bootstrap complete."
echo ""
echo "Next steps:"
echo "  source ${VENV_DIR}/bin/activate   # activate the venv"
echo "  make test                          # run unit tests"
echo "  make lint                          # run linter"
echo "  make docker-test                   # run tests in Docker"

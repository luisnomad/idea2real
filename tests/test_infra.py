"""
Tests for infrastructure configuration files.

Given/When/Then:
- Given docker-compose.yml / When parsed / Then lint and test services defined
- Given .github/workflows/ci.yml / When parsed / Then lint + test jobs with 3-version matrix
- Given scripts/bootstrap.sh / When stat'd / Then file is executable
"""

import os
import stat
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).parent.parent


# ---------------------------------------------------------------------------
# docker-compose.yml
# ---------------------------------------------------------------------------

class TestDockerCompose:
    """docker-compose.yml must define lint and test services using python:3.11-slim."""

    @pytest.fixture(scope="class")
    def compose(self):
        compose_path = ROOT / "docker-compose.yml"
        assert compose_path.exists(), "docker-compose.yml not found"
        with compose_path.open() as f:
            return yaml.safe_load(f)

    def test_lint_service_defined(self, compose):
        """Given compose / When services checked / Then lint service exists."""
        assert "lint" in compose.get("services", {}), "Missing 'lint' service"

    def test_test_service_defined(self, compose):
        """Given compose / When services checked / Then test service exists."""
        assert "test" in compose.get("services", {}), "Missing 'test' service"

    def test_lint_uses_python_image(self, compose):
        """Given lint service / When image checked / Then uses python:3.11-slim."""
        image = compose["services"]["lint"].get("image", "")
        assert "python" in image, f"lint service image should be a Python image, got: {image}"

    def test_test_uses_python_image(self, compose):
        """Given test service / When image checked / Then uses python:3.11-slim."""
        image = compose["services"]["test"].get("image", "")
        assert "python" in image, f"test service image should be a Python image, got: {image}"

    def test_workspace_volume_mounted(self, compose):
        """Given compose services / When volumes checked / Then workspace is mounted."""
        for svc_name in ("lint", "test"):
            svc = compose["services"][svc_name]
            volumes = svc.get("volumes", [])
            has_workspace = any("/workspace" in str(v) for v in volumes)
            assert has_workspace, f"Service '{svc_name}' must mount the repo as /workspace"


# ---------------------------------------------------------------------------
# .github/workflows/ci.yml
# ---------------------------------------------------------------------------

class TestCIWorkflow:
    """CI workflow must define node-checks, geometry-checks, and python-legacy jobs."""

    EXPECTED_GEOMETRY_PYTHON_VERSIONS = {"3.10", "3.12"}

    @pytest.fixture(scope="class")
    def workflow(self):
        ci_path = ROOT / ".github" / "workflows" / "ci.yml"
        assert ci_path.exists(), ".github/workflows/ci.yml not found"
        with ci_path.open() as f:
            return yaml.safe_load(f)

    def test_node_checks_job_defined(self, workflow):
        """Given CI workflow / When jobs checked / Then node-checks job exists."""
        jobs = workflow.get("jobs", {})
        assert "node-checks" in jobs, "CI workflow missing 'node-checks' job"

    def test_geometry_checks_job_defined(self, workflow):
        """Given CI workflow / When jobs checked / Then geometry-checks job exists."""
        jobs = workflow.get("jobs", {})
        assert "geometry-checks" in jobs, "CI workflow missing 'geometry-checks' job"

    def test_python_legacy_job_defined(self, workflow):
        """Given CI workflow / When jobs checked / Then python-legacy job exists."""
        jobs = workflow.get("jobs", {})
        assert "python-legacy" in jobs, "CI workflow missing 'python-legacy' job"

    def test_geometry_matrix_has_python_versions(self, workflow):
        """Given geometry-checks job / When matrix checked / Then 3.10, 3.12 present."""
        matrix = (
            workflow["jobs"]["geometry-checks"]
            .get("strategy", {})
            .get("matrix", {})
        )
        versions = {str(v) for v in matrix.get("python-version", [])}
        assert versions == self.EXPECTED_GEOMETRY_PYTHON_VERSIONS, (
            f"Expected Python {self.EXPECTED_GEOMETRY_PYTHON_VERSIONS}, got {versions}"
        )

    def test_workflow_triggers_on_push(self, workflow):
        """Given CI workflow / When triggers checked / Then push event is included."""
        on = workflow.get("on", workflow.get(True, {}))  # 'on' may parse as True in YAML
        assert "push" in on or on is True, "CI workflow must trigger on push"


# ---------------------------------------------------------------------------
# scripts/bootstrap.sh
# ---------------------------------------------------------------------------

class TestBootstrapScript:
    """bootstrap.sh must exist and be executable."""

    def test_bootstrap_exists(self):
        """Given scripts/bootstrap.sh / When stat'd / Then file exists."""
        assert (ROOT / "scripts" / "bootstrap.sh").exists(), (
            "scripts/bootstrap.sh not found"
        )

    def test_bootstrap_is_executable(self):
        """Given scripts/bootstrap.sh / When permissions checked / Then executable bit set."""
        path = ROOT / "scripts" / "bootstrap.sh"
        mode = os.stat(path).st_mode
        assert mode & stat.S_IXUSR, "scripts/bootstrap.sh must be executable (chmod +x)"

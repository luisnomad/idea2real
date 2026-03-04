"""
Tests for scripts/compare-providers.py pure functions.

Given/When/Then:
- Given a PNG file / When image_to_data_url is called / Then returns valid data URL
- Given result dicts / When generate_report is called / Then COMPARISON.md is created
- Given PROVIDERS dict / When each entry is checked / Then required keys are present
"""

import base64
import importlib.util
import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

SCRIPTS_DIR = Path(__file__).parent.parent / "scripts"


def _load_compare_providers():
    """Load compare-providers.py (hyphenated filename) with fal_client mocked."""
    sys.modules.setdefault("fal_client", MagicMock())
    spec = importlib.util.spec_from_file_location(
        "compare_providers",
        SCRIPTS_DIR / "compare-providers.py",
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


cp = _load_compare_providers()


# ---------------------------------------------------------------------------
# image_to_data_url
# ---------------------------------------------------------------------------

class TestImageToDataUrl:
    """Given a local image file, image_to_data_url returns a valid data URL."""

    def test_png_returns_png_mime(self, tmp_path):
        """Given a .png file / When called / Then MIME type is image/png."""
        img_file = tmp_path / "test.png"
        img_file.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 8)  # minimal PNG header

        result = cp.image_to_data_url(str(img_file))

        assert result.startswith("data:image/png;base64,")

    def test_jpg_returns_jpeg_mime(self, tmp_path):
        """Given a .jpg file / When called / Then MIME type is image/jpeg."""
        img_file = tmp_path / "photo.jpg"
        img_file.write_bytes(b"\xff\xd8\xff" + b"\x00" * 8)  # minimal JPEG header

        result = cp.image_to_data_url(str(img_file))

        assert result.startswith("data:image/jpeg;base64,")

    def test_jpeg_extension_returns_jpeg_mime(self, tmp_path):
        """Given a .jpeg file / When called / Then MIME type is image/jpeg."""
        img_file = tmp_path / "photo.jpeg"
        img_file.write_bytes(b"\xff\xd8\xff" + b"\x00" * 8)

        result = cp.image_to_data_url(str(img_file))

        assert result.startswith("data:image/jpeg;base64,")

    def test_base64_content_decodes_to_original(self, tmp_path):
        """Given known bytes / When called / Then b64 payload round-trips correctly."""
        content = b"hello-world-image-bytes"
        img_file = tmp_path / "img.png"
        img_file.write_bytes(content)

        result = cp.image_to_data_url(str(img_file))

        _, payload = result.split(",", 1)
        assert base64.b64decode(payload) == content


# ---------------------------------------------------------------------------
# generate_report
# ---------------------------------------------------------------------------

class TestGenerateReport:
    """Given result dicts, generate_report writes a COMPARISON.md file."""

    def _sample_results(self):
        return [
            {
                "provider": "Hyper3D Rodin (Sketch)",
                "provider_id": "rodin-sketch",
                "time_seconds": 45.2,
                "est_cost": 0.10,
                "mesh_path": "/tmp/mesh.glb",
                "mesh_size_kb": 1024.0,
                "success": True,
                "error": None,
            },
            {
                "provider": "TRELLIS 2 (Microsoft)",
                "provider_id": "trellis",
                "time_seconds": 30.1,
                "est_cost": 0.15,
                "mesh_path": None,
                "mesh_size_kb": 0,
                "success": False,
                "error": "Connection refused",
            },
        ]

    def test_creates_comparison_md(self, tmp_path):
        """Given results / When generate_report / Then COMPARISON.md exists."""
        cp.generate_report(self._sample_results(), str(tmp_path))

        assert (tmp_path / "COMPARISON.md").exists()

    def test_report_contains_provider_names(self, tmp_path):
        """Given results / When generate_report / Then each provider name appears."""
        cp.generate_report(self._sample_results(), str(tmp_path))

        content = (tmp_path / "COMPARISON.md").read_text()
        assert "Hyper3D Rodin (Sketch)" in content
        assert "TRELLIS 2 (Microsoft)" in content

    def test_report_contains_markdown_table(self, tmp_path):
        """Given results / When generate_report / Then table header is present."""
        cp.generate_report(self._sample_results(), str(tmp_path))

        content = (tmp_path / "COMPARISON.md").read_text()
        assert "| Provider |" in content
        assert "| Time (s) |" in content


# ---------------------------------------------------------------------------
# PROVIDERS dict structure
# ---------------------------------------------------------------------------

REQUIRED_PROVIDER_KEYS = {"name", "fal_model", "est_cost"}


class TestProvidersConfig:
    """PROVIDERS dict must have required keys for every entry."""

    @pytest.mark.parametrize("provider_id", list(cp.PROVIDERS.keys()))
    def test_required_keys_present(self, provider_id):
        """Given PROVIDERS / When checking each entry / Then required keys exist."""
        entry = cp.PROVIDERS[provider_id]
        missing = REQUIRED_PROVIDER_KEYS - entry.keys()
        assert not missing, f"{provider_id} missing keys: {missing}"

    @pytest.mark.parametrize("provider_id", list(cp.PROVIDERS.keys()))
    def test_est_cost_is_positive(self, provider_id):
        """Given PROVIDERS / When checking est_cost / Then it is > 0."""
        assert cp.PROVIDERS[provider_id]["est_cost"] > 0

    @pytest.mark.parametrize("provider_id", list(cp.PROVIDERS.keys()))
    def test_fal_model_is_nonempty_string(self, provider_id):
        """Given PROVIDERS / When checking fal_model / Then it is a non-empty string."""
        fal_model = cp.PROVIDERS[provider_id]["fal_model"]
        assert isinstance(fal_model, str) and fal_model.strip()

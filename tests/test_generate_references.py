"""
Tests for scripts/generate-hc-references.py pure constants.

Given/When/Then:
- Given VIEW_ANGLES / When length checked / Then exactly 4 views
- Given VIEW_ANGLES / When keys checked / Then front, side, three-quarter, rear present
- Given prompt constants / When checked / Then non-empty strings
- Given a view name / When prompt assembled / Then all three components are present
"""

import importlib.util
import sys
from pathlib import Path
from unittest.mock import MagicMock

SCRIPTS_DIR = Path(__file__).parent.parent / "scripts"


def _load_generate_references():
    """Load generate-hc-references.py with fal_client mocked."""
    sys.modules.setdefault("fal_client", MagicMock())
    spec = importlib.util.spec_from_file_location(
        "generate_hc_references",
        SCRIPTS_DIR / "generate-hc-references.py",
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


gr = _load_generate_references()


# ---------------------------------------------------------------------------
# VIEW_ANGLES
# ---------------------------------------------------------------------------

EXPECTED_VIEWS = {"front", "side", "three-quarter", "rear"}


class TestViewAngles:
    """VIEW_ANGLES must contain exactly 4 canonical views."""

    def test_exactly_four_views(self):
        """Given VIEW_ANGLES / When counted / Then 4 views."""
        assert len(gr.VIEW_ANGLES) == 4

    def test_all_expected_views_present(self):
        """Given VIEW_ANGLES / When keys checked / Then front/side/three-quarter/rear exist."""
        assert set(gr.VIEW_ANGLES.keys()) == EXPECTED_VIEWS

    def test_all_view_descriptions_non_empty(self):
        """Given VIEW_ANGLES / When descriptions checked / Then none are empty."""
        for view, description in gr.VIEW_ANGLES.items():
            assert isinstance(description, str) and description.strip(), (
                f"View '{view}' has an empty description"
            )


# ---------------------------------------------------------------------------
# Prompt constants
# ---------------------------------------------------------------------------

class TestPromptConstants:
    """OBJECT_DESC, SURFACE_PROMPT, TECH_SUFFIX must be non-empty strings."""

    def test_object_desc_non_empty(self):
        """Given OBJECT_DESC / When checked / Then non-empty string."""
        assert isinstance(gr.OBJECT_DESC, str) and gr.OBJECT_DESC.strip()

    def test_surface_prompt_non_empty(self):
        """Given SURFACE_PROMPT / When checked / Then non-empty string."""
        assert isinstance(gr.SURFACE_PROMPT, str) and gr.SURFACE_PROMPT.strip()

    def test_tech_suffix_non_empty(self):
        """Given TECH_SUFFIX / When checked / Then non-empty string."""
        assert isinstance(gr.TECH_SUFFIX, str) and gr.TECH_SUFFIX.strip()


# ---------------------------------------------------------------------------
# Prompt assembly
# ---------------------------------------------------------------------------

class TestPromptAssembly:
    """Assembled prompts must include all three components."""

    def test_view_prompt_contains_all_components(self):
        """Given a view / When prompt assembled / Then object, surface, tech parts present."""
        view_name = "front"
        view_prompt = gr.VIEW_ANGLES[view_name]
        prompt = f"{gr.OBJECT_DESC}, {gr.SURFACE_PROMPT}, {view_prompt}, {gr.TECH_SUFFIX}"

        assert gr.OBJECT_DESC[:20] in prompt
        assert gr.TECH_SUFFIX in prompt
        assert view_prompt in prompt

    def test_all_view_prompts_include_view_description(self):
        """Given each view / When prompt built / Then view description is embedded."""
        for view_name, view_prompt in gr.VIEW_ANGLES.items():
            full_prompt = (
                f"{gr.OBJECT_DESC}, {gr.SURFACE_PROMPT}, {view_prompt}, {gr.TECH_SUFFIX}"
            )
            assert view_prompt in full_prompt, (
                f"View '{view_name}' description missing from assembled prompt"
            )

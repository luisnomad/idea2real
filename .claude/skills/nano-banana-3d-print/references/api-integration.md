# Nano Banana API Integration Guide

How to call Nano Banana programmatically for multi-angle reference generation.

## Table of Contents

1. [Provider Comparison](#provider-comparison)
2. [fal.ai Integration](#falai-integration)
3. [WaveSpeedAI Integration](#wavespeedai-integration)
4. [Google AI Studio](#google-ai-studio)
5. [Batch Generation Script](#batch-generation-script)

---

## Provider Comparison

| Provider | Model | Cost/Image | Multi-Image | Best For |
|---|---|---|---|---|
| fal.ai | Nano Banana 2 | ~$0.08 | No (sequential) | Quality + reliability |
| fal.ai | Nano Banana (original) | ~$0.04 | No | Budget prototyping |
| WaveSpeedAI | Nano Banana Pro Multi | ~$0.07 | Yes (batch) | Multi-angle consistency |
| WaveSpeedAI | Nano Banana Pro | ~$0.14 | No | Highest quality single |
| Google AI Studio | Gemini Flash Image | Free tier | No | Free experimentation |

**Recommendation**: Use Nano Banana Pro Multi on WaveSpeedAI for the multi-angle sheet approach
(all 4 views in one image), or Nano Banana 2 on fal.ai for individual high-quality views.

---

## fal.ai Integration

### Setup
```bash
pip install fal-client
```

Set your API key:
```bash
export FAL_KEY="your-api-key-here"
```

### Python — Single Image Generation
```python
import fal_client

def generate_view(object_description: str, surface_prompt: str, view_angle: str) -> str:
    """Generate a single reference view via Nano Banana 2."""

    prompt = (
        f"{object_description}, {surface_prompt}, {view_angle}, "
        "orthographic projection, white background, even studio lighting, "
        "technical reference sheet, isolated object, no environment"
    )

    result = fal_client.subscribe(
        "fal-ai/nano-banana-2",
        arguments={
            "prompt": prompt,
            "aspect_ratio": "1:1",  # Square for clean reconstruction input
            "output_format": "png",
        },
    )

    image_url = result["images"][0]["url"]
    return image_url


# Example usage
views = {
    "front": "front view, straight-on camera angle, centered in frame",
    "side": "right side profile view, perpendicular to front, centered in frame",
    "three_quarter": "three-quarter view from front-right at 45 degrees, slightly elevated",
    "top": "top-down overhead view, bird's eye perspective, looking straight down",
}

object_desc = "a low-poly cyberpunk cat figurine with neon circuit patterns"
surface = "matte PLA plastic finish with subtle visible horizontal layer lines, chunky solid proportions"

for view_name, view_prompt in views.items():
    url = generate_view(object_desc, surface, view_prompt)
    print(f"{view_name}: {url}")
```

### JavaScript/Node.js
```javascript
import * as fal from "@fal-ai/serverless-client";

fal.config({ credentials: process.env.FAL_KEY });

async function generateView(objectDesc, surfacePrompt, viewAngle) {
  const prompt = `${objectDesc}, ${surfacePrompt}, ${viewAngle}, ` +
    `orthographic projection, white background, even studio lighting, ` +
    `technical reference sheet, isolated object`;

  const result = await fal.subscribe("fal-ai/nano-banana-2", {
    input: {
      prompt,
      aspect_ratio: "1:1",
      output_format: "png",
    },
  });

  return result.images[0].url;
}
```

---

## WaveSpeedAI Integration

### Setup
```bash
# WaveSpeedAI uses a REST API
# Get your API key from wavespeed.ai
```

### Python — Multi-Image Generation (Recommended)
```python
import requests

WAVESPEED_API_KEY = "your-api-key"
BASE_URL = "https://api.wavespeed.ai/v1"

def generate_multi_angle_sheet(object_description: str, surface_prompt: str) -> str:
    """Generate a 4-angle reference sheet in a single API call."""

    prompt = (
        f"Technical reference sheet showing a {object_description} from four angles: "
        f"front view (top-left), side view (top-right), three-quarter view (bottom-left), "
        f"top-down view (bottom-right), {surface_prompt}, white background, "
        f"orthographic projection, consistent design across all views, model turnaround sheet"
    )

    response = requests.post(
        f"{BASE_URL}/models/google/nano-banana-pro/text-to-image-multi",
        headers={
            "Authorization": f"Bearer {WAVESPEED_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "prompt": prompt,
            "num_images": 1,  # One sheet with 4 views
            "aspect_ratio": "1:1",
        },
    )

    result = response.json()
    return result["images"][0]["url"]
```

---

## Google AI Studio

Free tier, good for prototyping. Use the Gemini API with image generation enabled.

### Python
```python
import google.generativeai as genai

genai.configure(api_key="your-api-key")
model = genai.GenerativeModel("gemini-2.5-flash-preview-image-generation")

def generate_view_gemini(object_description: str, surface_prompt: str, view_angle: str):
    prompt = (
        f"Generate an image: {object_description}, {surface_prompt}, {view_angle}, "
        "orthographic projection, white background, technical reference sheet"
    )

    response = model.generate_content(prompt)

    # Extract image from response
    for part in response.parts:
        if hasattr(part, "inline_data"):
            return part.inline_data
    return None
```

---

## Batch Generation Script

A complete script to generate all 4 views and download them. Save this as `generate_references.py`
in your project directory.

```python
#!/usr/bin/env python3
"""
Generate multi-angle reference images for 3D printing via Nano Banana.
Usage: python generate_references.py --object "cyberpunk cat" --tech fdm --output ./references/
"""

import argparse
import os
import requests
import fal_client

# --- Print technology surface prompts ---
SURFACE_PROMPTS = {
    "fdm": (
        "matte PLA plastic finish with subtle visible horizontal layer lines, "
        "chunky solid proportions suitable for FDM 3D printing, flat circular base "
        "2mm thick for bed adhesion, no thin protruding elements, no unsupported "
        "overhangs, rounded edges"
    ),
    "resin": (
        "smooth matte resin finish, SLA 3D printed appearance, extremely fine "
        "surface detail, sharp crisp edges, thin flat base, delicate features "
        "preserved, high-resolution print quality"
    ),
    "sls": (
        "matte powdery nylon SLS 3D printed finish, slightly granular texture, "
        "self-supporting structure, minimum 0.7mm wall thickness, complex geometry "
        "permitted, powder escape holes"
    ),
}

VIEW_ANGLES = {
    "front": "front view, straight-on camera angle, centered in frame",
    "side": "right side profile view, perpendicular to front, centered in frame",
    "three_quarter": "three-quarter view from front-right at 45 degrees, slightly elevated camera angle",
    "top": "top-down overhead view, bird's eye perspective, looking straight down",
}

TECH_SUFFIX = (
    "orthographic projection, white background, even studio lighting, "
    "technical reference sheet style, isolated object, no environment"
)


def generate_all_views(object_desc: str, tech: str, output_dir: str):
    """Generate 4 reference views and save to output directory."""

    os.makedirs(output_dir, exist_ok=True)
    surface = SURFACE_PROMPTS[tech]

    print(f"Generating {tech.upper()} references for: {object_desc}")
    print(f"Output: {output_dir}\n")

    for view_name, view_prompt in VIEW_ANGLES.items():
        prompt = f"A {object_desc}, {surface}, {view_prompt}, {TECH_SUFFIX}"

        print(f"  Generating {view_name} view...")

        result = fal_client.subscribe(
            "fal-ai/nano-banana-2",
            arguments={
                "prompt": prompt,
                "aspect_ratio": "1:1",
                "output_format": "png",
            },
        )

        image_url = result["images"][0]["url"]

        # Download image
        img_response = requests.get(image_url)
        filepath = os.path.join(output_dir, f"{view_name}.png")
        with open(filepath, "wb") as f:
            f.write(img_response.content)

        print(f"    Saved: {filepath}")

    print("\nAll views generated! Ready for 3D reconstruction.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate 3D print reference images")
    parser.add_argument("--object", required=True, help="Object description")
    parser.add_argument("--tech", choices=["fdm", "resin", "sls"], default="fdm")
    parser.add_argument("--output", default="./references/")

    args = parser.parse_args()
    generate_all_views(args.object, args.tech, args.output)
```

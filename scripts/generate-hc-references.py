#!/usr/bin/env python3
"""
Generate high-contrast DeLorean BTTF reference images via fal.ai Nano Banana 2.

Usage:
    export FAL_KEY="your-fal-api-key"
    python scripts/generate-hc-references.py --output poc/bttf-fdm-v2/references/

Requires: pip install fal-client requests
"""

import argparse
import os
import requests
import fal_client


# High-contrast prompt components optimized for 3D reconstruction
OBJECT_DESC = (
    "Dark charcoal matte PLA 3D print of a 1982 DeLorean DMC-12 "
    "Back to the Future time machine"
)

SURFACE_PROMPT = (
    "strong directional side lighting creating crisp shadow edges on panel lines "
    "and body creases, exposed flux capacitor wiring as raised surface ridges along "
    "body panels, Mr. Fusion reactor on rear engine cover, visible horizontal layer lines, "
    "chunky solid proportions suitable for FDM 3D printing, flat rectangular base 2mm thick, "
    "no thin protruding parts thinner than 2mm"
)

TECH_SUFFIX = (
    "orthographic projection, clean white background, product photography, best quality"
)

VIEW_ANGLES = {
    "front": "front view, straight-on camera angle, centered in frame",
    "side": "right side profile view, perpendicular to front, centered in frame",
    "three-quarter": "three-quarter view from front-right at 45 degrees, slightly elevated camera angle",
    "rear": "rear view, straight-on camera angle from behind, centered in frame",
}


def generate_individual_views(output_dir: str):
    """Generate 4 individual high-contrast reference views."""
    os.makedirs(output_dir, exist_ok=True)

    for view_name, view_prompt in VIEW_ANGLES.items():
        prompt = f"{OBJECT_DESC}, {SURFACE_PROMPT}, {view_prompt}, {TECH_SUFFIX}"

        print(f"Generating {view_name} view...")
        result = fal_client.subscribe(
            "fal-ai/nano-banana-2",
            arguments={
                "prompt": prompt,
                "aspect_ratio": "1:1",
                "output_format": "png",
            },
        )

        image_url = result["images"][0]["url"]
        img_response = requests.get(image_url)
        filepath = os.path.join(output_dir, f"{view_name}.png")
        with open(filepath, "wb") as f:
            f.write(img_response.content)
        print(f"  Saved: {filepath} ({len(img_response.content) / 1024:.0f} KB)")

    print("\nAll views generated!")


def generate_grid(output_dir: str):
    """Generate a single 2x2 grid image with all 4 views."""
    os.makedirs(output_dir, exist_ok=True)

    grid_prompt = (
        f"Create a 2x2 reference grid of a {OBJECT_DESC}: "
        "front view (top-left), right side profile (top-right), "
        "three-quarter view from front-right (bottom-left), rear view (bottom-right). "
        f"{SURFACE_PROMPT}, {TECH_SUFFIX}, "
        "consistent proportions across all views"
    )

    print("Generating 2x2 grid...")
    result = fal_client.subscribe(
        "fal-ai/nano-banana-2",
        arguments={
            "prompt": grid_prompt,
            "aspect_ratio": "1:1",
            "output_format": "png",
        },
    )

    image_url = result["images"][0]["url"]
    img_response = requests.get(image_url)
    filepath = os.path.join(output_dir, "grid-4k-hc.png")
    with open(filepath, "wb") as f:
        f.write(img_response.content)
    print(f"  Saved: {filepath} ({len(img_response.content) / 1024:.0f} KB)")

    # Slice into individual views using ImageMagick
    print("\nSlicing grid into individual views...")
    import subprocess

    slices = {
        "front.png": "+0+0",
        "side.png": "+2048+0",
        "three-quarter.png": "+0+2048",
        "rear.png": "+2048+2048",
    }

    for filename, offset in slices.items():
        out_path = os.path.join(output_dir, filename)
        subprocess.run(
            ["magick", filepath, "-crop", f"2048x2048{offset}", out_path],
            check=True,
        )
        print(f"  Sliced: {out_path}")

    print("\nGrid generated and sliced!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate high-contrast DeLorean reference images"
    )
    parser.add_argument(
        "--output",
        default="poc/bttf-fdm-v2/references/",
        help="Output directory for images",
    )
    parser.add_argument(
        "--mode",
        choices=["individual", "grid"],
        default="individual",
        help="Generate individual views or a 2x2 grid",
    )
    args = parser.parse_args()

    if args.mode == "individual":
        generate_individual_views(args.output)
    else:
        generate_grid(args.output)

#!/usr/bin/env python3
"""
Provider Shootout: Compare image-to-3D providers using the same reference images.

Calls each provider via fal.ai, downloads results, and generates a comparison report.

Usage:
    export FAL_KEY="your-fal-api-key"
    python scripts/compare-providers.py \
        --images poc/bttf-fdm-v2/references/front.png \
                 poc/bttf-fdm-v2/references/side.png \
                 poc/bttf-fdm-v2/references/three-quarter.png \
                 poc/bttf-fdm-v2/references/rear.png \
        --output poc/provider-shootout/

Requires: pip install fal-client requests
"""

import argparse
import base64
import json
import os
import time
from pathlib import Path

import fal_client
import requests


# Provider configurations — all via fal.ai where possible
PROVIDERS = {
    "rodin-sketch": {
        "name": "Hyper3D Rodin (Sketch)",
        "fal_model": "fal-ai/hyper3d/rodin",
        "multi_image": True,
        "tier": "Sketch",
        "est_cost": 0.10,
    },
    "rodin-regular": {
        "name": "Hyper3D Rodin (Regular)",
        "fal_model": "fal-ai/hyper3d/rodin",
        "multi_image": True,
        "tier": "Regular",
        "est_cost": 0.30,
    },
    "rodin-detail": {
        "name": "Hyper3D Rodin (Detail)",
        "fal_model": "fal-ai/hyper3d/rodin",
        "multi_image": True,
        "tier": "Detail",
        "est_cost": 0.50,
    },
    "trellis": {
        "name": "TRELLIS 2 (Microsoft)",
        "fal_model": "fal-ai/trellis",
        "multi_image": False,
        "est_cost": 0.15,
    },
    "hunyuan3d": {
        "name": "Hunyuan3D 2.0 (Tencent)",
        "fal_model": "fal-ai/hunyuan3d/mini",
        "multi_image": False,
        "est_cost": 0.10,
    },
    "triposg": {
        "name": "TripoSG (VAST)",
        "fal_model": "fal-ai/triposg",
        "multi_image": False,
        "est_cost": 0.10,
    },
}


def image_to_data_url(path: str) -> str:
    """Convert local image to data URL for API upload."""
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode()
    ext = Path(path).suffix.lstrip(".")
    mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg"}.get(
        ext, "image/png"
    )
    return f"data:{mime};base64,{data}"


def upload_to_fal(path: str) -> str:
    """Upload a local image to fal.ai CDN and return the URL."""
    url = fal_client.upload_file(path)
    return url


def run_provider(provider_id: str, image_paths: list[str], output_dir: str) -> dict:
    """Run a single provider and return results."""
    config = PROVIDERS[provider_id]
    provider_dir = os.path.join(output_dir, provider_id)
    os.makedirs(provider_dir, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"Running: {config['name']}")
    print(f"Model: {config['fal_model']}")
    print(f"{'='*60}")

    # Upload images to fal CDN
    print("  Uploading images...")
    image_urls = [upload_to_fal(p) for p in image_paths]

    # Build request based on provider
    if provider_id.startswith("rodin"):
        # Rodin supports multiple images
        arguments = {
            "tier": config.get("tier", "Regular"),
            "input_image_urls": image_urls if config["multi_image"] else [image_urls[0]],
        }
    else:
        # Single-image providers — use the three-quarter view (most informative)
        best_image = image_urls[2] if len(image_urls) > 2 else image_urls[0]
        arguments = {
            "image_url": best_image,
        }

    # Submit job
    start_time = time.time()
    print("  Submitting job...")

    try:
        result = fal_client.subscribe(
            config["fal_model"],
            arguments=arguments,
        )
        elapsed = time.time() - start_time
        print(f"  Completed in {elapsed:.1f}s")

        # Download result mesh
        mesh_url = None
        if "model_mesh" in result:
            mesh_url = result["model_mesh"].get("url")
        elif "mesh" in result:
            mesh_url = result["mesh"].get("url")
        elif "glb_url" in result:
            mesh_url = result["glb_url"]

        if mesh_url:
            mesh_ext = ".glb"
            if ".obj" in mesh_url:
                mesh_ext = ".obj"
            elif ".fbx" in mesh_url:
                mesh_ext = ".fbx"

            mesh_path = os.path.join(provider_dir, f"mesh{mesh_ext}")
            resp = requests.get(mesh_url)
            with open(mesh_path, "wb") as f:
                f.write(resp.content)
            print(f"  Saved mesh: {mesh_path} ({len(resp.content) / 1024:.0f} KB)")
        else:
            mesh_path = None
            print(f"  Warning: No mesh URL found in result")
            # Save raw result for debugging
            with open(os.path.join(provider_dir, "raw_result.json"), "w") as f:
                json.dump(result, f, indent=2)

        return {
            "provider": config["name"],
            "provider_id": provider_id,
            "time_seconds": elapsed,
            "est_cost": config["est_cost"],
            "mesh_path": mesh_path,
            "mesh_size_kb": len(resp.content) / 1024 if mesh_url else 0,
            "success": mesh_path is not None,
            "error": None,
        }

    except Exception as e:
        elapsed = time.time() - start_time
        print(f"  FAILED after {elapsed:.1f}s: {e}")
        return {
            "provider": config["name"],
            "provider_id": provider_id,
            "time_seconds": elapsed,
            "est_cost": config["est_cost"],
            "mesh_path": None,
            "mesh_size_kb": 0,
            "success": False,
            "error": str(e),
        }


def generate_report(results: list[dict], output_dir: str):
    """Generate a markdown comparison report."""
    report_path = os.path.join(output_dir, "COMPARISON.md")

    lines = [
        "# Provider Shootout: Image-to-3D Comparison",
        "",
        f"Generated: {time.strftime('%Y-%m-%d %H:%M')}",
        "",
        "## Results",
        "",
        "| Provider | Time (s) | Est. Cost | Mesh Size (KB) | Success |",
        "|---|---|---|---|---|",
    ]

    for r in results:
        status = "Yes" if r["success"] else f"No ({r['error'][:30]}...)" if r["error"] else "No"
        lines.append(
            f"| {r['provider']} | {r['time_seconds']:.1f} | ${r['est_cost']:.2f} | "
            f"{r['mesh_size_kb']:.0f} | {status} |"
        )

    lines.extend([
        "",
        "## Next Steps",
        "",
        "1. Import all meshes into Blender for visual comparison",
        "2. Run cleanup pipeline on each mesh",
        "3. Export STLs and compare printability",
        "4. Rate visual quality 1-5 for each provider",
        "",
    ])

    with open(report_path, "w") as f:
        f.write("\n".join(lines))

    print(f"\nReport saved: {report_path}")


def main():
    parser = argparse.ArgumentParser(description="Compare image-to-3D providers")
    parser.add_argument(
        "--images",
        nargs="+",
        required=True,
        help="Reference image paths (front, side, three-quarter, rear)",
    )
    parser.add_argument(
        "--output",
        default="poc/provider-shootout/",
        help="Output directory",
    )
    parser.add_argument(
        "--providers",
        nargs="+",
        default=list(PROVIDERS.keys()),
        choices=list(PROVIDERS.keys()),
        help="Which providers to test (default: all)",
    )
    args = parser.parse_args()

    os.makedirs(args.output, exist_ok=True)

    results = []
    for provider_id in args.providers:
        result = run_provider(provider_id, args.images, args.output)
        results.append(result)

    generate_report(results, args.output)

    # Save raw results as JSON
    with open(os.path.join(args.output, "results.json"), "w") as f:
        json.dump(results, f, indent=2)

    print("\nDone! All providers tested.")


if __name__ == "__main__":
    main()

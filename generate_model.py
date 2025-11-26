#!/usr/bin/env python3
"""
Image-to-3D Model Generator
Converts an image to a GLTF 3D model using Hugging Face's image-to-3D pipeline.

Usage:
    python generate_model.py <image_path> <label>

Example:
    python generate_model.py cake.jpg cake
"""

import argparse
import sys
from datetime import datetime
from io import BytesIO
from pathlib import Path

import numpy as np
import requests
import torch
import trimesh
from diffusers import DiffusionPipeline
from PIL import Image


def load_image(image_path: str) -> np.ndarray:
    """Load and preprocess an image from file or URL."""
    if image_path.startswith("http://") or image_path.startswith("https://"):
        response = requests.get(image_path)
        input_image = Image.open(BytesIO(response.content))
    else:
        input_image = Image.open(image_path)

    # Convert to RGB if needed
    if input_image.mode != "RGB":
        input_image = input_image.convert("RGB")

    # Normalize to 0-1 range
    input_image = np.array(input_image, dtype=np.float32) / 255.0
    return input_image


def convert_ply_to_gltf(ply_path: str, gltf_path: str):
    """Convert PLY file to GLTF format using trimesh."""
    try:
        # Load the PLY file
        mesh = trimesh.load(ply_path)

        # Export as GLTF
        mesh.export(gltf_path, file_type="gltf")
        print(f"✓ Successfully converted to GLTF: {gltf_path}")
    except Exception as e:
        print(f"✗ Error converting PLY to GLTF: {e}")
        raise


def generate_3d_model(image_path: str, label: str, output_dir: str = "public/models"):
    """
    Generate a 3D model from an image.

    Args:
        image_path: Path to input image (or URL)
        label: Label for the model
        output_dir: Directory to save the output GLTF file
    """
    print(f"Loading image-to-3D model...")

    # Check if CUDA is available
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cpu":
        print("⚠ Warning: CUDA not available, using CPU (this will be slow)")

    # Load the pipeline
    try:
        pipeline = DiffusionPipeline.from_pretrained(
            "dylanebert/LGM-full",
            custom_pipeline="dylanebert/LGM-full",
            torch_dtype=torch.float16 if device == "cuda" else torch.float32,
            trust_remote_code=True,
        ).to(device)
        print(f"✓ Model loaded on {device}")
    except Exception as e:
        print(f"✗ Error loading model: {e}")
        print("\nMake sure you have installed all required packages:")
        print("  pip install -r requirements-3d.txt")
        print("\nOr install individually:")
        print(
            "  pip install torch diffusers transformers accelerate trimesh Pillow numpy requests xformers kiui einops"
        )
        return False

    # Load and preprocess image
    print(f"Loading image: {image_path}")
    try:
        input_image = load_image(image_path)
        print(f"✓ Image loaded: {input_image.shape}")
    except Exception as e:
        print(f"✗ Error loading image: {e}")
        return False

    # Generate 3D model
    print("Generating 3D model (this may take a few minutes)...")
    try:
        result = pipeline("", input_image)
        print("✓ 3D model generated")
    except Exception as e:
        print(f"✗ Error generating 3D model: {e}")
        return False

    # Create output directory if it doesn't exist
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Generate filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d")
    ply_filename = f"{timestamp}_{label}.ply"
    gltf_filename = f"{timestamp}_{label}.gltf"

    ply_path = output_path / ply_filename
    gltf_path = output_path / gltf_filename

    # Save PLY file
    print(f"Saving intermediate PLY file: {ply_path}")
    try:
        pipeline.save_ply(result, str(ply_path))
        print("✓ PLY file saved")
    except Exception as e:
        print(f"✗ Error saving PLY file: {e}")
        return False

    # Convert to GLTF
    print(f"Converting to GLTF: {gltf_path}")
    try:
        convert_ply_to_gltf(str(ply_path), str(gltf_path))
    except Exception as e:
        print(f"✗ Error converting to GLTF: {e}")
        return False

    # Clean up intermediate PLY file
    try:
        ply_path.unlink()
        print(f"✓ Cleaned up intermediate PLY file")
    except Exception as e:
        print(f"⚠ Warning: Could not delete PLY file: {e}")

    print(f"\n✅ Success! Generated model: {gltf_path}")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Generate 3D GLTF model from an image using AI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python generate_model.py image.jpg cake
  python generate_model.py https://example.com/image.jpg birthday
        """,
    )

    parser.add_argument("image_path", help="Path to input image or URL")
    parser.add_argument("label", help="Label for the model (e.g., cake, birthday)")
    parser.add_argument(
        "--output-dir",
        default="public/models",
        help="Output directory (default: public/models)",
    )

    args = parser.parse_args()

    # Validate label (only alphanumeric and underscores)
    if not args.label.replace("_", "").isalnum():
        print("✗ Error: Label must contain only letters, numbers, and underscores")
        sys.exit(1)

    success = generate_3d_model(args.image_path, args.label, args.output_dir)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

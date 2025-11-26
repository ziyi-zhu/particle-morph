#!/usr/bin/env python3
"""
Image-to-3D Model Generator
Converts an image to a GLB 3D model using Hunyuan3D pipeline.

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

import requests
import torch
from PIL import Image, ImageOps
from torchvision import transforms
from transformers import AutoModelForImageSegmentation

# Add Hunyuan3D paths
sys.path.insert(0, "./hy3dshape")
sys.path.insert(0, "./hy3dpaint")

from hy3dshape.pipelines import Hunyuan3DDiTFlowMatchingPipeline

# Apply torchvision fix if available
try:
    from torchvision_fix import apply_fix

    apply_fix()
except ImportError:
    print(
        "Warning: torchvision_fix module not found, proceeding without compatibility fix"
    )
except Exception as e:
    print(f"Warning: Failed to apply torchvision fix: {e}")

# Global BiRefNet model and transform
birefnet_model = None
transform_image = transforms.Compose(
    [
        transforms.Resize((1024, 1024)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ]
)


def load_birefnet_model():
    """Load BiRefNet model for background removal."""
    global birefnet_model
    if birefnet_model is None:
        print("Loading BiRefNet model for background removal...")
        torch.set_float32_matmul_precision(["high", "highest"][0])
        birefnet_model = AutoModelForImageSegmentation.from_pretrained(
            "ZhengPeng7/BiRefNet", trust_remote_code=True
        )
        device = "cuda" if torch.cuda.is_available() else "cpu"
        birefnet_model.to(device)
        print(f"✓ BiRefNet model loaded on {device}")
    return birefnet_model


def remove_background(image: Image.Image) -> Image.Image:
    """
    Remove background from an image using BiRefNet.
    Matches the reference implementation exactly.

    Args:
        image: PIL Image in RGB mode

    Returns:
        PIL Image with background removed (RGBA mode with transparency)
    """
    model = load_birefnet_model()
    device = "cuda" if torch.cuda.is_available() else "cpu"

    image_size = image.size
    input_images = transform_image(image).unsqueeze(0).to(device)

    # Prediction
    with torch.no_grad():
        preds = model(input_images)[-1].sigmoid().cpu()

    pred = preds[0].squeeze()
    pred_pil = transforms.ToPILImage()(pred)
    mask = pred_pil.resize(image_size)
    image.putalpha(mask)

    return image


def load_image(image_path: str) -> Image.Image:
    """Load an image from file or URL, preserving original orientation."""
    if image_path.startswith("http://") or image_path.startswith("https://"):
        response = requests.get(image_path)
        input_image = Image.open(BytesIO(response.content))
    else:
        input_image = Image.open(image_path)

    # Apply EXIF orientation properly (this handles rotation without double-applying)
    input_image = ImageOps.exif_transpose(input_image)

    # Convert to RGB for processing
    if input_image.mode != "RGB":
        input_image = input_image.convert("RGB")

    return input_image


def generate_3d_model(image_path: str, label: str, output_dir: str = "outputs"):
    """
    Generate a 3D model from an image using Hunyuan3D pipeline.

    Args:
        image_path: Path to input image (or URL)
        label: Label for the model
        output_dir: Base directory to save outputs (default: outputs)
    """
    print("Loading image-to-3D model...")

    # Load the shape generation pipeline
    try:
        model_path = "tencent/Hunyuan3D-2.1"
        subfolder = "hunyuan3d-dit-v2-1"
        device = "cuda" if torch.cuda.is_available() else "cpu"
        pipeline_shapegen = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
            model_path,
            subfolder=subfolder,
            use_safetensors=False,
            device=device,
        )
        print(f"✓ Hunyuan3D model loaded on {device}")
    except Exception as e:
        print(f"✗ Error loading model: {e}")
        print(
            "\nMake sure you have installed all required packages and the hy3dshape module is available"
        )
        return False

    # Load image
    print(f"Loading image: {image_path}")
    try:
        input_image = load_image(image_path)
        print(f"✓ Image loaded: {input_image.size}, mode: {input_image.mode}")
    except Exception as e:
        print(f"✗ Error loading image: {e}")
        return False

    # Create output directories
    removal_dir = Path(output_dir) / "removal"
    mesh_dir = Path(output_dir) / "mesh"
    removal_dir.mkdir(parents=True, exist_ok=True)
    mesh_dir.mkdir(parents=True, exist_ok=True)

    # Generate filename with timestamp (date only)
    timestamp = datetime.now().strftime("%Y%m%d")
    removal_filename = f"{timestamp}_{label}_no_bg.png"
    mesh_filename = f"{timestamp}_{label}.glb"

    removal_path = removal_dir / removal_filename
    mesh_path = mesh_dir / mesh_filename

    # Remove background using BiRefNet
    print("Removing background with BiRefNet...")
    try:
        input_image = remove_background(input_image)
        print("✓ Background removed")
    except Exception as e:
        print(f"✗ Error removing background: {e}")
        return False

    # Save image with no background
    print(f"Saving image with no background: {removal_path}")
    try:
        input_image.save(removal_path)
        print("✓ Background-removed image saved")
    except Exception as e:
        print(f"✗ Error saving image: {e}")
        return False

    # Generate 3D mesh
    print("Generating 3D mesh (this may take a few minutes)...")
    try:
        mesh = pipeline_shapegen(image=input_image)[0]
        print("✓ 3D mesh generated")
    except Exception as e:
        print(f"✗ Error generating 3D mesh: {e}")
        return False

    # Save mesh as GLB
    print(f"Saving mesh: {mesh_path}")
    try:
        mesh.export(str(mesh_path))
        print("✓ Mesh saved")
    except Exception as e:
        print(f"✗ Error saving mesh: {e}")
        return False

    print("\n✅ Success!")
    print(f"   Background-removed image: {removal_path}")
    print(f"   3D mesh: {mesh_path}")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Generate 3D GLB model from an image using Hunyuan3D",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python generate_model.py image.jpg cake
  python generate_model.py https://example.com/image.jpg birthday

Output:
  - Background-removed image: outputs/removal/<timestamp>_<label>_no_bg.png
  - 3D mesh (GLB): outputs/mesh/<timestamp>_<label>.glb
        """,
    )

    parser.add_argument("image_path", help="Path to input image or URL")
    parser.add_argument("label", help="Label for the model (e.g., cake, birthday)")
    parser.add_argument(
        "--output-dir",
        default="outputs",
        help="Output base directory (default: outputs)",
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

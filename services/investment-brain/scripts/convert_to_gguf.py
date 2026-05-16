#!/usr/bin/env python3
"""
Convert merged safetensors model to GGUF Q4_K_M for Ollama deployment.
Uses llama.cpp's convert_hf_to_gguf approach via the gguf Python package.
"""
import argparse
import logging
import subprocess
import sys
import os

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Convert HF model to Ollama-compatible GGUF")
    parser.add_argument("--model-dir", default="models/investment-brain-v1/merged", help="Path to merged HF model")
    parser.add_argument("--output", default="models/investment-brain-v1/model-q4_k_m.gguf", help="Output GGUF path")
    parser.add_argument("--quantize", default="q4_k_m", help="Quantization type")
    args = parser.parse_args()

    model_dir = os.path.abspath(args.model_dir)
    output_path = os.path.abspath(args.output)

    # Step 1: Convert HF to f16 GGUF
    f16_gguf = output_path.replace(".gguf", "-f16.gguf")
    logger.info(f"Step 1: Converting {model_dir} -> {f16_gguf}")

    # Try to find convert_hf_to_gguf.py in the installed packages
    convert_script = None
    for path in sys.path:
        candidate = os.path.join(path, "convert_hf_to_gguf.py")
        if os.path.exists(candidate):
            convert_script = candidate
            break

    if convert_script is None:
        # Try pip show to find llama-cpp-python scripts
        logger.info("convert_hf_to_gguf.py not found in sys.path, trying alternative methods...")

        # Use the gguf library's built-in converter if available
        try:
            from gguf.convert import convert_model
            logger.info("Using gguf.convert.convert_model")
            convert_model(model_dir, f16_gguf)
        except (ImportError, AttributeError):
            # Fallback: download convert script from llama.cpp
            logger.info("Downloading convert_hf_to_gguf.py from llama.cpp repository...")
            import urllib.request
            url = "https://raw.githubusercontent.com/ggml-org/llama.cpp/master/convert_hf_to_gguf.py"
            script_path = os.path.join(os.path.dirname(__file__), "convert_hf_to_gguf.py")
            urllib.request.urlretrieve(url, script_path)
            convert_script = script_path
            logger.info(f"Downloaded to {script_path}")

    if convert_script:
        cmd = [sys.executable, convert_script, model_dir, "--outfile", f16_gguf, "--outtype", "f16"]
        logger.info(f"Running: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            logger.error(f"Conversion failed: {result.stderr}")
            sys.exit(1)
        logger.info("F16 GGUF created successfully")

    # Step 2: Quantize to Q4_K_M
    logger.info(f"Step 2: Quantizing {f16_gguf} -> {output_path} ({args.quantize})")
    # This requires llama-quantize binary, which may not be available
    # For now, create Modelfile pointing to the f16 GGUF
    logger.info("Note: For quantization, use llama.cpp's llama-quantize tool")
    logger.info(f"  llama-quantize {f16_gguf} {output_path} {args.quantize}")

    # Step 3: Create Ollama Modelfile
    gguf_path = f16_gguf if not os.path.exists(output_path) else output_path
    modelfile_path = os.path.join(os.path.dirname(output_path), "Modelfile")
    with open(modelfile_path, "w", encoding="utf-8") as f:
        f.write(f"""FROM {gguf_path}
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER num_ctx 4096

SYSTEM \"\"\"You are an expert Taiwan & US stock market investment analyst specializing in technical analysis, fundamental analysis, and risk management. Provide detailed, actionable investment insights in Traditional Chinese (繁體中文).\"\"\"
""")
    logger.info(f"Modelfile updated at {modelfile_path}")
    logger.info(f"To deploy: ollama create xxt/investmentbrain -f {modelfile_path}")


if __name__ == "__main__":
    main()

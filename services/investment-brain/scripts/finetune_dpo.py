#!/usr/bin/env python3
"""
DPO Fine-tuning Script for Investment Brain

Direct Preference Optimization using user accept/reject feedback.
Trains the model to prefer accepted analysis over rejected ones.

Target hardware: RTX 4080 SUPER (16GB VRAM)

Usage:
    # Export DPO pairs from Redis
    python -m scripts.export_dpo_data --output data/dpo_pairs.json

    # Run DPO fine-tuning (requires SFT base model first)
    python -m scripts.finetune_dpo \
        --data data/dpo_pairs.json \
        --base-model models/investment-brain-v1 \
        --output models/investment-brain-dpo-v1

Prerequisites:
    pip install unsloth[colab-new] transformers datasets trl peft
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("finetune-dpo")


def load_dpo_data(path: str) -> list[dict]:
    """Load DPO pairs from JSON file."""
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Handle both flat list and nested {data: [...]} format
    if isinstance(data, dict) and "data" in data:
        data = data["data"]

    logger.info(f"Loaded {len(data)} DPO pairs from {path}")
    return data


def finetune_dpo(
    data_path: str,
    output_dir: str,
    base_model: str = "models/investment-brain-v1",
    lora_rank: int = 8,
    lora_alpha: int = 16,
    epochs: int = 2,
    learning_rate: float = 5e-5,
    batch_size: int = 1,
    max_seq_length: int = 2048,
    beta: float = 0.1,
) -> None:
    """
    Run DPO fine-tuning using TRL's DPOTrainer.

    DPO Parameters:
    - beta: Controls how strongly the model diverges from reference.
      Lower = more conservative, higher = more aggressive preference learning.
      Default 0.1 is standard for moderate preference adjustment.

    Memory Optimization for RTX 4080 SUPER:
    - Reduced LoRA rank (8 vs 16 for SFT) since DPO needs 2x model memory
    - Shorter max_seq_length (2048 vs 4096) to fit reference model
    - batch_size=1 with gradient_accumulation=8
    """
    try:
        from unsloth import FastLanguageModel
        from datasets import Dataset
        from trl import DPOTrainer, DPOConfig
    except ImportError:
        logger.error(
            "Required packages not installed. Run:\n"
            "  pip install unsloth[colab-new] transformers datasets trl peft"
        )
        sys.exit(1)

    # Load DPO pairs
    dpo_data = load_dpo_data(data_path)
    if len(dpo_data) < 50:
        logger.warning(
            f"Only {len(dpo_data)} DPO pairs — recommend at least 50 for meaningful training. "
            f"Continue collecting user preferences."
        )
        if len(dpo_data) < 10:
            logger.error("Too few pairs. Need at least 10 to proceed.")
            sys.exit(1)

    # Format DPO pairs
    system_msg = (
        "你是 XXT-AGENT 投資分析系統的核心模型。"
        "你的分析必須嚴格以 JSON 格式輸出，包含完整的判斷依據和不確定性警語。"
        "所有回覆使用繁體中文。"
    )

    formatted = []
    for pair in dpo_data:
        prompt_text = (
            f"<|im_start|>system\n{system_msg}<|im_end|>\n"
            f"<|im_start|>user\n{pair['prompt']}<|im_end|>\n"
            f"<|im_start|>assistant\n"
        )
        formatted.append({
            "prompt": prompt_text,
            "chosen": pair["chosen"] + "<|im_end|>",
            "rejected": pair["rejected"] + "<|im_end|>",
        })

    dataset = Dataset.from_list(formatted)

    logger.info(f"DPO dataset: {len(dataset)} pairs")
    logger.info(f"Base model: {base_model}")
    logger.info(f"LoRA config: rank={lora_rank}, alpha={lora_alpha}")
    logger.info(f"DPO beta: {beta}")
    logger.info(f"Training: epochs={epochs}, lr={learning_rate}")

    # Load model
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=base_model,
        max_seq_length=max_seq_length,
        dtype=None,
        load_in_4bit=True,
    )

    # Add LoRA adapters (smaller rank for DPO due to memory constraints)
    model = FastLanguageModel.get_peft_model(
        model,
        r=lora_rank,
        lora_alpha=lora_alpha,
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
        lora_dropout=0.05,
        bias="none",
        use_gradient_checkpointing=True,
    )

    # DPO training configuration
    dpo_config = DPOConfig(
        output_dir=output_dir,
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        gradient_accumulation_steps=8,
        learning_rate=learning_rate,
        weight_decay=0.01,
        warmup_ratio=0.1,
        lr_scheduler_type="cosine",
        logging_steps=1,
        save_steps=25,
        save_total_limit=2,
        fp16=True,
        optim="adamw_8bit",
        beta=beta,
        max_length=max_seq_length,
        max_prompt_length=max_seq_length // 2,
        report_to="none",
        seed=42,
    )

    # DPO Trainer
    trainer = DPOTrainer(
        model=model,
        ref_model=None,  # DPO uses implicit reference with LoRA
        train_dataset=dataset,
        tokenizer=tokenizer,
        args=dpo_config,
    )

    logger.info("Starting DPO fine-tuning...")
    trainer.train()

    # Save
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    logger.info(f"DPO model saved to {output_dir}")

    # Export GGUF
    gguf_path = os.path.join(output_dir, "model-q4_k_m.gguf")
    try:
        model.save_pretrained_gguf(output_dir, tokenizer, quantization_method="q4_k_m")
        logger.info(f"GGUF exported to {gguf_path}")
    except Exception as e:
        logger.warning(f"GGUF export failed (can convert manually): {e}")

    # Generate Modelfile
    modelfile_path = os.path.join(output_dir, "Modelfile")
    with open(modelfile_path, "w", encoding="utf-8") as f:
        f.write(f"""FROM {gguf_path}

TEMPLATE \"\"\"<|im_start|>system
{{{{.System}}}}<|im_end|>
<|im_start|>user
{{{{.Prompt}}}}<|im_end|>
<|im_start|>assistant
\"\"\"

PARAMETER temperature 0.1
PARAMETER top_p 0.9
PARAMETER stop "<|im_end|>"

SYSTEM \"\"\"你是 XXT-AGENT 投資分析系統的核心模型（DPO 調優版本）。你的分析必須嚴格以 JSON 格式輸出，包含完整的判斷依據和不確定性警語。所有回覆使用繁體中文。\"\"\"
""")
    logger.info(f"Ollama Modelfile written to {modelfile_path}")

    logger.info(
        f"\n{'='*60}\n"
        f"DPO Training Complete!\n"
        f"  Pairs trained: {len(dataset)}\n"
        f"  Output: {output_dir}\n"
        f"\n"
        f"To deploy:\n"
        f"  ollama create investment-brain-dpo -f {modelfile_path}\n"
        f"  # Then update OLLAMA_MODEL=investment-brain-dpo in .env\n"
        f"{'='*60}"
    )


def main():
    parser = argparse.ArgumentParser(description="Investment Brain DPO Fine-tuning")
    parser.add_argument("--data", required=True, help="Path to DPO pairs JSON")
    parser.add_argument("--output", default="models/investment-brain-dpo-v1", help="Output directory")
    parser.add_argument("--base-model", default="models/investment-brain-v1", help="SFT base model path")
    parser.add_argument("--rank", type=int, default=8, help="LoRA rank (smaller for DPO)")
    parser.add_argument("--alpha", type=int, default=16, help="LoRA alpha")
    parser.add_argument("--epochs", type=int, default=2, help="Training epochs")
    parser.add_argument("--lr", type=float, default=5e-5, help="Learning rate")
    parser.add_argument("--beta", type=float, default=0.1, help="DPO beta parameter")
    parser.add_argument("--batch-size", type=int, default=1, help="Batch size")
    parser.add_argument("--max-seq-length", type=int, default=2048, help="Max sequence length")

    args = parser.parse_args()

    finetune_dpo(
        data_path=args.data,
        output_dir=args.output,
        base_model=args.base_model,
        lora_rank=args.rank,
        lora_alpha=args.alpha,
        epochs=args.epochs,
        learning_rate=args.lr,
        batch_size=args.batch_size,
        max_seq_length=args.max_seq_length,
        beta=args.beta,
    )


if __name__ == "__main__":
    main()

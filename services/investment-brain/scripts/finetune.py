#!/usr/bin/env python3
"""
LoRA Fine-tuning Script for Investment Brain

Uses unsloth for efficient LoRA fine-tuning on local GPU.
Target hardware: RTX 4080 SUPER (16GB VRAM)

Usage:
    # Export training data first
    python -m scripts.export_training_data --output data/train.json

    # Run fine-tuning
    python -m scripts.finetune --data data/train.json --output models/investment-brain-v1

    # Create Ollama model
    ollama create investment-brain-v1 -f scripts/Modelfile

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
logger = logging.getLogger("finetune")


def load_training_data(path: str) -> list[dict]:
    """Load Alpaca-format training data."""
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    logger.info(f"Loaded {len(data)} training examples from {path}")
    return data


def finetune(
    data_path: str,
    output_dir: str,
    base_model: str = "Qwen/Qwen2.5-7B-Instruct",
    lora_rank: int = 16,
    lora_alpha: int = 32,
    epochs: int = 3,
    learning_rate: float = 2e-4,
    batch_size: int = 1,
    max_seq_length: int = 4096,
    gradient_checkpointing: bool = True,
) -> None:
    """
    Run LoRA fine-tuning using unsloth.

    Optimized for RTX 4080 SUPER:
    - 14B Q4 model fits in 16GB with gradient_checkpointing
    - batch_size=1 with gradient_accumulation=4
    - LoRA rank=16 is a good balance of quality vs memory
    """
    try:
        from unsloth import FastLanguageModel
        from datasets import Dataset
        from trl import SFTTrainer
        from transformers import TrainingArguments
    except ImportError:
        logger.error(
            "Required packages not installed. Run:\n"
            "  pip install unsloth[colab-new] transformers datasets trl peft"
        )
        sys.exit(1)

    # Load data
    train_data = load_training_data(data_path)
    if len(train_data) < 10:
        logger.warning(f"Only {len(train_data)} examples — recommend at least 50 for meaningful fine-tuning")

    # Format as chat conversations
    def format_example(example: dict) -> dict:
        """Convert Alpaca format to Qwen chat template."""
        system_msg = (
            "你是 XXT-AGENT 投資分析系統的核心模型。"
            "你的分析必須嚴格以 JSON 格式輸出，包含完整的判斷依據和不確定性警語。"
            "所有回覆使用繁體中文。"
        )
        user_msg = example.get("instruction", "")
        if example.get("input"):
            user_msg += f"\n\n參考數據：\n{example['input']}"

        return {
            "text": (
                f"<|im_start|>system\n{system_msg}<|im_end|>\n"
                f"<|im_start|>user\n{user_msg}<|im_end|>\n"
                f"<|im_start|>assistant\n{example.get('output', '')}<|im_end|>"
            )
        }

    formatted = [format_example(ex) for ex in train_data]
    dataset = Dataset.from_list(formatted)

    logger.info(f"Training dataset: {len(dataset)} examples")
    logger.info(f"Base model: {base_model}")
    logger.info(f"LoRA config: rank={lora_rank}, alpha={lora_alpha}")
    logger.info(f"Training: epochs={epochs}, lr={learning_rate}, batch={batch_size}")

    # Load model with unsloth optimization
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=base_model,
        max_seq_length=max_seq_length,
        dtype=None,  # auto-detect
        load_in_4bit=True,
    )

    # Add LoRA adapters
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
        use_gradient_checkpointing=gradient_checkpointing,
    )

    # Training arguments
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        gradient_accumulation_steps=4,
        learning_rate=learning_rate,
        weight_decay=0.01,
        warmup_ratio=0.1,
        lr_scheduler_type="cosine",
        logging_steps=5,
        save_steps=50,
        save_total_limit=3,
        bf16=True,
        optim="adamw_8bit",
        seed=42,
        report_to="none",
    )

    # Trainer
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        dataset_text_field="text",
        max_seq_length=max_seq_length,
        packing=True,
        args=training_args,
    )

    logger.info("Starting LoRA fine-tuning...")
    trainer.train()

    # Save LoRA weights
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    logger.info(f"LoRA weights saved to {output_dir}")

    # Export GGUF for Ollama
    gguf_path = os.path.join(output_dir, "model-q4_k_m.gguf")
    try:
        model.save_pretrained_gguf(output_dir, tokenizer, quantization_method="q4_k_m")
        logger.info(f"GGUF exported to {gguf_path}")
        logger.info(
            f"\nTo create Ollama model:\n"
            f"  ollama create investment-brain-v1 -f {output_dir}/Modelfile"
        )
    except Exception as e:
        logger.warning(f"GGUF export failed (can convert manually): {e}")

    # Generate Modelfile for Ollama
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

SYSTEM \"\"\"你是 XXT-AGENT 投資分析系統的核心模型。你的分析必須嚴格以 JSON 格式輸出，包含完整的判斷依據和不確定性警語。所有回覆使用繁體中文。\"\"\"
""")
    logger.info(f"Ollama Modelfile written to {modelfile_path}")


def main():
    parser = argparse.ArgumentParser(description="Investment Brain LoRA Fine-tuning")
    parser.add_argument("--data", required=True, help="Path to training data (Alpaca JSON)")
    parser.add_argument("--output", default="models/investment-brain-v1", help="Output directory")
    parser.add_argument("--base-model", default="Qwen/Qwen2.5-7B-Instruct", help="Base model")
    parser.add_argument("--rank", type=int, default=16, help="LoRA rank")
    parser.add_argument("--alpha", type=int, default=32, help="LoRA alpha")
    parser.add_argument("--epochs", type=int, default=3, help="Training epochs")
    parser.add_argument("--lr", type=float, default=2e-4, help="Learning rate")
    parser.add_argument("--batch-size", type=int, default=1, help="Batch size")
    parser.add_argument("--max-seq-length", type=int, default=4096, help="Max sequence length")

    args = parser.parse_args()

    finetune(
        data_path=args.data,
        output_dir=args.output,
        base_model=args.base_model,
        lora_rank=args.rank,
        lora_alpha=args.alpha,
        epochs=args.epochs,
        learning_rate=args.lr,
        batch_size=args.batch_size,
        max_seq_length=args.max_seq_length,
    )


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
DPO Fine-tuning Script for Investment Brain (Vanilla Transformers + PEFT)

Direct Preference Optimization using user accept/reject feedback.
Trains the model to prefer accepted analysis over rejected ones.
Bypasses Unsloth/Triton for Windows compatibility.

Target hardware: RTX 4080 SUPER (16GB VRAM)

Usage:
    # Export DPO pairs from Redis
    python scripts/export_dpo_data.py --output data/dpo_pairs.json

    # Run DPO fine-tuning
    python scripts/finetune_dpo.py \
        --data data/dpo_pairs.json \
        --base-adapter models/investment-brain-v1/lora_adapter \
        --output models/investment-brain-dpo-v1

Prerequisites:
    pip install transformers datasets trl peft bitsandbytes
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
    base_model: str = "Qwen/Qwen2.5-7B-Instruct",
    base_adapter: str | None = None,
    lora_rank: int = 8,
    lora_alpha: int = 16,
    epochs: int = 2,
    learning_rate: float = 5e-5,
    batch_size: int = 1,
    max_seq_length: int = 2048,
    beta: float = 0.1,
) -> None:
    """
    Run DPO fine-tuning using vanilla transformers + PEFT + TRL.

    DPO Parameters:
    - beta: Controls how strongly the model diverges from reference.
      Lower = more conservative, higher = more aggressive preference learning.
      Default 0.1 is standard for moderate preference adjustment.

    Memory Optimization for RTX 4080 SUPER:
    - Reduced LoRA rank (8 vs 16 for SFT) since DPO needs 2x model memory
    - batch_size=1 with gradient_accumulation=8
    """
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from datasets import Dataset
    from trl import DPOTrainer, DPOConfig
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training, PeftModel

    # Load DPO pairs
    dpo_data = load_dpo_data(data_path)
    if len(dpo_data) < 10:
        logger.error(f"Only {len(dpo_data)} DPO pairs — need at least 10 to proceed.")
        sys.exit(1)
    if len(dpo_data) < 50:
        logger.warning(
            f"Only {len(dpo_data)} DPO pairs — recommend at least 50 for meaningful training."
        )

    # Format DPO pairs into chat format
    system_msg = (
        "你是 XXT-AGENT 投資分析系統的核心模型。"
        "你的分析必須嚴格以 JSON 格式輸出，包含完整的判斷依據和不確定性警語。"
        "所有回覆使用繁體中文。"
    )

    formatted = []
    for pair in dpo_data:
        formatted.append({
            "prompt": [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": pair["prompt"]},
            ],
            "chosen": [
                {"role": "assistant", "content": pair["chosen"]},
            ],
            "rejected": [
                {"role": "assistant", "content": pair["rejected"]},
            ],
        })

    dataset = Dataset.from_list(formatted)

    logger.info(f"DPO dataset: {len(dataset)} pairs")
    logger.info(f"Base model: {base_model}")
    logger.info(f"LoRA config: rank={lora_rank}, alpha={lora_alpha}")
    logger.info(f"DPO beta: {beta}")

    # BnB 4-bit config
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )

    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # Load model
    logger.info("Loading model with 4-bit quantization...")
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        torch_dtype=torch.bfloat16,
        attn_implementation="eager",
    )
    model = prepare_model_for_kbit_training(model)

    # If we have a base SFT adapter, load it first
    if base_adapter and os.path.exists(base_adapter):
        logger.info(f"Loading SFT adapter from {base_adapter}")
        model = PeftModel.from_pretrained(model, base_adapter, is_trainable=True)
        model = model.merge_and_unload()
        model = prepare_model_for_kbit_training(model)
        logger.info("SFT adapter merged successfully")

    # New LoRA for DPO
    lora_config = LoraConfig(
        r=lora_rank,
        lora_alpha=lora_alpha,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)

    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total = sum(p.numel() for p in model.parameters())
    logger.info(f"Trainable: {trainable:,} / {total:,} ({100*trainable/total:.2f}%)")

    # DPO config
    os.makedirs(output_dir, exist_ok=True)
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
        bf16=True,
        optim="adamw_8bit",
        beta=beta,
        max_length=max_seq_length,
        max_prompt_length=max_seq_length // 2,
        report_to="none",
        seed=42,
        gradient_checkpointing=True,
        gradient_checkpointing_kwargs={"use_reentrant": False},
        dataloader_pin_memory=False,
    )

    # DPO Trainer
    trainer = DPOTrainer(
        model=model,
        ref_model=None,  # DPO uses implicit reference with LoRA
        train_dataset=dataset,
        processing_class=tokenizer,
        args=dpo_config,
    )

    logger.info("Starting DPO fine-tuning...")
    result = trainer.train()
    logger.info(f"DPO training complete! Loss: {result.training_loss:.4f}")

    # Save adapter
    adapter_dir = os.path.join(output_dir, "lora_adapter")
    model.save_pretrained(adapter_dir)
    tokenizer.save_pretrained(adapter_dir)
    logger.info(f"DPO adapter saved to {adapter_dir}")

    # Save metrics
    metrics = result.metrics
    metrics["num_pairs"] = len(dataset)
    metrics["trainable_params"] = trainable
    with open(os.path.join(output_dir, "training_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    logger.info(
        f"\n{'='*60}\n"
        f"DPO Training Complete!\n"
        f"  Pairs trained: {len(dataset)}\n"
        f"  Loss: {result.training_loss:.4f}\n"
        f"  Output: {adapter_dir}\n"
        f"\n"
        f"Next steps:\n"
        f"  1. Merge adapter with base model\n"
        f"  2. Convert to GGUF for Ollama\n"
        f"  3. Update OLLAMA_MODEL in .env\n"
        f"{'='*60}"
    )


def main():
    parser = argparse.ArgumentParser(description="Investment Brain DPO Fine-tuning (Vanilla)")
    parser.add_argument("--data", required=True, help="Path to DPO pairs JSON")
    parser.add_argument("--output", default="models/investment-brain-dpo-v1", help="Output directory")
    parser.add_argument("--base-model", default="Qwen/Qwen2.5-7B-Instruct", help="Base HF model")
    parser.add_argument("--base-adapter", default=None, help="Path to SFT LoRA adapter to load first")
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
        base_adapter=args.base_adapter,
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

#!/usr/bin/env python3
"""
Investment Brain LoRA Fine-tuning (Vanilla Transformers + PEFT)
Bypasses Unsloth/Triton for Windows compatibility.
Uses: transformers + peft + bitsandbytes + trl
"""
import argparse
import json
import logging
import os
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def load_training_data(data_path: str) -> list[dict]:
    """Load Alpaca-format training data."""
    with open(data_path, "r", encoding="utf-8-sig") as f:
        data = json.load(f)
    logger.info(f"Loaded {len(data)} training examples from {data_path}")
    return data


def format_alpaca_to_chat(examples: list[dict]) -> list[dict]:
    """Convert Alpaca format to chat messages for Qwen."""
    formatted = []
    for ex in examples:
        messages = [
            {"role": "system", "content": "You are an expert Taiwan stock market investment analyst."},
            {"role": "user", "content": f"{ex['instruction']}\n\n{ex.get('input', '')}".strip()},
            {"role": "assistant", "content": ex["output"]},
        ]
        formatted.append({"messages": messages})
    return formatted


def finetune(
    data_path: str,
    output_dir: str,
    base_model: str = "Qwen/Qwen2.5-7B-Instruct",
    lora_rank: int = 16,
    lora_alpha: int = 32,
    epochs: int = 3,
    learning_rate: float = 2e-4,
    batch_size: int = 1,
    gradient_accumulation_steps: int = 4,
    max_seq_length: int = 2048,
):
    """Run LoRA fine-tuning with vanilla transformers + PEFT."""
    import torch
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        BitsAndBytesConfig,
    )
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from trl import SFTTrainer, SFTConfig

    # Load data
    raw_data = load_training_data(data_path)
    chat_data = format_alpaca_to_chat(raw_data)

    logger.info(f"Training dataset: {len(chat_data)} examples")
    logger.info(f"Base model: {base_model}")
    logger.info(f"LoRA config: rank={lora_rank}, alpha={lora_alpha}")
    logger.info(f"Training: epochs={epochs}, lr={learning_rate}, batch={batch_size}")

    # BitsAndBytes 4-bit config
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )

    # Load tokenizer
    logger.info("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # Load model with 4-bit quantization
    logger.info("Loading model with 4-bit quantization...")
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        torch_dtype=torch.bfloat16,
        attn_implementation="eager",  # Avoid flash attention issues on Windows
    )

    # Prepare for k-bit training
    model = prepare_model_for_kbit_training(model)

    # LoRA config
    lora_config = LoraConfig(
        r=lora_rank,
        lora_alpha=lora_alpha,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )

    model = get_peft_model(model, lora_config)
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    logger.info(f"Trainable: {trainable_params:,} / {total_params:,} ({100*trainable_params/total_params:.2f}%)")

    # Format data using tokenizer chat template
    from datasets import Dataset

    def apply_chat_template(example):
        text = tokenizer.apply_chat_template(
            example["messages"], tokenize=False, add_generation_prompt=False
        )
        return {"text": text}

    dataset = Dataset.from_list(chat_data)
    dataset = dataset.map(apply_chat_template)
    logger.info(f"Dataset formatted: {len(dataset)} examples")

    # Training arguments
    os.makedirs(output_dir, exist_ok=True)
    training_args = SFTConfig(
        output_dir=output_dir,
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        gradient_accumulation_steps=gradient_accumulation_steps,
        learning_rate=learning_rate,
        weight_decay=0.01,
        warmup_steps=3,
        logging_steps=1,
        save_steps=50,
        save_total_limit=3,
        bf16=True,
        optim="adamw_8bit",
        seed=42,
        report_to="none",
        gradient_checkpointing=True,
        gradient_checkpointing_kwargs={"use_reentrant": False},
        max_grad_norm=0.3,
        dataloader_pin_memory=False,  # Avoid Windows multiprocessing issues
        max_length=max_seq_length,
    )

    # Trainer
    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset,
        processing_class=tokenizer,
        args=training_args,
    )

    # Train
    logger.info("Starting LoRA fine-tuning...")
    train_result = trainer.train()
    logger.info(f"Training complete! Loss: {train_result.training_loss:.4f}")

    # Save LoRA adapter
    adapter_dir = os.path.join(output_dir, "lora_adapter")
    model.save_pretrained(adapter_dir)
    tokenizer.save_pretrained(adapter_dir)
    logger.info(f"LoRA adapter saved to {adapter_dir}")

    # Save training metrics
    metrics = train_result.metrics
    metrics["trainable_params"] = trainable_params
    metrics["total_params"] = total_params
    metrics["num_examples"] = len(chat_data)
    with open(os.path.join(output_dir, "training_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)
    logger.info(f"Metrics saved to {output_dir}/training_metrics.json")

    # Export to GGUF for Ollama
    try:
        export_gguf(model, tokenizer, output_dir, base_model)
    except Exception as e:
        logger.warning(f"GGUF export failed (non-critical): {e}")
        logger.info("You can manually merge and convert later.")

    logger.info("=" * 60)
    logger.info("FINE-TUNING COMPLETE!")
    logger.info(f"  Adapter: {adapter_dir}")
    logger.info(f"  Loss: {train_result.training_loss:.4f}")
    logger.info("=" * 60)

    return train_result


def export_gguf(model, tokenizer, output_dir, base_model):
    """Try to export merged model to GGUF format for Ollama."""
    logger.info("Attempting GGUF export...")
    from peft import PeftModel

    # Merge LoRA weights
    merged = model.merge_and_unload()
    merged_dir = os.path.join(output_dir, "merged")
    merged.save_pretrained(merged_dir)
    tokenizer.save_pretrained(merged_dir)
    logger.info(f"Merged model saved to {merged_dir}")

    # Create Modelfile for Ollama
    modelfile_content = f"""FROM {merged_dir}
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER num_ctx 4096

SYSTEM \"\"\"You are an expert Taiwan & US stock market investment analyst specializing in technical analysis, fundamental analysis, and risk management. Provide detailed, actionable investment insights in Traditional Chinese (繁體中文).\"\"\"
"""
    modelfile_path = os.path.join(output_dir, "Modelfile")
    with open(modelfile_path, "w", encoding="utf-8") as f:
        f.write(modelfile_content)
    logger.info(f"Modelfile created at {modelfile_path}")
    logger.info("To deploy: ollama create investment-brain-v1 -f " + modelfile_path)


def main():
    parser = argparse.ArgumentParser(description="Investment Brain LoRA Fine-tuning (Vanilla)")
    parser.add_argument("--data", required=True, help="Path to training data (Alpaca JSON)")
    parser.add_argument("--output", default="models/investment-brain-v1", help="Output directory")
    parser.add_argument("--base-model", default="Qwen/Qwen2.5-7B-Instruct", help="Base model")
    parser.add_argument("--rank", type=int, default=16, help="LoRA rank")
    parser.add_argument("--alpha", type=int, default=32, help="LoRA alpha")
    parser.add_argument("--epochs", type=int, default=3, help="Training epochs")
    parser.add_argument("--lr", type=float, default=2e-4, help="Learning rate")
    parser.add_argument("--batch-size", type=int, default=1, help="Batch size")
    parser.add_argument("--grad-accum", type=int, default=4, help="Gradient accumulation steps")
    parser.add_argument("--max-seq-length", type=int, default=2048, help="Max sequence length")

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
        gradient_accumulation_steps=args.grad_accum,
        max_seq_length=args.max_seq_length,
    )


if __name__ == "__main__":
    main()

"""
Training — Model fine-tuning and data collection infrastructure.

Modules:
    data_collector: Automatic I/O pair capture for Alpaca-format training
    preference_collector: Accept/Reject pair capture for DPO fine-tuning
"""
from .data_collector import TrainingDataCollector, training_collector
from .preference_collector import PreferenceCollector, preference_collector
from .market_feedback_loop import MarketFeedbackLoop

__all__ = [
    "TrainingDataCollector",
    "training_collector",
    "PreferenceCollector",
    "preference_collector",
    "MarketFeedbackLoop",
]

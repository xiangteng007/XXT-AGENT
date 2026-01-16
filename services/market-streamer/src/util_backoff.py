"""
Exponential backoff utility with jitter.
"""
import random


def exp_backoff_delay(attempt: int, min_delay: float, max_delay: float) -> float:
    """
    Calculate exponential backoff delay with jitter.
    
    Args:
        attempt: Current attempt number (starts from 1)
        min_delay: Minimum delay in seconds
        max_delay: Maximum delay in seconds
    
    Returns:
        Delay in seconds with jitter applied
    """
    base = min(max_delay, min_delay * (2 ** (attempt - 1)))
    jitter = random.uniform(0, base * 0.25)
    return min(max_delay, base + jitter)

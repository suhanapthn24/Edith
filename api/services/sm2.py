"""
SM-2 Spaced Repetition Algorithm
Used for both DSA problems and vocabulary items.
"""
from datetime import date, timedelta


def calculate_next_review(
    grade: int,
    repetitions: int,
    ease_factor: float,
    interval_days: int,
) -> tuple[date, int, float, int]:
    """
    Returns (next_review_date, new_repetitions, new_ease_factor, new_interval_days).

    grade: 0-5 quality of recall
      0 = complete blackout
      1 = incorrect but upon seeing answer it was recognized
      2 = incorrect but answer felt easy to recall
      3 = correct with significant difficulty
      4 = correct with some hesitation
      5 = perfect recall
    """
    if grade < 3:
        # Failed — reset repetitions, keep ease factor adjustment
        new_repetitions = 0
        new_interval = 1
    else:
        if repetitions == 0:
            new_interval = 1
        elif repetitions == 1:
            new_interval = 6
        else:
            new_interval = round(interval_days * ease_factor)
        new_repetitions = repetitions + 1

    # Update ease factor (EF stays >= 1.3)
    new_ef = ease_factor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
    new_ef = max(1.3, new_ef)

    next_date = date.today() + timedelta(days=new_interval)
    return next_date, new_repetitions, round(new_ef, 2), new_interval

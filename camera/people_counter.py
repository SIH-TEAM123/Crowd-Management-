"""People counter abstraction for simulated and detection-based counting."""

from typing import Any, List, Union


class PeopleCounter:
    """Provides pure software people counting routines."""

    @staticmethod
    def count_simulated(count: Any) -> int:
        """Validate and return a simulated people count.

        Args:
            count: Raw count input to validate.

        Returns:
            int: Validated non-negative integer count.

        Raises:
            TypeError: If count is bool, float, string, or non-int type.
            ValueError: If count is negative.
        """
        if type(count) is bool:
            raise TypeError("People count cannot be a boolean value.")

        if type(count) is not int:
            raise TypeError(f"People count must be an integer, got {type(count).__name__}.")

        if count < 0:
            raise ValueError("People count cannot be negative.")

        return count

    @staticmethod
    def count_detections(detections: Any) -> int:
        """Count person objects from a list of detection results.

        Filters items where class/category/label/type equals 'person' (case-insensitive).
        Original detection objects are discarded and never returned.

        Args:
            detections: List of detection dictionaries or string class labels.

        Returns:
            int: Count of detected persons.

        Raises:
            TypeError: If detections is not a list.
        """
        if detections is None:
            return 0

        if not isinstance(detections, list):
            raise TypeError("Detections input must be a list.")

        person_count = 0

        for item in detections:
            if item is None:
                continue

            label = None
            if isinstance(item, str):
                label = item
            elif isinstance(item, dict):
                # Check common key names for class labels
                for key in ("class", "category", "label", "type", "class_name"):
                    if key in item and item[key] is not None:
                        label = str(item[key])
                        break
            elif hasattr(item, "class_name"):
                label = str(getattr(item, "class_name"))
            elif hasattr(item, "category"):
                label = str(getattr(item, "category"))

            if label and label.strip().lower() == "person":
                person_count += 1

        return person_count

from app.services.person4.interfaces.person4_queue_interface import get_queue_data


# ---------------------------------------------------------
# Temporary configuration
# ---------------------------------------------------------
# Person 2's dataset does not contain active counter count.
# This value is temporary and can later be replaced by
# actual operational data.
DEFAULT_ACTIVE_COUNTERS = 4

# Person 2 confirmed that recent_arrivals and recent_services
# are calculated over the previous 10 minutes.
OBSERVATION_WINDOW_MINUTES = 10


def build_current_operational_state():
    """
    Convert Person 2 queue data into the generic operational
    state required by Person 4.
    """

    queue_data = get_queue_data()

    active_counters = DEFAULT_ACTIVE_COUNTERS

    recent_arrivals = float(queue_data["recent_arrivals"])
    recent_services = float(queue_data["recent_services"])
    wait_length_seconds = float(queue_data["wait_length"])
    daily_caller = float(queue_data["daily_caller"])
    time_since_previous_call = float(
        queue_data["time_since_previous_call"]
)

    # ---------------------------------------------
    # Calculate arrival rate
    # ---------------------------------------------
    arrival_rate_per_min = (
        recent_arrivals / OBSERVATION_WINDOW_MINUTES
    )

    # ---------------------------------------------
    # Calculate service rate per counter
    # ---------------------------------------------
    if active_counters > 0:
        service_rate_per_counter_per_min = (
            recent_services
            / (OBSERVATION_WINDOW_MINUTES * active_counters)
        )
    else:
        service_rate_per_counter_per_min = 0.0

    # ---------------------------------------------
    # Convert wait time from seconds to minutes
    # ---------------------------------------------
    average_wait_minutes = wait_length_seconds / 60.0

    # ---------------------------------------------
    # Calculate utilization
    # ---------------------------------------------
    total_service_capacity = (
        service_rate_per_counter_per_min * active_counters
    )

    if total_service_capacity > 0:
        utilization = (
            arrival_rate_per_min / total_service_capacity
        )
    else:
        utilization = 0.0

    # Keep utilization inside Person 4's required range.
    utilization = min(max(utilization, 0.0), 1.0)

    return {
        "active_counters": active_counters,
        "queue_length": int(queue_data["queue_ahead"]),
        "daily_caller": daily_caller,
        "time_since_previous_call": time_since_previous_call,
        "arrival_rate_per_min": arrival_rate_per_min,
        "service_rate_per_counter_per_min":
            service_rate_per_counter_per_min,
        "average_wait_minutes": average_wait_minutes,
        "utilization": utilization,
        "completed_service_times": [],
    }


if __name__ == "__main__":

    print("========================================")
    print("PERSON 4 INPUT ADAPTER")
    print("========================================")

    operational_state = build_current_operational_state()

    print("\nCurrent operational state:")

    for field, value in operational_state.items():
        print(f"{field}: {value}")

    print("\n========================================")
    print("INPUT ADAPTER COMPLETED")
    print("========================================")
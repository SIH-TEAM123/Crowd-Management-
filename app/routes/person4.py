from simulation.crowd_simulation import run_simulation
from datetime import datetime

from fastapi import APIRouter, Depends

from app.services.person4.models.input_models import (
    OptimizationInput,
    CurrentOperationalState,
    Prediction,
    ResourceState,
    PriorityInfo,
)

from app.services.person4.optimizer.optimizer import optimize

from app.services.person4.interfaces.person4_input_adapter import (
    build_current_operational_state,
)

from app.services.person4.interfaces.person3_prediction_adapter import (
    get_person3_prediction,
)

from app.utils.roles import require_operator
router = APIRouter(
    prefix="/optimization",
    tags=["Optimization"],
)


@router.post("/optimize")
async def run_optimization(
    input_data: OptimizationInput,
    current_user=Depends(require_operator),
):

    current_state_data = build_current_operational_state()

    input_data.current_state = CurrentOperationalState(
        **current_state_data
    )

    queue_length = current_state_data["queue_length"]
    daily_caller = current_state_data["daily_caller"]
    time_since_previous_call = current_state_data["time_since_previous_call"]

    prediction_data = get_person3_prediction(
        current_queue_length=queue_length,
        queue_ahead=queue_length,
        daily_caller=daily_caller,
        hour=input_data.timestamp.hour,
        minute=input_data.timestamp.minute,
        day_of_week=input_data.timestamp.weekday(),
        recent_arrivals=current_state_data["arrival_rate_per_min"] * 10,
        recent_services=(
            current_state_data["service_rate_per_counter_per_min"]
            * 10
            * current_state_data["active_counters"]
    ),
        avg_service_time=(
            1 / current_state_data["service_rate_per_counter_per_min"] * 60
            if current_state_data["service_rate_per_counter_per_min"] > 0
            else 0
    ),
        time_since_previous_call=time_since_previous_call,
)

    input_data.prediction = Prediction(
        **prediction_data
    )

    result = optimize(input_data)

    return result


@router.get("/forecast")
async def get_crowd_forecast():
    """
    Read-only endpoint for the Analytics dashboard.
    Uses current Person 2 operational data and Person 3 ML prediction.
    """

    current_state_data = build_current_operational_state()

    queue_length = current_state_data["queue_length"]
    daily_caller = current_state_data["daily_caller"]
    time_since_previous_call = current_state_data[
        "time_since_previous_call"
    ]

    now = datetime.now()

    prediction_data = get_person3_prediction(
        current_queue_length=queue_length,
        queue_ahead=queue_length,
        daily_caller=daily_caller,
        hour=now.hour,
        minute=now.minute,
        day_of_week=now.weekday(),
        recent_arrivals=(
            current_state_data["arrival_rate_per_min"] * 10
        ),
        recent_services=(
            current_state_data["service_rate_per_counter_per_min"]
            * 10
            * current_state_data["active_counters"]
        ),
        avg_service_time=(
            1 / current_state_data[
                "service_rate_per_counter_per_min"
            ] * 60
            if current_state_data[
                "service_rate_per_counter_per_min"
            ] > 0
            else 0
        ),
        time_since_previous_call=time_since_previous_call,
    )

    return {
        "current_queue_length": queue_length,
        "daily_caller": daily_caller,
        "active_counters": current_state_data["active_counters"],
        "arrival_rate_per_min": current_state_data[
            "arrival_rate_per_min"
        ],
        "service_rate_per_counter_per_min": current_state_data[
            "service_rate_per_counter_per_min"
        ],
        **prediction_data,
    }

@router.post("/simulation")
async def run_crowd_simulation(
    num_users: int = 50,
):
    """
    Run synthetic crowd simulation through the real
    Person 3 ML + Person 4 optimizer + fairness pipeline.
    """

    if num_users < 1 or num_users > 500:
        return {
            "error": "Number of users must be between 1 and 500"
        }

    return run_simulation(
        num_users=num_users,
        facility_id="SIM-H001",
    )
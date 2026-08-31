"""Unit tests for Person 4 dynamic ETA optimizer module."""

import pytest
from optimizer.eta_optimizer import DynamicETAResult, calculate_dynamic_eta


def test_no_historical_service_times():
    """Test 1: When no completed service times exist, uses default admin limit."""
    res = calculate_dynamic_eta(people_ahead=10, admin_service_time_minutes=8.0)
    assert isinstance(res, DynamicETAResult)
    assert res.people_ahead == 10
    assert res.effective_service_time_minutes == 8.0
    assert res.estimated_wait_minutes == 80.0
    assert res.calculation_method == "DEFAULT_ADMIN"


def test_one_completed_service_time():
    """Test 2: Single completed service time updates the effective service time and ETA."""
    res = calculate_dynamic_eta(
        people_ahead=10,
        admin_service_time_minutes=8.0,
        recent_completed_service_times=[5.0],
    )
    assert res.effective_service_time_minutes == 5.0
    assert res.estimated_wait_minutes == 50.0
    assert res.calculation_method == "HISTORICAL_SMOOTHED"


def test_multiple_completed_service_times():
    """Test 3: Multiple completed service times use rolling window average."""
    res = calculate_dynamic_eta(
        people_ahead=10,
        admin_service_time_minutes=8.0,
        recent_completed_service_times=[5.0, 5.0, 6.0, 5.0, 5.0],
    )
    assert res.effective_service_time_minutes == 5.2
    assert res.estimated_wait_minutes == 52.0
    assert res.calculation_method == "HISTORICAL_SMOOTHED"


def test_faster_recent_service_times_reduce_eta():
    """Test 4: Faster recent completed service times reduce the estimated wait time."""
    admin_res = calculate_dynamic_eta(people_ahead=10, admin_service_time_minutes=8.0)
    faster_res = calculate_dynamic_eta(
        people_ahead=10,
        admin_service_time_minutes=8.0,
        recent_completed_service_times=[4.0, 3.5, 4.5],
    )
    assert faster_res.estimated_wait_minutes < admin_res.estimated_wait_minutes


def test_slower_recent_service_times_increase_eta():
    """Test 5: Slower recent completed service times increase the estimated wait time."""
    admin_res = calculate_dynamic_eta(people_ahead=10, admin_service_time_minutes=8.0)
    slower_res = calculate_dynamic_eta(
        people_ahead=10,
        admin_service_time_minutes=8.0,
        recent_completed_service_times=[12.0, 11.0, 13.0],
    )
    assert slower_res.estimated_wait_minutes > admin_res.estimated_wait_minutes


def test_zero_people_ahead_returns_zero_eta():
    """Test 6: Zero people ahead returns zero wait time."""
    res = calculate_dynamic_eta(people_ahead=0, admin_service_time_minutes=8.0)
    assert res.estimated_wait_minutes == 0.0
    assert res.calculation_method == "ZERO_PEOPLE"


def test_multiple_counters_reduce_eta():
    """Test 7: Adding active service counters proportionally reduces estimated wait time."""
    single_res = calculate_dynamic_eta(people_ahead=10, admin_service_time_minutes=8.0, active_counters=1)
    multi_res = calculate_dynamic_eta(people_ahead=10, admin_service_time_minutes=8.0, active_counters=2)
    assert multi_res.estimated_wait_minutes == single_res.estimated_wait_minutes / 2.0


def test_extreme_outlier_does_not_completely_distort_eta():
    """Test 8: Outlier service time (e.g. 60 min outlier in normal 5 min queue) is filtered out."""
    normal_times = [5.0, 5.2, 4.8, 5.1, 5.0, 5.3, 4.9, 5.1, 5.0]
    outlier_times = normal_times + [60.0]  # extreme outlier at end

    res = calculate_dynamic_eta(
        people_ahead=10,
        admin_service_time_minutes=8.0,
        recent_completed_service_times=outlier_times,
    )
    # Effective service time should remain around ~5.0 - 5.5 min, not spike to 10+ min
    assert res.effective_service_time_minutes < 7.0
    assert res.estimated_wait_minutes < 70.0


def test_repeated_identical_input_produces_identical_result():
    """Test 9: Dynamic ETA calculation is completely deterministic."""
    res1 = calculate_dynamic_eta(
        people_ahead=10,
        admin_service_time_minutes=8.0,
        recent_completed_service_times=[5.0, 6.0, 5.5],
        active_counters=2,
    )
    res2 = calculate_dynamic_eta(
        people_ahead=10,
        admin_service_time_minutes=8.0,
        recent_completed_service_times=[5.0, 6.0, 5.5],
        active_counters=2,
    )
    assert res1 == res2


def test_negative_invalid_inputs_rejected():
    """Test 10: Negative people ahead, admin time <= 0, active counters < 0 raise ValueError."""
    with pytest.raises(ValueError):
        calculate_dynamic_eta(people_ahead=-1)

    with pytest.raises(ValueError):
        calculate_dynamic_eta(people_ahead=10, admin_service_time_minutes=-5.0)

    with pytest.raises(ValueError):
        calculate_dynamic_eta(people_ahead=10, active_counters=-1)

    with pytest.raises(ValueError):
        calculate_dynamic_eta(people_ahead=10, recent_completed_service_times=[-2.0])

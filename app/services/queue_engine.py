"""
VIZITOR — Unified Queue, Token, Crowd and Simulation Engine
============================================================
Single Source of Truth for:
- Token numbering (strictly starts at 114, sequential FCFS)
- Queue ordering with Emergency priority support
- Unique person crowd calculation (1 user = 1 physical person)
- Authoritative waiting time calculation
- Crowd status classification (No Crowd, Low, Moderate, High, Critical)
- Integrated backend simulation (same queue engine for real and simulated users)
"""

from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional, Set
import re
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment
from app.models.token import Token
from app.models.user import User
from app.config import settings


# ============================================================
# ENGINE CONFIGURATION CONSTANTS
# ============================================================

TOKEN_PREFIX = "A"
TOKEN_START = settings.TOKEN_START  # Configurable starting token (default 114)

SERVICE_RATE_MINUTES = settings.DEFAULT_SERVICE_RATE_MINUTES  # Average minutes per patient service

# Crowd Level Thresholds
CROWD_LOW_MAX = 5
CROWD_MODERATE_MAX = 15
CROWD_HIGH_MAX = 30


class QueueEngine:
    """
    Authoritative Queue Engine for VIZITOR.
    Manages real database appointments, priority ordering,
    unique person crowd tracking, rolling throughput tracking,
    and single-source token counter with simulation offset.
    """

    def __init__(self):
        self.TOKEN_START: int = TOKEN_START
        self.simulation_active: bool = False
        self.simulation_synthetic_users: int = 0
        self.simulation_started_at: Optional[datetime] = None
        self.simulation_service_rate_minutes: float = SERVICE_RATE_MINUTES
        self.simulation_facility_id: str = "FAC-MAIN-001"
        self.simulated_tokens_offset: int = 0
        self.service_durations_history: List[float] = [SERVICE_RATE_MINUTES, SERVICE_RATE_MINUTES]

    def get_average_service_time(self) -> float:
        """Calculate dynamic rolling average service time based on real throughput."""
        if not self.service_durations_history:
            return SERVICE_RATE_MINUTES
        return round(sum(self.service_durations_history) / len(self.service_durations_history), 2)

    def record_service_duration(self, duration_minutes: float):
        """Record an actual completed service duration into the rolling throughput tracker."""
        d = max(0.5, min(30.0, float(duration_minutes)))
        self.service_durations_history.append(d)
        if len(self.service_durations_history) > 25:
            self.service_durations_history.pop(0)

    def format_token(self, token_num: Optional[int]) -> Optional[str]:
        """Return standardized token display string, e.g. A-112 or None if null."""
        if token_num is None:
            return None
        return f"{TOKEN_PREFIX}-{token_num}"

    def parse_token_number(self, token_str: Optional[str]) -> Optional[int]:
        """Extract integer token number from token string (e.g. 'A-112' -> 112)"""
        if not token_str:
            return None
        m = re.search(r'(\d+)\s*$', str(token_str))
        return int(m.group(1)) if m else None

    def calculate_crowd_level(self, queue_size: int) -> str:
        """Derive authoritative crowd level from queue size."""
        if queue_size <= 0:
            return "No Crowd"
        if queue_size <= CROWD_LOW_MAX:
            return "Low"
        if queue_size <= CROWD_MODERATE_MAX:
            return "Moderate"
        if queue_size <= CROWD_HIGH_MAX:
            return "High"
        return "Critical"

    def token_display_for(self, appointment_id: int) -> str:
        """Starts strictly from configured TOKEN_START (112) + real appointments + simulation offset."""
        token_num = self.token_number_for(appointment_id)
        return self.format_token(token_num)

    def token_number_for(self, appointment_id: int) -> int:
        return (self.TOKEN_START - 1) + appointment_id + self.simulated_tokens_offset

    async def get_active_appointments_ordered(
        self, db: AsyncSession
    ) -> List[Appointment]:
        """
        Fetch active appointments for today or future dates, ordered by:
        1. Emergency / Priority status (EMERGENCY tokens expedited to front)
        2. Scheduled Date & Time
        3. FCFS (appointment_id)
        """
        today = date.today()

        result = await db.execute(
            select(Appointment)
            .where(
                Appointment.status != "CANCELLED",
                Appointment.appointment_date >= today,
            )
            .order_by(
                Appointment.appointment_date,
                Appointment.appointment_time,
                Appointment.appointment_id,
            )
        )
        appointments = list(result.scalars().all())

        if not appointments:
            return []

        token_ids = [a.token_id for a in appointments if a.token_id]
        if token_ids:
            t_result = await db.execute(
                select(Token).where(Token.token_id.in_(token_ids))
            )
            token_map = {t.token_id: t for t in t_result.scalars().all()}
        else:
            token_map = {}

        # Sort: EMERGENCY (0), TIME_CRITICAL/VULNERABLE (1), NORMAL (2)
        def priority_key(appt: Appointment):
            t = token_map.get(appt.token_id)
            pt = (getattr(t, "priority_type", "NORMAL") or "NORMAL").upper()
            if pt == "EMERGENCY":
                p_rank = 0
            elif pt in ("TIME_CRITICAL", "VULNERABLE"):
                p_rank = 1
            else:
                p_rank = 2
            return (p_rank, appt.appointment_date, appt.appointment_time, appt.appointment_id)

        appointments.sort(key=priority_key)
        return appointments

    def start_simulation(self, num_users: int = 50, service_rate_minutes: float = SERVICE_RATE_MINUTES) -> Dict[str, Any]:
        """Activate backend simulation overlay and advance unified counter by N users."""
        self.simulation_active = True
        n = max(1, min(500, int(num_users)))
        self.simulation_synthetic_users = n
        self.simulated_tokens_offset += n
        self.simulation_started_at = datetime.now()
        self.simulation_service_rate_minutes = max(0.5, float(service_rate_minutes))

        return {
            "simulation_active": True,
            "synthetic_users": self.simulation_synthetic_users,
            "simulated_tokens_offset": self.simulated_tokens_offset,
            "started_at": self.simulation_started_at.isoformat(),
            "service_rate_minutes": self.simulation_service_rate_minutes,
        }

    def reset_simulation(self) -> Dict[str, Any]:
        """Reset backend simulation to normal live state."""
        self.simulation_active = False
        self.simulation_synthetic_users = 0
        self.simulated_tokens_offset = 0
        self.simulation_started_at = None
        self.simulation_service_rate_minutes = SERVICE_RATE_MINUTES

        return {
            "simulation_active": False,
            "simulated_tokens_offset": 0,
            "message": "Simulation cleared. Normal live queue active."
        }

    async def get_queue_status(
        self, db: AsyncSession, current_user: Optional[User] = None
    ) -> Dict[str, Any]:
        """
        Calculate authoritative queue status for the entire system.
        Incorporates:
        - Real appointments from DB
        - Unique person crowd deduplication
        - Authoritative token calculation starting at 114
        - Authoritative wait times
        - Active simulation overlay (same engine)
        """
        now = datetime.now()
        active = await self.get_active_appointments_ordered(db)

        rate_minutes = (
            self.simulation_service_rate_minutes
            if self.simulation_active
            else self.get_average_service_time()
        )

        if not active and not self.simulation_active:
            # Initially NO active token when queue is empty
            currently_serving_appt = None
            currently_serving_id = None
            current_index = -1
            remaining_current_service = 0.0
            currently_serving_token_num = None
            currently_serving_display = None
            waiting_appointments = []
            real_queue_size = 0
            total_queue_size = 0
            people_currently_present = 0
            estimated_wait_minutes = 0.0
            crowd_level = "No Crowd"
            sim_completed_count = 0
            sim_synthetic_remaining = 0
        else:
            # We have appointments or simulation active
            due_appointments = [
                a for a in active
                if datetime.combine(a.appointment_date, a.appointment_time) <= now
            ]

            if not due_appointments:
                if active:
                    # Upcoming appointments for today/future: first one in line is actively called/served
                    currently_serving_appt = active[0]
                    currently_serving_id = currently_serving_appt.appointment_id
                    current_index = 0
                    remaining_current_service = 0.0
                    currently_serving_token_num = (self.TOKEN_START - 1) + currently_serving_id
                    currently_serving_display = self.format_token(currently_serving_token_num)
                    waiting_appointments = active[1:]
                else:
                    # Only simulation active
                    currently_serving_appt = None
                    currently_serving_id = None
                    current_index = -1
                    remaining_current_service = 0.0
                    currently_serving_token_num = self.TOKEN_START
                    currently_serving_display = self.format_token(self.TOKEN_START)
                    waiting_appointments = []
            else:
                first_appt = due_appointments[0]
                # Measure elapsed time from when this appointment became due or was created
                ref_time = datetime.combine(first_appt.appointment_date, first_appt.appointment_time)
                minutes_elapsed = max(0.0, (now - ref_time).total_seconds() / 60.0)
                tokens_advanced = int(minutes_elapsed // rate_minutes)
                current_index = min(tokens_advanced, len(active) - 1)

                currently_serving_appt = active[current_index]
                currently_serving_id = currently_serving_appt.appointment_id
                currently_serving_token_num = (self.TOKEN_START - 1) + currently_serving_id

                if current_index >= len(active) - 1 and tokens_advanced >= len(active):
                    remaining_current_service = 0.0
                else:
                    time_in_service = minutes_elapsed % rate_minutes
                    remaining_current_service = max(0.0, rate_minutes - time_in_service)

                serving_idx = active.index(currently_serving_appt) if currently_serving_appt in active else -1
                waiting_appointments = active[serving_idx + 1:] if serving_idx >= 0 else []

            real_queue_size = len(active)

            # Simulation Progression (if active)
            sim_synthetic_remaining = 0
            sim_completed_count = 0
            if self.simulation_active and self.simulation_started_at:
                sim_elapsed_min = max(0.0, (now - self.simulation_started_at).total_seconds() / 60.0)
                sim_completed_count = min(
                    self.simulation_synthetic_users,
                    int(sim_elapsed_min // rate_minutes)
                )
                sim_synthetic_remaining = max(0, self.simulation_synthetic_users - sim_completed_count)
                if currently_serving_token_num is None:
                    currently_serving_token_num = self.TOKEN_START + sim_completed_count
                else:
                    currently_serving_token_num += sim_completed_count

            total_queue_size = real_queue_size + sim_synthetic_remaining

            # UNIQUE PHYSICAL PERSONS IN CROWD (One User = One Person)
            unique_physical_users: Set[str] = set()
            for appt in waiting_appointments:
                unique_physical_users.add(appt.user_id)
            if currently_serving_appt:
                unique_physical_users.add(currently_serving_appt.user_id)

            people_currently_present = len(unique_physical_users) + sim_synthetic_remaining

            if total_queue_size == 0 and currently_serving_appt is None and not self.simulation_active:
                people_currently_present = 0

            # Global wait time
            if total_queue_size == 0:
                estimated_wait_minutes = 0.0
            elif currently_serving_appt is None and not self.simulation_active:
                estimated_wait_minutes = round(total_queue_size * rate_minutes, 1)
            else:
                estimated_wait_minutes = round(
                    remaining_current_service + (max(total_queue_size - 1, 0) * rate_minutes),
                    1
                )

            crowd_level = self.calculate_crowd_level(total_queue_size)
            currently_serving_display = self.format_token(currently_serving_token_num) if currently_serving_token_num else None

        you_data = None
        if current_user:
            user_active_appts = [
                a for a in active if a.user_id == current_user.user_id
            ]

            if user_active_appts:
                my_appt = user_active_appts[0]
                my_id = my_appt.appointment_id
                base_my_token_num = self.token_number_for(my_id)
                my_idx = active.index(my_appt) if my_appt in active else -1
                real_position = (my_idx + 1) if my_idx >= 0 else None

                # People strictly ahead in the queue sequence
                if my_idx >= 0 and current_index >= 0:
                    real_ahead = max(0, my_idx - current_index)
                else:
                    real_ahead = max(0, len([a for a in active if a.appointment_id < my_id]))

                if self.simulation_active and sim_synthetic_remaining > 0:
                    my_status = "WAITING"
                    people_ahead = real_ahead + sim_synthetic_remaining
                    my_token_num = (currently_serving_token_num or self.TOKEN_START) + people_ahead + 1
                    my_wait = round(
                        remaining_current_service + (people_ahead * rate_minutes),
                        1
                    )
                else:
                    if my_idx >= 0 and current_index >= 0:
                        if my_idx < current_index:
                            my_status = "SERVED"
                            people_ahead = 0
                            my_wait = 0.0
                            my_token_num = base_my_token_num
                        elif my_idx == current_index:
                            my_status = "BEING_SERVED"
                            people_ahead = 0
                            my_wait = 0.0
                            my_token_num = currently_serving_token_num or base_my_token_num
                        else:
                            my_status = "WAITING"
                            people_ahead = real_ahead
                            my_wait = round(
                                remaining_current_service + (max(0, people_ahead - 1) * rate_minutes),
                                1
                            )
                            my_token_num = base_my_token_num
                    else:
                        my_status = "WAITING"
                        people_ahead = real_ahead
                        my_wait = round(remaining_current_service + (people_ahead * rate_minutes), 1)
                        my_token_num = base_my_token_num

                assigned_counter_num = ((my_token_num - self.TOKEN_START) % 4) + 1
                assigned_counter_name = f"Counter {assigned_counter_num}"

                you_data = {
                    "appointment_id": my_appt.appointment_id,
                    "token_display": self.format_token(my_token_num),
                    "token_number": my_token_num,
                    "purpose": my_appt.purpose,
                    "appointment_date": my_appt.appointment_date,
                    "appointment_time": my_appt.appointment_time,
                    "position": (real_position + sim_synthetic_remaining) if real_position else (people_ahead + 1),
                    "people_ahead": people_ahead if my_status == "WAITING" else 0,
                    "estimated_wait_minutes": my_wait,
                    "status": my_status,
                    "assigned_counter": assigned_counter_name,
                    "counter_number": assigned_counter_num,
                }

        return {
            "server_time": now.isoformat(),
            "total_active": len(active) + sim_synthetic_remaining,
            "served_so_far": max(current_index + sim_completed_count, 0),
            "queue_size": total_queue_size,
            "people_currently_present": people_currently_present,
            "estimated_wait_minutes": estimated_wait_minutes,
            "currently_serving_token": currently_serving_display,
            "currently_serving_number": currently_serving_token_num,
            "remaining_current_service_minutes": round(remaining_current_service, 1),
            "crowd_level": crowd_level,
            "service_rate_minutes": rate_minutes,
            "low_crowd_max": CROWD_LOW_MAX,
            "moderate_crowd_max": CROWD_MODERATE_MAX,
            "high_crowd_max": CROWD_HIGH_MAX,
            "simulation_active": self.simulation_active,
            "simulation_synthetic_users": self.simulation_synthetic_users,
            "you": you_data,
        }


# Global singleton instance
queue_engine = QueueEngine()

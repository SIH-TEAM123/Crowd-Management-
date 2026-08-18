from token_service import (
    create_token,
    start_token_service,
    complete_token_service
)

from token import PriorityType


# Create token
token = create_token(
    user_id=1,
    display_name="Rahul",
    priority_type=PriorityType.NORMAL,
    queue_position=3,
    admin_configured_service_time_minutes=10,
    active_counters=2,
    expiry_minutes=60
)


print("========== TOKEN DETAILS ==========")

print("1. token_id:", token.token_id)

print("2. user_id:", token.user_id)

print("3. anonymous_user_id:", token.anonymous_user_id)

print("4. display_name:", token.display_name)

print("5. token_status:", token.token_status)

print("6. queue_position:", token.queue_position)

print("7. priority_type:", token.priority_type)

print("8. token_created_at:", token.token_created_at)

print("9. service_started_at:", token.service_started_at)

print("10. service_completed_at:", token.service_completed_at)

print(
    "11. admin_configured_service_time_minutes:",
    token.admin_configured_service_time_minutes
)

print("12. active_counters:", token.active_counters)

print("13. token_expires_at:", token.token_expires_at)


# Start service
print("\n========== START SERVICE ==========")

token = start_token_service(token.token_id)

print("Status:", token.token_status)
print("Service Started:", token.service_started_at)


# Complete service
print("\n========== COMPLETE SERVICE ==========")

token = complete_token_service(token.token_id)

print("Status:", token.token_status)
print("Service Completed:", token.service_completed_at)


# Calculate actual service time
service_time = token.get_service_time_seconds()

print("\n========== ACTUAL SERVICE TIME ==========")

print("Service Time:", service_time, "seconds")
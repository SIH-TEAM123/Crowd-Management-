from token import Token, TokenStatus, PriorityType


tokens = []


def create_token(
    user_id=None,
    anonymous_user_id=None,
    display_name=None,
    priority_type=PriorityType.NORMAL,
    queue_position=None,
    admin_configured_service_time_minutes=10,
    active_counters=1,
    expiry_minutes=None
):
    new_token = Token(
        user_id=user_id,
        anonymous_user_id=anonymous_user_id,
        display_name=display_name,
        priority_type=priority_type,
        admin_configured_service_time_minutes=(
            admin_configured_service_time_minutes
        ),
        active_counters=active_counters,
        expiry_minutes=expiry_minutes
    )

    new_token.queue_position = queue_position

    tokens.append(new_token)

    return new_token


def get_token(token_id):
    for token in tokens:
        if token.token_id == token_id:
            return token

    return None


def get_user_tokens(user_id):
    user_tokens = []

    for token in tokens:
        if token.user_id == user_id:
            user_tokens.append(token)

    return user_tokens

def start_token_service(token_id):
    token = get_token(token_id)

    if token is None:
        return None

    token.start_service()

    return token


def complete_token_service(token_id):
    token = get_token(token_id)

    if token is None:
        return None

    token.complete_service()

    return token


def cancel_token(token_id):
    token = get_token(token_id)

    if token is None:
        return None

    token.cancel()

    return token

from datetime import datetime


def check_token_expiry(token_id):
    token = get_token(token_id)

    if token is None:
        return None

    if token.token_expires_at is None:
        return token

    if (
        datetime.now() >= token.token_expires_at
        and token.token_status == TokenStatus.WAITING
    ):
        token.expire()

    return token

def update_queue_position(token_id, queue_position):
    token = get_token(token_id)

    if token is None:
        return None

    token.queue_position = queue_position

    return token


def update_priority(token_id, priority_type):
    token = get_token(token_id)

    if token is None:
        return None

    token.priority_type = priority_type

    return token


def update_active_counters(token_id, active_counters):
    token = get_token(token_id)

    if token is None:
        return None

    token.active_counters = active_counters

    return token
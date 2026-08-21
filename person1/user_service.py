import bcrypt

from user import User
from token_service import create_token


users = []


def register_user(name, email, phone, password):
    user_id = len(users) + 1

    password_hash = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    )

    new_user = User(
        user_id,
        name,
        email,
        phone,
        password_hash
    )

    users.append(new_user)

    return new_user


def login_user(email, password):
    for user in users:

        if user.email == email:

            password_matches = bcrypt.checkpw(
                password.encode("utf-8"),
                user.password_hash
            )

            if password_matches:

                token = create_token(
                    user_id=user.user_id,
                    display_name=user.name
                )

                return user, token

    return None, None
import secrets


def generate_otp() -> str:
    return str(secrets.randbelow(900000) + 100000)
class Appointment:
    def __init__(
        self,
        appointment_id,
        user_id,
        token_id,
        appointment_date,
        appointment_time,
        purpose
    ):
        self.appointment_id = appointment_id
        self.user_id = user_id
        self.token_id = token_id
        self.appointment_date = appointment_date
        self.appointment_time = appointment_time
        self.purpose = purpose
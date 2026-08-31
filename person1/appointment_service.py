from appointment import Appointment


appointments = []


def create_appointment(
    user_id,
    token_id,
    appointment_date,
    appointment_time,
    purpose
):
    appointment_id = len(appointments) + 1

    new_appointment = Appointment(
        appointment_id,
        user_id,
        token_id,
        appointment_date,
        appointment_time,
        purpose
    )

    appointments.append(new_appointment)

    return new_appointment

def get_user_appointments(user_id):
    user_appointments = []

    for appointment in appointments:
        if appointment.user_id == user_id:
            user_appointments.append(appointment)

    return user_appointments

def cancel_appointment(user_id, appointment_id):
    for appointment in appointments:
        if (
            appointment.appointment_id == appointment_id
            and appointment.user_id == user_id
        ):
            appointments.remove(appointment)
            return True

    return False
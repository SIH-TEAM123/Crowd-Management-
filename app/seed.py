import asyncio
from datetime import date, datetime, time, timedelta
from uuid import uuid4

from sqlalchemy import delete, select

from app.database import engine, Base, SessionLocal

from app.models.user import User
from app.models.appointment import Appointment
from app.models.token import Token


async def seed_database():

    print("\nCreating tables...")

    async with engine.begin() as connection:
        await connection.run_sync(
            Base.metadata.create_all
        )

    async with SessionLocal() as db:

        # ====================================================
        # GET ALL EXISTING USERS
        # ====================================================

        result = await db.execute(
            select(User).order_by(User.created_at.asc())
        )

        users = result.scalars().all()

        if not users:

            print(
                "\nERROR: No users found."
            )

            print(
                "Please register at least one account first."
            )

            return

        main_user = users[0]

        print(
            f"\nMain user: {main_user.full_name}"
        )

        print(
            f"User ID: {main_user.user_id}"
        )

        # ====================================================
        # CLEAR OLD APPOINTMENTS AND TOKENS
        # ====================================================

        print("\nClearing old appointment data...")

        await db.execute(
            delete(Token)
        )

        await db.execute(
            delete(Appointment)
        )

        await db.commit()

        # ====================================================
        # DATE SETUP
        # ====================================================

        today = date.today()

        yesterday = today - timedelta(days=1)
        two_days_ago = today - timedelta(days=2)
        tomorrow = today + timedelta(days=1)

        # ====================================================
        # HELPER FUNCTION
        # ====================================================

        def get_user(index):

            return users[
                index % len(users)
            ]

        # ====================================================
        # CREATE HISTORICAL APPOINTMENTS
        #
        # IDs 1-27
        # ====================================================

        print(
            "\nCreating historical records..."
        )

        history_data = [

            (
                1,
                two_days_ago,
                time(9, 0),
                "COMPLETED",
                "COMPLETED"
            ),

            (
                2,
                two_days_ago,
                time(9, 30),
                "COMPLETED",
                "COMPLETED"
            ),

            (
                3,
                two_days_ago,
                time(10, 0),
                "COMPLETED",
                "COMPLETED"
            ),

            (
                4,
                yesterday,
                time(9, 0),
                "COMPLETED",
                "COMPLETED"
            ),

            (
                5,
                yesterday,
                time(9, 30),
                "COMPLETED",
                "COMPLETED"
            ),

            (
                6,
                yesterday,
                time(10, 0),
                "COMPLETED",
                "COMPLETED"
            ),

            (
                7,
                yesterday,
                time(10, 30),
                "COMPLETED",
                "COMPLETED"
            ),

            (
                8,
                yesterday,
                time(11, 0),
                "COMPLETED",
                "COMPLETED"
            ),

            (
                9,
                yesterday,
                time(11, 30),
                "EXPIRED",
                "EXPIRED"
            ),

            (
                10,
                yesterday,
                time(12, 0),
                "CANCELLED",
                "CANCELLED"
            ),

        ]

        # Fill IDs 11-27 as completed history

        for number in range(11, 28):

            history_data.append(

                (
                    number,
                    two_days_ago,
                    time(
                        8 + ((number - 11) % 8),
                        0
                    ),
                    "COMPLETED",
                    "COMPLETED"
                )
            )

        for number, appointment_day, appointment_time, status, token_status in history_data:

            user = get_user(
                number
            )

            token_id = str(
                uuid4()
            )

            appointment = Appointment(

                appointment_id=number,

                user_id=user.user_id,

                token_id=token_id,

                purpose="General Consultation",

                appointment_date=appointment_day,

                appointment_time=appointment_time,

                status=status,

                created_at=datetime.now()
            )

            token = Token(

                token_id=token_id,

                user_id=user.user_id,

                queue_position=None,

                priority_type="NORMAL",

                token_status=token_status
            )

            db.add(
                appointment
            )

            db.add(
                token
            )

        await db.commit()

        # ====================================================
        # CURRENT ACTIVE QUEUE
        #
        # A-028 = CURRENTLY SERVING
        # ====================================================

        print(
            "Creating live queue..."
        )

        active_queue = [

            # ------------------------------------------------
            # A-028 CURRENTLY SERVING
            # ------------------------------------------------

            {
                "appointment_id": 28,
                "user": get_user(1),
                "position": 1,
                "token_status": "SERVING",
                "purpose": "General Consultation",
                "appointment_time": time(10, 0)
            },

            # ------------------------------------------------
            # A-029 WAITING
            # ------------------------------------------------

            {
                "appointment_id": 29,
                "user": get_user(2),
                "position": 2,
                "token_status": "WAITING",
                "purpose": "Document Verification",
                "appointment_time": time(10, 15)
            },

            # ------------------------------------------------
            # A-030 WAITING
            # ------------------------------------------------

            {
                "appointment_id": 30,
                "user": get_user(3),
                "position": 3,
                "token_status": "WAITING",
                "purpose": "General Consultation",
                "appointment_time": time(10, 30)
            },

            # ------------------------------------------------
            # A-031 WAITING
            # ------------------------------------------------

            {
                "appointment_id": 31,
                "user": get_user(4),
                "position": 4,
                "token_status": "WAITING",
                "purpose": "Registration Support",
                "appointment_time": time(10, 45)
            },

            # ------------------------------------------------
            # A-032 WAITING
            # ------------------------------------------------

            {
                "appointment_id": 32,
                "user": get_user(5),
                "position": 5,
                "token_status": "WAITING",
                "purpose": "General Consultation",
                "appointment_time": time(11, 0)
            },

            # ------------------------------------------------
            # A-033 WAITING
            # ------------------------------------------------

            {
                "appointment_id": 33,
                "user": get_user(6),
                "position": 6,
                "token_status": "WAITING",
                "purpose": "Document Verification",
                "appointment_time": time(11, 15)
            },

            # ------------------------------------------------
            # A-034 WAITING
            # ------------------------------------------------

            {
                "appointment_id": 34,
                "user": get_user(7),
                "position": 7,
                "token_status": "WAITING",
                "purpose": "General Consultation",
                "appointment_time": time(11, 30)
            },

            # ------------------------------------------------
            # A-035 = MAIN USER
            #
            # Your active token
            # 6 people ahead
            # ------------------------------------------------

            {
                "appointment_id": 35,
                "user": main_user,
                "position": 8,
                "token_status": "WAITING",
                "purpose": "Document Verification",
                "appointment_time": time(11, 45)
            }

        ]

        for item in active_queue:

            token_id = str(
                uuid4()
            )

            appointment = Appointment(

                appointment_id=item[
                    "appointment_id"
                ],

                user_id=item[
                    "user"
                ].user_id,

                token_id=token_id,

                purpose=item[
                    "purpose"
                ],

                appointment_date=today,

                appointment_time=item[
                    "appointment_time"
                ],

                status="PENDING",

                created_at=datetime.now()
            )

            token = Token(

                token_id=token_id,

                user_id=item[
                    "user"
                ].user_id,

                queue_position=item[
                    "position"
                ],

                priority_type="NORMAL",

                token_status=item[
                    "token_status"
                ]
            )

            db.add(
                appointment
            )

            db.add(
                token
            )

        await db.commit()

        # ====================================================
        # FUTURE APPOINTMENT
        #
        # Not in current queue
        # ====================================================

        future_token_id = str(
            uuid4()
        )

        future_appointment = Appointment(

            appointment_id=36,

            user_id=main_user.user_id,

            token_id=future_token_id,

            purpose="Follow-up Consultation",

            appointment_date=tomorrow,

            appointment_time=time(14, 0),

            status="PENDING",

            created_at=datetime.now()
        )

        future_token = Token(

            token_id=future_token_id,

            user_id=main_user.user_id,

            queue_position=None,

            priority_type="NORMAL",

            token_status="UPCOMING"
        )

        db.add(
            future_appointment
        )

        db.add(
            future_token
        )

        await db.commit()

        # ====================================================
        # FINAL OUTPUT
        # ====================================================

        print("\n========================================")

        print(
            "DATABASE SEEDED SUCCESSFULLY"
        )

        print("========================================")

        print(
            "CURRENTLY SERVING: A-028"
        )

        print(
            "QUEUE POSITIONS:"
        )

        print(
            "1 -> A-028 SERVING"
        )

        print(
            "2 -> A-029 WAITING"
        )

        print(
            "3 -> A-030 WAITING"
        )

        print(
            "4 -> A-031 WAITING"
        )

        print(
            "5 -> A-032 WAITING"
        )

        print(
            "6 -> A-033 WAITING"
        )

        print(
            "7 -> A-034 WAITING"
        )

        print(
            "8 -> A-035 YOUR TOKEN"
        )

        print("")

        print(
            "MAIN USER VALUES:"
        )

        print(
            "Your Token = A-035"
        )

        print(
            "People Ahead = 6"
        )

        print(
            "Estimated Wait = 18 min"
        )

        print(
            "Current Waiting Queue = 7"
        )

        print(
            "Crowd Level = Low"
        )

        print("========================================\n")

    await engine.dispose()


if __name__ == "__main__":

    asyncio.run(
        seed_database()
    )
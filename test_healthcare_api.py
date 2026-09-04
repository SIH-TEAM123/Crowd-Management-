"""
End-to-End Verification Test for Authentication and Patient Report API
"""
import asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.utils.security import hash_password, create_access_token
from app.database import SessionLocal
from app.models.user import User
from sqlalchemy import select


async def run_verification():
    print("\n--- STARTING PATIENT REPORT END-TO-END VERIFICATION ---")

    # 1. Ensure user 002 password is known for login test
    async with SessionLocal() as db:
        res = await db.execute(select(User).where(User.email == "aryansahoo211@gmail.com"))
        user = res.scalar_one_or_none()
        if user:
            user.password_hash = hash_password("Vizitor@123")
            user.is_verified = True
            await db.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://127.0.0.1:8000") as client:

        # Step 1: Login
        login_res = await client.post("/auth/login", json={
            "email": "aryansahoo211@gmail.com",
            "password": "Vizitor@123"
        })
        print(f"1. Login Status: {login_res.status_code}")
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("   -> Token received successfully.")

        # Step 2: GET /auth/me
        me_res = await client.get("/auth/me", headers=headers)
        print(f"2. /auth/me Status: {me_res.status_code} | User: {me_res.json().get('email')}")
        assert me_res.status_code == 200

        # Step 3: GET /patients/profile
        profile_res = await client.get("/patients/profile", headers=headers)
        print(f"3. /patients/profile Status: {profile_res.status_code} | Name: {profile_res.json().get('full_name')}")
        assert profile_res.status_code == 200

        # Step 4: GET /patients/risk
        risk_res = await client.get("/patients/risk", headers=headers)
        print(f"4. /patients/risk Status: {risk_res.status_code} | Risk: {risk_res.json().get('risk_status')}")
        assert risk_res.status_code == 200

        # Step 5: GET /medical-records/timeline
        timeline_res = await client.get("/medical-records/timeline", headers=headers)
        timeline_data = timeline_res.json()
        print(f"5. /medical-records/timeline Status: {timeline_res.status_code} | Events: {timeline_data.get('total_timeline_events')}")
        assert timeline_res.status_code == 200

        # Step 6: GET /follow-ups/alerts
        alerts_res = await client.get("/follow-ups/alerts", headers=headers)
        alerts_data = alerts_res.json()
        print(f"6. /follow-ups/alerts Status: {alerts_res.status_code} | Alerts: {alerts_data.get('total_alerts')}")
        assert alerts_res.status_code == 200

        # Step 7: GET /chronic-disease
        chronic_res = await client.get("/chronic-disease", headers=headers)
        chronic_data = chronic_res.json()
        print(f"7. /chronic-disease Status: {chronic_res.status_code} | Records: {chronic_data.get('total_records')}")
        assert chronic_res.status_code == 200

        # Step 8: GET /maternal-child
        mc_res = await client.get("/maternal-child", headers=headers)
        mc_data = mc_res.json()
        print(f"8. /maternal-child Status: {mc_res.status_code} | Records: {mc_data.get('total_records')}")
        assert mc_res.status_code == 200

        # Step 9: POST /triage
        triage_res = await client.post("/triage", json={"symptoms": "chest pain and shortness of breath"})
        print(f"9. /triage Status: {triage_res.status_code} | Priority: {triage_res.json().get('priority')}")
        assert triage_res.status_code == 200

        # Step 10: PUT /patients/profile
        put_profile_res = await client.put("/patients/profile", headers=headers, json={
            "age": 25,
            "gender": "Male",
            "contact_number": "+91 9876543210",
            "location": "Bhubaneswar, Odisha",
            "emergency_contact": "+91 9876500000",
            "blood_group": "B+",
            "allergies": "Penicillin",
            "existing_conditions": "Mild Asthma",
            "current_medications": "Albuterol Inhaler",
            "risk_status": "NORMAL"
        })
        print(f"10. PUT /patients/profile Status: {put_profile_res.status_code}")
        assert put_profile_res.status_code == 200

    print("\n>>> ALL 10 PATIENT REPORT ENDPOINTS PASSED VERIFICATION WITH 200 OK! <<<\n")


if __name__ == "__main__":
    asyncio.run(run_verification())

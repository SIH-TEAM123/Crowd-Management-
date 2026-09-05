"""Integration and API unit tests for CameraStreamService and /api/camera routes."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.routes.camera import router as camera_router
from app.services.camera_stream_service import camera_stream_service


@pytest.fixture(scope="module")
def client():
    test_app = FastAPI()
    test_app.include_router(camera_router)
    with TestClient(test_app) as test_client:
        yield test_client


def test_camera_status_endpoint(client):
    response = client.get("/api/camera/status")
    assert response.status_code == 200
    data = response.json()
    assert "is_running" in data
    assert "people_count" in data
    assert "raw_count" in data
    assert "active_tracks" in data
    assert "roi_enabled" in data
    assert "privacy" in data
    assert data["privacy"]["biometrics_stored"] is False


def test_camera_snapshot_standby(client):
    response = client.get("/api/camera/snapshot")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert len(response.content) > 0


def test_camera_toggle_roi_endpoint(client):
    initial = client.get("/api/camera/status").json()["roi_enabled"]
    response = client.post("/api/camera/toggle-roi")
    assert response.status_code == 200
    new_state = response.json()["roi_enabled"]
    assert new_state != initial
    # Toggle back
    client.post("/api/camera/toggle-roi")


def test_camera_start_and_stop_simulation(client):
    start_resp = client.post(
        "/api/camera/start",
        json={
            "source_mode": "simulation",
            "facility_id": "FAC_ANGUL_DH",
            "camera_id": "CV_TEST_CAM",
            "roi_enabled": False,
        },
    )
    assert start_resp.status_code == 200
    status = start_resp.json()
    assert status["is_running"] is True
    assert status["source_mode"] == "simulation"

    # Verify telemetry sync endpoint
    sync_resp = client.post("/api/camera/sync-telemetry")
    assert sync_resp.status_code == 200
    sync_data = sync_resp.json()
    assert sync_data["synced"] is True
    assert sync_data["facility_id"] == "FAC_ANGUL_DH"

    # Stop camera
    stop_resp = client.post("/api/camera/stop")
    assert stop_resp.status_code == 200
    assert stop_resp.json()["is_running"] is False

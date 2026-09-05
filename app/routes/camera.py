"""FastAPI Route Handlers for Live Computer Vision Crowd Sensing.

Provides endpoints for real-time MJPEG camera streaming, pipeline control,
ROI spatial filtering, and telemetry synchronization to facility operational state.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.camera_stream_service import camera_stream_service

router = APIRouter(prefix="/api/camera", tags=["Computer Vision Crowd Sensing"])


class CameraStartRequest(BaseModel):
    source_mode: str = Field("webcam", description="'webcam' or 'simulation'")
    camera_index: int = Field(0, description="VideoCapture device index (default 0)")
    facility_id: str = Field("FAC_ANGUL_DH", description="Target facility identifier")
    camera_id: str = Field("CV_CAM_01", description="Camera sensor identifier")
    roi_enabled: bool = Field(False, description="Enable Region of Interest spatial filter")


class ModeChangeRequest(BaseModel):
    mode: str = Field(..., description="'webcam' or 'simulation'")


@router.get("/status", summary="Get live camera sensing status and telemetry")
def get_camera_status() -> Dict[str, Any]:
    """Retrieve current operational status, crowd counts, active tracks, and FPS."""
    return camera_stream_service.get_status()


@router.post("/start", summary="Start live computer vision sensing")
def start_camera(request: Optional[CameraStartRequest] = None) -> Dict[str, Any]:
    """Start background camera capture and YOLO person detection pipeline."""
    req = request or CameraStartRequest()
    return camera_stream_service.start(
        source_mode=req.source_mode,
        camera_index=req.camera_index,
        facility_id=req.facility_id,
        camera_id=req.camera_id,
        roi_enabled=req.roi_enabled,
    )


@router.post("/stop", summary="Stop live computer vision sensing")
def stop_camera() -> Dict[str, Any]:
    """Stop camera capture and release webcam hardware resources."""
    return camera_stream_service.stop()


@router.post("/toggle-roi", summary="Toggle Region of Interest (ROI) filtering")
def toggle_roi() -> Dict[str, Any]:
    """Toggle ROI spatial boundary filter on/off."""
    return camera_stream_service.toggle_roi()


@router.post("/mode", summary="Switch camera source mode")
def set_camera_mode(request: ModeChangeRequest) -> Dict[str, Any]:
    """Switch pipeline input between physical 'webcam' and demo 'simulation'."""
    try:
        return camera_stream_service.set_source_mode(request.mode)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))


@router.post("/sync-telemetry", summary="Synchronize current camera count to facility state")
def sync_telemetry() -> Dict[str, Any]:
    """Push the latest smoothed camera count into the facility operational state registry."""
    return camera_stream_service.sync_telemetry_now()


@router.get("/snapshot", summary="Capture a single JPEG frame")
def get_snapshot():
    """Return a single annotated JPEG frame."""
    jpeg_bytes = camera_stream_service.get_latest_jpeg()
    if not jpeg_bytes:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Camera stream unavailable",
        )
    return Response(content=jpeg_bytes, media_type="image/jpeg")


@router.get("/stream", summary="Live MJPEG video stream with detection overlays")
def stream_camera():
    """Multipart MJPEG video stream for HTML <img src='/api/camera/stream'> elements."""

    def frame_generator():
        while True:
            frame_bytes = camera_stream_service.get_latest_jpeg()
            if frame_bytes:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
                )
            # ~16 FPS throttle for web streaming
            time.sleep(0.06)

    return StreamingResponse(
        frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )

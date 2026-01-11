from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import cv2
import mediapipe as mp
import numpy as np
from collections import deque
import time
from io import BytesIO
from typing import Optional
import base64
import f

app = FastAPI()

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Add your Next.js ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global tracking instances
finger_tracker = FingerTracker(queue+len=10)
position_tracker = None


@app.on_event("startup")
async def startup_event():
    """Initialize trackers on startup"""
    global finger_tracker, position_tracker
    finger_tracker = FingerTracker(queue_len=10)
    position_tracker = PositionTracker()


@app.get("/")
async def root():
    return {"status": "Hand Tracking API is running"}


@app.post("/api/finger-track")
async def finger_track(file: UploadFile = File(...)):
    """
    Endpoint for swipe detection
    Accepts an image and returns swipe direction
    Returns: {"swipe": 0|1|2}  # 0=none, 1=right, 2=left
    """
    global finger_tracker
    
    try:
        contents = await file.read()
        swipe = finger_tracker.process_frame(contents)
        
        return JSONResponse({
            "swipe": swipe,
            "direction": "right" if swipe == 1 else "left" if swipe == 2 else "none"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")


@app.post("/api/view-adjust/update")
async def view_adjust_update(file: UploadFile = File(...)):
    """
    Endpoint to update position tracker with new frame
    Accepts an image and updates internal position state
    Returns: {"x_frac": float, "y_frac": float}
    """
    global position_tracker
    
    try:
        contents = await file.read()
        x_frac, y_frac = position_tracker.update_position(contents)
        
        return JSONResponse({
            "x_frac": x_frac,
            "y_frac": y_frac
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")


@app.get("/api/view-adjust")
async def view_adjust_get():
    """
    Endpoint to get current position without sending a new frame
    Returns: {"x_frac": float, "y_frac": float}
    """
    global position_tracker
    
    x_frac, y_frac = position_tracker.get_position()
    
    return JSONResponse({
        "x_frac": x_frac,
        "y_frac": y_frac
    })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
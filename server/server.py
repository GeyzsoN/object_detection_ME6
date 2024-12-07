import argparse
import asyncio
import json
import logging
import os
import ssl
import uuid

import cv2
from aiohttp import web
from aiortc import MediaStreamTrack, RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaBlackhole, MediaPlayer, MediaRecorder, MediaRelay
from av import VideoFrame

from ultralytics import YOLO, FastSAM
from matplotlib import pyplot as plt


import numpy as np

import time

ROOT = os.path.dirname(__file__)

logger = logging.getLogger("pc")
pcs = set()
relay = MediaRelay()

from aiohttp import web
from aiohttp.web_middlewares import middleware

active_tracks = []
from collections import deque
import time
import cv2

import aiohttp_cors

lowlight_or_normal = "normal"
class VideoTransformTrack(MediaStreamTrack):
    """
    A video stream track that transforms frames from another track.
    """

    kind = "video"

    def __init__(self, track, transform):
        super().__init__() 
        self.track = track
        self.transform = transform
        self.confidence = 0.6
        
        self.fps_deque = deque(maxlen=30)  
        self.last_frame_time = None  
        
        active_tracks.append(self) 
        self.frame_queue = asyncio.Queue(maxsize=1)  

        
        self.processing_task = asyncio.create_task(self.process_frames())


    async def process_frames(self):
        """
        Continuously process frames from the track and enqueue them.
        """
        global lowlight_or_normal
        last_update_time = time.time()  
        overlay_fps = 0  
        avg_overlay_fps = 0  
        latency_overlay = 0  
        last_latency_update_time = time.time()  
        mean_intensity = 0
        
        def is_low_light(frame, threshold_lower=50, threshold_upper=128):
            gray_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            mean_intensity = np.mean(gray_frame)
            if mean_intensity < threshold_lower:
                return "low", mean_intensity
            elif mean_intensity > threshold_upper:
                return "normal", mean_intensity
            return "undetermined", mean_intensity  # Edge case for in-between

            

        while True:
            try:
                frame = await self.track.recv()
                
                # Get light condition and mean intensity
                lowlight_or_normal, mean_intensity = is_low_light(
                    frame.to_ndarray(format="bgr24")
                )

                current_time = time.time()
                if self.last_frame_time is not None:
                    fps = 1 / (current_time - self.last_frame_time)
                    frame_latency = (current_time - self.last_frame_time) * 1000
                    self.fps_deque.append(fps)  
                else:
                    fps = 0  
                    frame_latency = 0
                
                self.last_frame_time = current_time
                
                
                if current_time - last_update_time >= 0.25:
                    overlay_fps = fps
                    avg_overlay_fps = sum(self.fps_deque) / len(self.fps_deque) if self.fps_deque else 0
                    last_update_time = current_time
                    
                    logger.info(f"FPS: {overlay_fps:.2f}, AvgFPS: {avg_overlay_fps:.2f}")


                
                if current_time - last_latency_update_time >= 1.0:
                    latency_overlay = frame_latency
                    last_latency_update_time = current_time

                    logger.info(f"Ping (Latency): {latency_overlay:.0f} ms")
                
                original_img = frame.to_ndarray(format="bgr24")
                
                # flip image
                original_img = cv2.flip(original_img, 1)
                
                
                if self.transform == "bounding_box":
                    result = obb_model.predict(original_img, conf=self.confidence, agnostic_nms=True, iou=0.7)
                elif self.transform == "segmentation":
                    result = segment_model.predict(original_img, conf=self.confidence, agnostic_nms=True, iou=0.7)

                annotated_img = result[0].cuda().plot()

                
                
                frame_height, frame_width, _ = annotated_img.shape
                scaling_factor = frame_height / 720  
                
                
                font_scale = 1 * scaling_factor  
                line_height = int(30 * scaling_factor)  

                
                fps_text_lines = [
                    f"FPS: {overlay_fps:.2f}",
                    f"Avg: {avg_overlay_fps:.2f}",
                    f"Ping: {latency_overlay:.0f} ms",
                    # f"Is Low Light: {lowlight_or_normal}",
                    # f"Mean Intensity: {mean_intensity:.2f}",
                ]

                y = int(30 * scaling_factor)  

                for i, line in enumerate(fps_text_lines):
                    cv2.putText(annotated_img, line, (10, y + i * line_height), 
                                cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 255, 255), 2)

                
                new_frame = VideoFrame.from_ndarray(annotated_img, format="bgr24")
                new_frame.pts = frame.pts  
                new_frame.time_base = frame.time_base  
                
                
                if self.frame_queue.full():
                    _ = await self.frame_queue.get()  
                await self.frame_queue.put(new_frame)

            except asyncio.CancelledError:
                break  
            except Exception as e:
                logger.error(f"Error processing frame: {e}")
                if self.frame_queue.full():
                    _ = await self.frame_queue.get()  
                await self.frame_queue.put(frame)
                continue



    async def recv(self):
        """
        Dequeue the next processed frame for the client.
        """
        
        return await self.frame_queue.get()

    async def stop(self):
        """
        Stop processing frames and clean up resources.
        """
        self.running = False
        self.processing_task.cancel()  
        try:
            await self.processing_task  
        except asyncio.CancelledError:
            pass


async def change_confidence(request):
    """
    Endpoint to change the transform applied to the frames.
    """
    global active_tracks
    try:
        params = await request.json()
        new_confidence = float(params.get("confidence"))/100
        
        if new_confidence is None:
            return web.Response(
                status=400, text=json.dumps({"error": "Missing 'confidence' parameter"})
            )

        
        for track in active_tracks:
            track.confidence = new_confidence

        return web.Response(
            status=200, text=json.dumps({"message": f"Confidence updated to '{new_confidence}'"})
        )
    except Exception as e:
        return web.Response(
            status=500, text=json.dumps({"error": f"Failed to update confidence: {str(e)}"})
        )


async def change_transform(request):
    """
    Endpoint to change the transform applied to the frames.
    """
    global active_tracks
    try:
        params = await request.json()
        new_transform = params.get("transform")
        
        if new_transform is None:
            return web.Response(
                status=400, text=json.dumps({"error": "Missing 'transform' parameter"})
            )

        
        for track in active_tracks:
            track.transform = new_transform

        return web.Response(
            status=200, text=json.dumps({"message": f"Transform updated to '{new_transform}'"})
        )
    except Exception as e:
        return web.Response(
            status=500, text=json.dumps({"error": f"Failed to update transform: {str(e)}"})
        )


async def index(request):
    content = open(os.path.join(ROOT, "index.html"), "r").read()
    return web.Response(content_type="text/html", text=content)


async def javascript(request):
    content = open(os.path.join(ROOT, "client.js"), "r").read()
    return web.Response(content_type="application/javascript", text=content)


async def offer(request):
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    pc = RTCPeerConnection()
    pc_id = "PeerConnection(%s)" % uuid.uuid4()
    pcs.add(pc)

    def log_info(msg, *args):
        logger.info(pc_id + " " + msg, *args)

    log_info("Created for %s", request.remote)

    
    
    if args.record_to:
        recorder = MediaRecorder(args.record_to)
    else:
        recorder = MediaBlackhole()

    @pc.on("datachannel")
    def on_datachannel(channel):
        @channel.on("message")
        def on_message(message):
            if isinstance(message, str) and message.startswith("ping"):
                channel.send("pong" + message[4:])
            
            if isinstance(message, str) and (lowlight_or_normal == "normal"):
                if lowlight_or_normal == "normal":
                    channel.send("normal")
            if isinstance(message, str) and (lowlight_or_normal == "low"):
                if lowlight_or_normal == "low":
                    channel.send("low")
            
    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        log_info("Connection state is %s", pc.connectionState)
        if pc.connectionState == "failed":
            await pc.close()
            pcs.discard(pc)

    @pc.on("track")
    def on_track(track):
        log_info("Track %s received", track.kind)

        if track.kind == "audio":
            
            
            pass
        elif track.kind == "video":
            pc.addTrack(
                VideoTransformTrack(
                    relay.subscribe(track), transform=params["video_transform"]
                )
            )
            if args.record_to:
                recorder.addTrack(relay.subscribe(track))

        @track.on("ended")
        async def on_ended():
            log_info("Track %s ended", track.kind)
            await recorder.stop()

    
    await pc.setRemoteDescription(offer)
    await recorder.start()

    
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return web.Response(
        content_type="application/json",
        text=json.dumps(
            {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}
        ),
    )


async def on_shutdown(app):
    
    coros = [pc.close() for pc in pcs]
    await asyncio.gather(*coros)
    pcs.clear()


if __name__ == "__main__":
    
    # obb_model = YOLO('/data/students/geyzson/MEX/MEX6/training/hail_mary/runs/obb/train4/weights/best.engine', task='obb')
    # segment_model = YOLO('/data/students/geyzson/MEX/MEX6/training/hail_mary/runs/segment/train9/weights/best.engine', task='segment')
    obb_model = YOLO('models/latest/obb/best.engine', task='obb')
    segment_model = YOLO('models/latest/segment/best.engine', task='segment')
    
    cuda = 'cuda:1'
    
    folder_path = 'sample'
    
    filenames = os.listdir(folder_path)
    
    # for filename in filenames:
    #     pred = obb_model.predict(f'{folder_path}/{filename}', device=cuda)
    #     pred = segment_model.predict(f'{folder_path}/{filename}', device=cuda)
    
    parser = argparse.ArgumentParser(
        description="WebRTC audio / video / data-channels demo"
    )
    parser.add_argument("--cert-file", help="SSL certificate file (for HTTPS)")
    parser.add_argument("--key-file", help="SSL key file (for HTTPS)")
    parser.add_argument(
        "--host", default="0.0.0.0", help="Host for HTTP server (default: 0.0.0.0)"
    )
    parser.add_argument(
        "--port", type=int, default=1123, help="Port for HTTP server (default: 1123)"
    )
    parser.add_argument("--record-to", help="Write received media to a file.")
    parser.add_argument("--verbose", "-v", action="count")
    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(
            level=logging.DEBUG,
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            handlers=[
                logging.FileHandler("webrtc.log"),  # Logs to file
                logging.StreamHandler()  # Logs to console
            ]
        )
    else:
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            handlers=[
                logging.FileHandler("webrtc.log"),  # Logs to file
                logging.StreamHandler()  # Logs to console
            ]
        )


    if args.cert_file:
        ssl_context = ssl.SSLContext()
        ssl_context.load_cert_chain(args.cert_file, args.key_file)
    else:
        ssl_context = None

    app = web.Application()
    app.on_shutdown.append(on_shutdown)
    app.router.add_get("/", index)
    app.router.add_get("/client.js", javascript)
    app.router.add_post("/offer", offer)
    app.router.add_post("/change_transform", change_transform)
    app.router.add_post("/change_confidence", change_confidence)
    
    # Configure CORS
    cors = aiohttp_cors.setup(app, defaults={
        "*": aiohttp_cors.ResourceOptions(
            allow_credentials=True,
            expose_headers="*",
            allow_headers="*",
        )
    })
    
    # Apply CORS to all routes
    for route in app.router.routes():
        cors.add(route)
    
    web.run_app(
        app, access_log=None, host=args.host, port=args.port, ssl_context=ssl_context
    )
import { useState, useRef, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "./components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PGTopBar from "./components/topbar";
import PGSideBar from "./components/sidebar";

import { Play, OctagonX } from "lucide-react";
import { Shapes, ScanEye } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

function App() {
  const { setTheme } = useTheme();

  const [useDataChannel, setUseDataChannel] = useState(true);
  const [useAudio, setUseAudio] = useState(true);
  const [useVideo, setUseVideo] = useState(true);
  const [useSTUN, setUseSTUN] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState("light");
  const [selectedVideoResolution, setSelectedVideoResolution] =
    useState("640x480");

  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const dcRef = useRef(null);
  const pcRef = useRef(null);
  const dcInterval = useRef(null);

  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);

  const [selectedAudioDevice, setSelectedAudioDevice] = useState(null);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState(null);

  const [transform, setTransform] = useState("bounding_box");
  const [confidence, setConfidence] = useState(50);

  const change_transform = async (transform) => {
    try {
      const response = await fetch("http://localhost:1123/change_transform", {
        body: JSON.stringify({
          transform: transform,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error updating transform:", errorData);
      } else {
        const data = await response.json();
        console.log("Transform updated successfully:", data.message);
        if (transform == "bounding_box") {
          setTransform("bounding_box");
        } else if (transform == "segmentation") {
          setTransform("segmentation");
        }
      }
    } catch (error) {
      console.error("Network or server error:", error);
    }
  };

  const change_confidence = async (confidence) => {
    setConfidence(confidence);
    try {
      const response = await fetch("http://localhost:1123/change_confidence", {
        body: JSON.stringify({
          confidence: confidence,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error updating confidence:", errorData);
      } else {
        const data = await response.json();
        console.log("Confidence updated successfully:", data.message);
        // document.getElementById("confidence-text").textContent = confidence;
      }
    } catch (error) {
      console.error("Network or server error:", error);
    }
  };

  const createPeerConnection = () => {
    var config = {
      sdpSemantics: "unified-plan",
      iceCandidatePoolSize: 0,
    };

    if (useSTUN) {
      config.iceServers = [
        { urls: "stun:stun.l.google.com:19302" },
      ];

      config.iceTransportPolicy = "all";
      // config.iceCandidatePoolSize = 50;
    }

    pcRef.current = new RTCPeerConnection(config);

    pcRef.current.addEventListener(
      "icegatheringstatechange",
      () => {
        console.log("iceGatheringLog ->", pcRef.current.iceGatheringState);
      },
      false
    );
    console.log("iceGatheringLog", pcRef.current.iceGatheringState);

    pcRef.current.addEventListener(
      "iceconnectionstatechange",
      () => {
        console.log("iceConnectionLog ->", pcRef.current.iceConnectionState);
      },
      false
    );
    console.log("iceConnectionLog", pcRef.current.iceConnectionState);

    pcRef.current.addEventListener(
      "signalingstatechange",
      () => {
        console.log("signalingLog ->", pcRef.current.signalingState);
      },
      false
    );
    console.log("signalingLog", pcRef.current.signalingState);

    pcRef.current.addEventListener("track", (evt) => {
      if (evt.track.kind == "video")
        videoRef.current.srcObject = evt.streams[0];
      else audioRef.current.srcObject = evt.streams[0];
    });

    return pcRef.current;
  };

  const enumerateInputDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      // Filter and set audio and video devices in state
      setAudioDevices(devices.filter((device) => device.kind === "audioinput"));
      setVideoDevices(devices.filter((device) => device.kind === "videoinput"));
    } catch (e) {
      alert(e.message);
    }
  };

  const negotiate = () => {
    return pcRef.current
      .createOffer()
      .then((offer) => {
        return pcRef.current.setLocalDescription(offer);
      })
      .then(() => {
        return new Promise((resolve) => {
          if (pcRef.current.iceGatheringState === "complete") {
            resolve();
          } else {
            function checkState() {
              if (pcRef.current.iceGatheringState === "complete") {
                pcRef.current.removeEventListener(
                  "icegatheringstatechange",
                  checkState
                );
                resolve();
              }
            }
            pcRef.current.addEventListener(
              "icegatheringstatechange",
              checkState
            );
          }
        });
      })
      .then(() => {
        var offer = pcRef.current.localDescription;

        return fetch("http://localhost:1123/offer", {
          body: JSON.stringify({
            sdp: offer.sdp,
            type: offer.type,
            video_transform: "bounding_box",
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
      })
      .then((response) => {
        return response.json();
      })
      .then((answer) => {
        return pcRef.current.setRemoteDescription(answer);
      })
      .catch((e) => {
        alert(e);
      });
  };

  const start = () => {
    // document.getElementById("start").style.display = "none";

    pcRef.current = createPeerConnection();

    var time_start = null;

    const current_stamp = () => {
      if (time_start === null) {
        time_start = new Date().getTime();
        return 0;
      } else {
        return new Date().getTime() - time_start;
      }
    };

    var dataChannelSettings = { ordered: true };
    console.log(dataChannelSettings);
    dataChannelSettings = JSON.stringify(dataChannelSettings);

    var parameters = JSON.parse(dataChannelSettings);

    dcRef.current = pcRef.current.createDataChannel("chat", parameters);
    dcRef.current.addEventListener("close", () => {
      clearInterval(dcInterval.current);
      console.log("Data channel is closed");
    });
    dcRef.current.addEventListener("open", () => {
      console.log("Data channel is open");
      dcInterval.current = setInterval(() => {
        var message = "ping " + current_stamp();

        dcRef.current.send(message);
      }, 1000);
    });
    dcRef.current.addEventListener("message", (evt) => {
      // console.log("Data channel received message:", evt.data);
      if (evt.data.substring(0, 3) === "low") {
        console.log("Low light detected");
        setTheme("light");
      }
      if (evt.data.substring(0, 6) === "normal") {
        console.log("Normal light detected");
        setTheme("dark");
      }
      if (evt.data.substring(0, 4) === "pong") {
        var elapsed_ms = current_stamp() - parseInt(evt.data.substring(5), 10);
        console.log("RTT " + elapsed_ms + " ms");
      }
    });

    const constraints = {
      audio: false,
      video: false,
    };

    if (useVideo) {
      const videoConstraints = {};

      // const device = videoDevices[0].deviceId;
      // const device = selectedVideoDevice;
      if (selectedVideoDevice) {
        videoConstraints.deviceId = { exact: selectedVideoDevice };
      }

      const resolution = selectedVideoResolution;
      if (resolution) {
        const dimensions = resolution.split("x");
        // videoConstraints.width = parseInt(dimensions[0], 0);
        // videoConstraints.height = parseInt(dimensions[1], 0);
        videoConstraints.width = {
          ideal: parseInt(dimensions[0], 0),
          // min: 640, // Set your minimum width here
          // max: 1280, // Set your maximum width here
        };
        videoConstraints.height = {
          ideal: parseInt(dimensions[1], 0),
          // min: 640, // Set your minimum height here
          // max: 1280, // Set your maximum height here
        };
      }

      // videoConstraints.frameRate = {
      //   ideal: 60,
      //   min: 15,
      // };

      constraints.video = Object.keys(videoConstraints).length
        ? videoConstraints
        : true;
    }

    if (constraints.audio || constraints.video) {
      if (constraints.video) {
        // document.getElementById("media").style.display = "block";
        console.log("Requesting media:", constraints);
      }
      navigator.mediaDevices.getUserMedia(constraints).then(
        (stream) => {
          stream.getTracks().forEach((track) => {
            pcRef.current.addTrack(track, stream);
          });
          return negotiate();
        },
        (err) => {
          alert("Could not acquire media: " + err);
        }
      );
    } else {
      negotiate();
    }
  };

  const stop = () => {
    if (dcRef.current) {
      dcRef.current.close();
    }

    if (pcRef.current.getTransceivers) {
      pcRef.current.getTransceivers().forEach((transceiver) => {
        if (transceiver.stop) {
          transceiver.stop();
        }
      });
    }

    pcRef.current.getSenders().forEach((sender) => {
      sender.track.stop();
    });

    setTimeout(() => {
      pcRef.current.close();
    }, 500);
  };

  useEffect(() => {
    console.clear();
    console.log("useDataChannel", useDataChannel);
    console.log("useAudio", useAudio);
    console.log("useVideo", useVideo);
    console.log("useSTUN", useSTUN);
    console.log("Selected Theme:", selectedTheme);
    console.log("Selected Video Resolution:", selectedVideoResolution);
  }, [
    useDataChannel,
    useAudio,
    useVideo,
    useSTUN,
    selectedTheme,
    selectedVideoResolution,
  ]);

  useEffect(() => {
    enumerateInputDevices();
  }, []);

  useEffect(() => {
    console.log("audioDevices", audioDevices);
    console.log("videoDevices", videoDevices);
  }, [audioDevices, videoDevices]);

  return (
    <>
      <div className="h-screen w-screen flex flex-col dark:bg-stone-950 bg-white">
        <PGTopBar />
        <div className="flex-grow flex flex-row">
          <div className="min-w-56 flex flex-col flew-grow h-full">
            <PGSideBar />
            <div className="flex-grow"></div>
          </div>
          <div className="flex-grow flex flex-col dark:bg-stone-900 bg-white rounded-md me-2 mb-2 mt-2 border dark:border-stone-800 border-stone-200">
            <div className="grid grid-cols-12 flex-grow">
              <div className="p-8 col-span-9">
                <div className="flex flex-col items-center">
                  <Tabs
                    defaultValue="detect"
                    className="w-[400px] dark:hover:drop-shadow-[0_4px_10px_rgba(0,0,0,0.25)] hover:drop-shadow-[0_4px_4px_rgba(0,0,0,0.10)]"
                  >
                    <TabsList className="grid w-full grid-cols-2 dark:bg-stone-700 bg-stone-300">
                      <TabsTrigger
                        value="detect"
                        className="gap-2 hover:text-white"
                        onClick={() => change_transform("bounding_box")}
                      >
                        <ScanEye
                          size={12}
                          className={
                            transform === "bounding_box"
                              ? "dark:text-emerald-400 text-emerald-600 rotate-180 transition duration-300"
                              : "text-muted-foreground transition duration-300"
                          }
                        />
                        Detect
                      </TabsTrigger>

                      {/* Second Tab */}
                      <TabsTrigger
                        value="segment"
                        className="gap-2 hover:text-white"
                        onClick={() => change_transform("segmentation")}
                      >
                        <Shapes
                          size={12}
                          className={
                            transform === "segmentation"
                              ? "dark:text-yellow-400 text-yellow-600 transition duration-300"
                              : "text-muted-foreground rotate-180 transition duration-300"
                          }
                        />
                        Segment
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <br />
                <div className="bg--400 items-center flex flex-col">
                  <video
                    ref={videoRef}
                    id="video"
                    autoPlay
                    playsInline
                    className="w-[640px] h-[640px] dark:bg-stone-600 bg-stone-300 rounded-lg"
                  ></video>
                  <audio
                    ref={audioRef}
                    id="audio"
                    autoPlay
                    className="w-[300px] bg-green-400"
                  ></audio>
                </div>
              </div>
              <div className="col-span-3 border-s-[1px] dark:border-stone-800 border-stone-200">
                <div className="p-8">
                  <div className="items-top flex flex-col gap-4">
                    <div className=" gap-1.5 leading-none flex-row flex">
                      <Checkbox
                        id="data-channel"
                        onCheckedChange={() =>
                          setUseDataChannel((prev) => !prev)
                        }
                        checked={useDataChannel}
                      />
                      <label
                        htmlFor="data-channel"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Data Channel
                      </label>
                    </div>

                    <div className=" gap-1.5 leading-none flex-row flex">
                      <Checkbox
                        id="use-video"
                        onCheckedChange={() => setUseVideo((prev) => !prev)}
                        checked={useVideo}
                      />
                      <label
                        htmlFor="data-channel"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Use Video
                      </label>
                    </div>
                    <div className=" gap-1.5 leading-none flex-row flex">
                      <Checkbox
                        id="use-STUN"
                        onCheckedChange={() => setUseSTUN((prev) => !prev)}
                        checked={useSTUN}
                      />
                      <label
                        htmlFor="data-channel"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Use STUN
                      </label>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 p-8">
                  <Select
                    onValueChange={setSelectedVideoResolution}
                    // defaultValue="1280x1280"
                    defaultValue="2560x2560"
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Video Resolution" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* <SelectItem value="320x240">320x240</SelectItem> */}
                      {/* <SelectItem value="960x540">960x540</SelectItem>
                      <SelectItem value="1280x720">1280x720</SelectItem> */}
                      <SelectItem value="640x480">640x480</SelectItem>
                      <SelectItem value="640x640">640x640</SelectItem>
                      <SelectItem value="960x720">960x720</SelectItem>
                      <SelectItem value="1280x1280">1280x1280</SelectItem>
                      <SelectItem value="1440x1080">1440x1080</SelectItem>
                      <SelectItem value="2560x2560">2560x2560</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select onValueChange={setSelectedVideoDevice}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Video Device" />
                    </SelectTrigger>
                    <SelectContent>
                      {videoDevices.map((device) => (
                        <SelectItem
                          key={device.deviceId}
                          value={device.deviceId}
                        >
                          {device.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-8 flex flex-col w-fit gap-2">
                  <Button onClick={start} className="btn btn-primary">
                    Start
                  </Button>
                  <Button onClick={stop} className="btn btn-secondary">
                    Stop
                  </Button>
                  {/* <Button
                    onClick={() => change_transform("bounding_box")}
                    className="btn btn-primary"
                  >
                    Detect
                  </Button>
                  <Button
                    onClick={() => change_transform("segmentation")}
                    className="btn btn-primary"
                  >
                    Segment
                  </Button> */}
                </div>
                <div className="px-8 flex flex-col gap-4">
                  <label
                    htmlFor="confidence"
                    className="text-md font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex content-between justify-between w-full "
                  >
                    <span>
                    Confidence

                    </span>
                    {confidence}
                  </label>
                  <Slider
                    id="confidence"
                    defaultValue={[33]}
                    max={100}
                    step={1}
                    min={20}
                    className="w-full"
                    onValueChange={(value) => change_confidence(value[0])}
                    onValueCommit={(value) =>
                      console.log("Final value after release:", value[0])
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;

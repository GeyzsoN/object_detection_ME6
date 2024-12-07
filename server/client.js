
var dataChannelLog = document.getElementById('data-channel'),
    iceConnectionLog = document.getElementById('ice-connection-state'),
    iceGatheringLog = document.getElementById('ice-gathering-state'),
    signalingLog = document.getElementById('signaling-state');


var pc = null;


var dc = null, dcInterval = null;

async function change_transform(transform) {
    try {
        const response = await fetch('/change_transform', {
            body: JSON.stringify({
                transform: transform
            }),
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'POST'
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Error updating transform:", errorData);
        } else {
            const data = await response.json();
            console.log("Transform updated successfully:", data.message);
            if (transform == "bounding_box") {
                document.getElementById('segment').disabled = false;
                document.getElementById('detect').disabled = true;
                document.getElementById('task_name').textContent = 'Object Detection';
            } else if (transform == "segmentation") {
                document.getElementById('segment').disabled = true;
                document.getElementById('detect').disabled = false;
                document.getElementById('task_name').textContent = 'Instance Segmentation';
            }
        }
    } catch (error) {
        console.error("Network or server error:", error);
    }
}

async function change_confidence(confidence) {
    try {
        const response = await fetch('/change_confidence', {
            body: JSON.stringify({
                confidence: confidence
            }),
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'POST'
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Error updating confidence:", errorData);
        } else {
            const data = await response.json();
            console.log("Confidence updated successfully:", data.message);
            document.getElementById('confidence-text').textContent = confidence;
        }
    } catch (error) {
        console.error("Network or server error:", error);
    }
}



function createPeerConnection() {
    var config = {
        sdpSemantics: 'unified-plan',
        iceCandidatePoolSize: 50,
    };

    if (document.getElementById('use-stun').checked) {
        
        config.iceServers = [
            
            { urls: 'stun:global.stun.twilio.com:3478' }, 
            { urls: 'stun:stun.l.google.com:19302' },
            
            
            
            {
              urls: 'turn:global.turn.twilio.com:3478?transport=udp',
              username: '2cc4a84bf951ccff8e827d2a4aade2d15e5d6d2d006490830dda493f1a8f59b0',  
              credential: 'pQF8Dt3/brGJg9JxyPamTEgoVwx9grCk4Ao2j4QGbJU=',  
            },
          
            
            
            {
              urls: 'turn:global.turn.twilio.com:3478?transport=tcp',
              username: '2cc4a84bf951ccff8e827d2a4aade2d15e5d6d2d006490830dda493f1a8f59b0',  
              credential: 'pQF8Dt3/brGJg9JxyPamTEgoVwx9grCk4Ao2j4QGbJU=',  
            },
          
            
            
            {
              urls: 'turn:global.turn.twilio.com:443?transport=tcp',
              username: '2cc4a84bf951ccff8e827d2a4aade2d15e5d6d2d006490830dda493f1a8f59b0',  
              credential: 'pQF8Dt3/brGJg9JxyPamTEgoVwx9grCk4Ao2j4QGbJU=',  
            },
          ];

        
        config.iceTransportPolicy = 'all';

        config.iceCandidatePoolSize = 50;
    }

    pc = new RTCPeerConnection(config);

    
    pc.addEventListener('icegatheringstatechange', () => {
        iceGatheringLog.textContent += ' -> ' + pc.iceGatheringState;
    }, false);
    iceGatheringLog.textContent = pc.iceGatheringState;

    pc.addEventListener('iceconnectionstatechange', () => {
        iceConnectionLog.textContent += ' -> ' + pc.iceConnectionState;
    }, false);
    iceConnectionLog.textContent = pc.iceConnectionState;

    pc.addEventListener('signalingstatechange', () => {
        signalingLog.textContent += ' -> ' + pc.signalingState;
    }, false);
    signalingLog.textContent = pc.signalingState;

    
    pc.addEventListener('track', (evt) => {
        if (evt.track.kind == 'video')
            document.getElementById('video').srcObject = evt.streams[0];
        else
            document.getElementById('audio').srcObject = evt.streams[0];
    });

    return pc;
}

function enumerateInputDevices() {
    const populateSelect = (select, devices) => {
        let counter = 1;
        devices.forEach((device) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || ('Device #' + counter);
            select.appendChild(option);
            counter += 1;
        });
    };

    navigator.mediaDevices.enumerateDevices().then((devices) => {
        populateSelect(
            document.getElementById('audio-input'),
            devices.filter((device) => device.kind == 'audioinput')
        );
        populateSelect(
            document.getElementById('video-input'),
            devices.filter((device) => device.kind == 'videoinput')
        );
    }).catch((e) => {
        alert(e);
    });
}

function negotiate() {
    return pc.createOffer().then((offer) => {
        return pc.setLocalDescription(offer);
    }).then(() => {
        
        return new Promise((resolve) => {
            if (pc.iceGatheringState === 'complete') {
                resolve();
            } else {
                function checkState() {
                    if (pc.iceGatheringState === 'complete') {
                        pc.removeEventListener('icegatheringstatechange', checkState);
                        resolve();
                    }
                }
                pc.addEventListener('icegatheringstatechange', checkState);
            }
        });
    }).then(() => {
        var offer = pc.localDescription;
        var codec;

        codec = 'default';
        console.log ("audio codec: ", codec)

        if (codec !== 'default') {
            offer.sdp = sdpFilterCodec('audio', codec, offer.sdp);
        }

        codec = 'default';
        if (codec !== 'default') {
            offer.sdp = sdpFilterCodec('video', codec, offer.sdp);
        }

        
        return fetch('/offer', {
            body: JSON.stringify({
                sdp: offer.sdp,
                type: offer.type,
                video_transform: "bounding_box"
            }),
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'POST'
        });
    }).then((response) => {
        return response.json();
    }).then((answer) => {
        
        return pc.setRemoteDescription(answer);
    }).catch((e) => {
        alert(e);
    });
}

function start() {
    document.getElementById('start').style.display = 'none';

    pc = createPeerConnection();

    var time_start = null;

    const current_stamp = () => {
        if (time_start === null) {
            time_start = new Date().getTime();
            return 0;
        } else {
            return new Date().getTime() - time_start;
        }
    };


    var something = {"ordered": true}
    console.log(something)
    something = JSON.stringify(something);

    var parameters = JSON.parse(something);


    dc = pc.createDataChannel('chat', parameters);
    dc.addEventListener('close', () => {
        clearInterval(dcInterval);
        dataChannelLog.textContent += '- close\n';
    });
    dc.addEventListener('open', () => {
        dataChannelLog.textContent += '- open\n';
        dcInterval = setInterval(() => {
            var message = 'ping ' + current_stamp();
            
            dc.send(message);
        }, 1000);
    });
    dc.addEventListener('message', (evt) => {
        dataChannelLog.textContent += '< ' + evt.data + '\n';

        if (evt.data.substring(0, 4) === 'pong') {
            var elapsed_ms = current_stamp() - parseInt(evt.data.substring(5), 10);
            
            dataChannelLog.textContent = ' RTT ' + elapsed_ms + ' ms\n';
        }
    });

    

    const constraints = {
        audio: false,
        video: false
    };

    if (document.getElementById('use-audio').checked) {
        const audioConstraints = {};

        const device = document.getElementById('audio-input').value;
        if (device) {
            audioConstraints.deviceId = { exact: device };
        }

        constraints.audio = Object.keys(audioConstraints).length ? audioConstraints : true;
    }

    if (document.getElementById('use-video').checked) {
        const videoConstraints = {};

        const device = document.getElementById('video-input').value;
        if (device) {
            videoConstraints.deviceId = { exact: device };
        }

        const resolution = document.getElementById('video-resolution').value;
        if (resolution) {
            const dimensions = resolution.split('x');
            videoConstraints.width = parseInt(dimensions[0], 0);
            videoConstraints.height = parseInt(dimensions[1], 0);
        }

        constraints.video = Object.keys(videoConstraints).length ? videoConstraints : true;
    }

    

    if (constraints.audio || constraints.video) {
        if (constraints.video) {
            document.getElementById('media').style.display = 'block';
        }
        navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
            stream.getTracks().forEach((track) => {
                pc.addTrack(track, stream);
            });
            return negotiate();
        }, (err) => {
            alert('Could not acquire media: ' + err);
        });
    } else {
        negotiate();
    }

    document.getElementById('stop').style.display = 'inline-block';
    document.getElementById('detect').disabled = true;
    document.getElementById('segment').disabled = false;
}

function stop() {
    document.getElementById('stop').style.display = 'none';
    document.getElementById('start').style.display = 'inline-block';

    document.getElementById('detect').disabled = true;
    document.getElementById('segment').disabled = true;


    
    if (dc) {
        dc.close();
    }

    
    if (pc.getTransceivers) {
        pc.getTransceivers().forEach((transceiver) => {
            if (transceiver.stop) {
                transceiver.stop();
            }
        });
    }

    
    pc.getSenders().forEach((sender) => {
        sender.track.stop();
    });

    
    setTimeout(() => {
        pc.close();
    }, 500);
}

function sdpFilterCodec(kind, codec, realSdp) {
    var allowed = []
    var rtxRegex = new RegExp('a=fmtp:(\\d+) apt=(\\d+)\r$');
    var codecRegex = new RegExp('a=rtpmap:([0-9]+) ' + escapeRegExp(codec))
    var videoRegex = new RegExp('(m=' + kind + ' .*?)( ([0-9]+))*\\s*$')

    var lines = realSdp.split('\n');

    var isKind = false;
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('m=' + kind + ' ')) {
            isKind = true;
        } else if (lines[i].startsWith('m=')) {
            isKind = false;
        }

        if (isKind) {
            var match = lines[i].match(codecRegex);
            if (match) {
                allowed.push(parseInt(match[1]));
            }

            match = lines[i].match(rtxRegex);
            if (match && allowed.includes(parseInt(match[2]))) {
                allowed.push(parseInt(match[1]));
            }
        }
    }

    var skipRegex = 'a=(fmtp|rtcp-fb|rtpmap):([0-9]+)';
    var sdp = '';

    isKind = false;
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('m=' + kind + ' ')) {
            isKind = true;
        } else if (lines[i].startsWith('m=')) {
            isKind = false;
        }

        if (isKind) {
            var skipMatch = lines[i].match(skipRegex);
            if (skipMatch && !allowed.includes(parseInt(skipMatch[2]))) {
                continue;
            } else if (lines[i].match(videoRegex)) {
                sdp += lines[i].replace(videoRegex, '$1 ' + allowed.join(' ')) + '\n';
            } else {
                sdp += lines[i] + '\n';
            }
        } else {
            sdp += lines[i] + '\n';
        }
    }

    return sdp;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
}

enumerateInputDevices();
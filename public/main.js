// public ice (stun/turn) servers
// source: https://www.avaya.com/blogs/archives/2014/08/understanding-webrtc-media-connections-ice-stun-and-turn.html
let iceServers = { iceServers: [
  {url:'stun:stun01.sipphone.com'},
  {url:'stun:stun.ekiga.net'},
  {url:'stun:stun.fwdnet.net'},
  {url:'stun:stun.ideasip.com'},
  {url:'stun:stun.iptel.org'},
  {url:'stun:stun.l.google.com:19302'},
  {url:'stun:stun1.l.google.com:19302'},
  {url:'stun:stun2.l.google.com:19302'},
  {url:'stun:stun3.l.google.com:19302'},
  {url:'stun:stun4.l.google.com:19302'},
  {url:'stun:stunserver.org'},
  {url:'stun:stun.softjoys.com'},
  {url:'stun:stun.voiparound.com'},
  {url:'stun:stun.voipbuster.com'},
  {url:'stun:stun.voipstunt.com'},
  {url:'stun:stun.voxgratia.org'},
  {url:'stun:stun.xten.com'},
  { url: 'turn:numb.viagenie.ca', credential: 'muazkh', username: 'webrtc@live.com' },
  { url: 'turn:192.158.29.39:3478?transport=udp', credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=', username: '28224511:1379330808' },
  { url: 'turn:192.158.29.39:3478?transport=tcp', credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=', username: '28224511:1379330808' }
] };

// component to get name
let IntroComponent = {
  template: `<div id='container'>
  <div id='intro-container'>
    <h1>{{ ethosGreeting }} What's your name?</h1>
    <h3>
      <input type='text' v-model='name' placeholder='Joe Schmoe' @keyup.enter='submitName' autofocus>
      <button @click='submitName'>Go!</button>
    </h3>
  </div>
</div>`,
  data() {
    return {
      name: '',
      ethosGreeting: ''
    };
  },
  methods: {
    submitName() {
      this.$emit('set-name', this.name);
    }
  },
  created() {
    let ethosGreetings = [
      'Howdy there.',
      'You look great today.',
      'Hey!',
      'Hey gorgeous.',
      'Nice to see you here.'
    ]; 
    this.ethosGreeting = ethosGreetings[Math.floor(Math.random() * ethosGreetings.length)];
  }
};

// component to get into a channel
let ChannelComponent = {
  template: `<div id='container'>
  <div id='create-channel'>
    <h3>Create a channel</h3>
    <input class='alt' type='text' placeholder='channel name' v-model='channelName' /><br>
    <input class='alt' type='text' placeholder='channel key' v-model='channelKey' @keyup.enter='createChannel' /><br>
    <button class='alt' @click='createChannel'>Create</button>
    <div id='error' v-if='error'>
      <p>{{ error }}</p>
      <button @click='error = ""'>Close</button>
    </div>
  </div>
  <div id='join-channel'>
    <h3 id='join-channel-title'>Join a channel</h3>
    <div id='channels'>
      <div v-if='channels.length == 0'>No channels found. Create one!</div>
      <div class='channel' v-for='channel in channels'>
        <h2 class='channel-name'>{{ channel.name }}</h2>
        <p class='channel-member-count'>{{ channel.memberCount }} member{{ channel.memberCount == 1 ? '' : 's' }}</p>
        <p class='channel-description'>{{ channel.description }}</p>
        <p><input type='text' placeholder='Enter key' v-model='channel.key' @keyup.enter='joinChannel(channel)'></p>
        <p><button @click='joinChannel(channel)'>Join</button></p>
      </div>
    </div>
  </div>
</div>`,
  props: {
    socket: Object
  },
  data() {
    return {
      channels: [],
      channelName: '',
      channelKey: '',
      error: ''
    };
  },
  methods: {
    joinChannel(channel) {
      this.socket.emit('joinChannel', channel.name, channel.key, success => {
        if(success) {
          channel.key = '';
          this.$emit('toggle-view');
        } else {
          this.error = 'Channel doesn\'t exist, key is incorrect, or you are already in a channel.';
        }
      });
    },
    createChannel() {
      this.socket.emit('createChannel', this.channelName, this.channelKey, success => {
        if(success) {
          this.channelName = '';
          this.channelKey = '';
          this.$emit('toggle-view');
        } else {
          this.error = 'Channel name must be between 3 and 50 characters (not including leading/trailing spaces). Channel key must be between 3 and 50 characters. Channel names must be unique (case doesn\'t matter).';
        }
      });
    }
  },
  // set socket.io listeners
  created() {
    // get initial list of channels
    this.socket.emit('_channels');

    // on channel update, update list
    this.socket.on('_channels', _channels => this.channels = _channels);
  }
};

// component when in channel
let ChatComponent = {
  template: `<div id='container'>
  <div id='channel-data'>
    <div class='group'>
      <table id='channel-data-table'>
        <tbody>
          <tr>
            <th scope='row'>Channel</th>
            <td>{{ channelData.name }}</td>
          </tr>
          <tr>
            <th scope='row'>Key</th>
            <td>{{ channelData.key }}</td>
          </tr>
          <tr>
            <th scope='row'>Description</th>
            <td>
              <textarea
                v-model='channelData.description'
                placeholder='(nothing here yet)'
                rows='3'
                maxlength='50'></textarea>
              <button
                v-if='currentDescription !== channelData.description'
                @click='updateDescription'>Update</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class='group' id='members-group'>
      <h3>Members ({{ channelData.members.length }})</h3>
      <div id='members'>
        <div class='member' v-for='member in channelData.members'>
          <span>
            {{ member.name }}
            <strong v-if='member.sid === sid'>(you)</strong>
          </span>
          <button v-if='member.sid !== sid' @click='call(member.name, member.sid)'>Call</button>
        </div>
      </div>
    </div>
    <div class='group' id='chat-group'>
      <h3>Chat</h3>
      <div id='chat'>
        <div class='message' v-if='messages.length == 0'>No messages yet.</div>
        <div class='message' :class='{ "is-author": message.sid == sid }' v-for='message in messages'>
          <div class='message-body'>{{ message.body }}</div>
          <div class='message-details'>{{ message.sid == sid ? 'You' : message.author }} | {{ message.time | timeString }}</div>
        </div>
      </div>
      <div id='message-input'>
        <input @keyup.enter='sendMessage' placeholder='Send a message...' v-model='message' />
        <button @click='sendMessage'>Send</button>
      </div>
    </div>
  </div>
  <div id='channel-media'>
    <div id='local-description'>
      <div id='local-description-text'>
        <h3>Video/Audio Calls</h3>
        <p v-if='pcs.length == 0'>No connected streams. Call someone from the &quot;Members&quot; pane on the left!</p>
      </div>
      <div id='local-description-stream'>
        <video id='stream-local' v-show='stream !== null' autoplay muted></video> 
        <div id='local-stream-options'>
          <i
            :class='[ "fas", "fa-button", "fa-video" + (streamOptions.videoStream ? "" : "-slash") ]'
            @click='streamOptions.videoStream = !streamOptions.videoStream'
            :title='"camera " + (streamOptions.videoStream ? "on" : "off")'></i>
          <i
            :class='[ "fas", "fa-button", "fa-microphone-alt" + (streamOptions.audioStream ? "" : "-slash") ]'
            @click='streamOptions.audioStream = !streamOptions.audioStream'
            :title='"microphone " + (streamOptions.audioStream ? "on" : "off")'></i>
        </div>
      </div>
    </div>
    <div id='videos'>
      <div class='video' v-for='pcObject in pcs' @mousedown='beginDrag' title='drag video'>
        <i class='fa-button far fa-user' id='video-background'></i>
        <video :id='"stream-" + pcObject.id' autoplay :muted.prop='pcObject.muted'></video>
        <div class='video-controls'>
          <div class='video-details'>
            <h1>{{ pcObject.name }}</h1>
            <p>
              <i
                :class='[ "fas", "fa-button", "fa-video" + (pcObject.hasVideo ? "" : "-slash") ]'
                :title='pcObject.name + "&#39;s camera is " + (pcObject.hasVideo ? "on" : "off")'></i>
              <i
                :class='[ "fas", "fa-button", "fa-microphone-alt" + (pcObject.hasAudio ? "" : "-slash") ]'
                :title='pcObject.name + "&#39;s microphone is " + (pcObject.hasAudio ? "on" : "off")'></i>
            </p>
          </div>
          <div class='video-control-buttons'>
            <i class='fa-button fas fa-times' @click='disconnect(pcObject)' title='end call'></i>
            <i :class='[ "fa-button", "fas", "fa-volume-" + (pcObject.muted ? "off" : "up") ]' @click='pcObject.muted = !pcObject.muted' :title='pcObject.muted ? "muted" : "not muted"'></i>
            <div class='fa-button' id='resize-handle' @mousedown='beginResize' title='resize video'>&#x1F866;</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>`,
  data() {
    return {
      // general channel variables
      channelData: { members: [] },
      currentDescription: '',
      // chat ability variables
      message: '',
      messages: [],
      // video/audio chat webrtc peer connections
      streamOptions: { videoStream: true, audioStream: true },
      stream: null,
      pcs: [],
      // resize and drag event handler
      resizeData: { handle: null, right: 0, bottom: 0 },
      dragData: { elem: null, left: 0, top: 0 }
    };
  },
  props: {
    socket: Object,
    name: String,
    sid: String
  },
  watch: {
    stream(newValue) {
      this.$el.querySelector('#stream-local').srcObject = newValue;
    },
    streamOptions: {
      // if existing streams, change them
      // if no existing streams, no change
      handler(newValue) {
        // update pc streams
        let updatePcs = () => {
          this.pcs.forEach(pcObject => {
            let pc = pcObject.pc;
            pc.getLocalStreams().forEach(localStream => {
              pc.removeStream(localStream);
            });
            pc.addStream(this.stream);

            // redo handshake
            pc.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true
            })
              .then(offer => {
                // set local description
                pc.setLocalDescription(offer);

                // ask for response from websocket
                this.socket.emit('createOffer', pcObject.sid, pcObject.id, offer, success => {
                  pc.setRemoteDescription(success);
                });
              });
              
            });
        };

        // get stream before updating pcs
        if(this.pcs.length > 0) {
          // stop current stream
          this.stream.getTracks().forEach(track => track.stop());
          // update this.stream
          if(newValue.videoStream || newValue.audioStream) {
            navigator.mediaDevices.getUserMedia({
              video: newValue.videoStream,
              audio: newValue.audioStream
            })
              .then(_stream => {
                this.stream = _stream;
                updatePcs();
              });
          } else {
            this.stream = new MediaStream();
            updatePcs();
          }
        }
      },
      deep: true
    }
  },
  methods: {
    // resize videos
    resize(event) {
      let elem = this.resizeData.handle.parentElement.parentElement;
      let elemParent = elem.parentElement;
      let elemPos = elem.getBoundingClientRect();
      elemParent.style.width = elem.style.width = (event.pageX + this.resizeData.right - elemPos.left) + 'px';
      elemParent.style.height = elem.style.height = (event.pageY + this.resizeData.bottom - elemPos.top) + 'px';
    },
    beginResize(event) {
      let handlePos = event.target.getBoundingClientRect();
      this.resizeData = {
        handle: event.target,
        right: handlePos.right - event.pageX + 32,
        bottom: handlePos.bottom - event.pageY + 32
      };
    },
    drag(event) {
      this.dragData.elem.style.left = (event.pageX - this.dragData.left) + 'px';
      this.dragData.elem.style.top = (event.pageY - this.dragData.top) + 'px';
    },
    beginDrag(event) {
      let elem = event.target;
      while(!elem.classList.contains('video')) {
        elem = elem.parentElement;
      }
      let videoPos = elem.getBoundingClientRect();
      this.dragData = {
        elem: elem,
        left: event.pageX - videoPos.left,
        top: event.pageY - videoPos.top
      };
    },
    sendMessage() {
      if(this.message.trim() !== '') {
        this.socket.emit('sendMessage', this.message.trim());
        this.message = '';
      }
    },
    updateDescription() {
      this.socket.emit('*channel.description', this.channelData.description);
    },
    disconnect(pcObject) {
      pcObject.pc.close();
    },
    call(name, sid) {
      if(this.pcs.find(pcObject => pcObject.sid === sid) !== undefined) {
        return console.log('Cannot have multiple open calls with the same person.');
      } else if(this.pcs.length > 4) {
        return console.log('Cannot have more than four open calls (for the sake of your own bandwidth).');
      }

      let pc = new RTCPeerConnection(iceServers);
      let id = Math.floor(Math.random() * 1e7);
      let pcObject = {
        pc: pc,
        name: name,
        id: id,
        sid: sid,
        stream: null,
        muted: false,
        hasAudio: false,
        hasVideo: false
      };
      this.pcs.push(pcObject);

      // handshake
      let handshake = () => {
        // begin handshake
        pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        })
          .then(offer => {
            // set local description
            pc.setLocalDescription(offer);

            // ask for response from websocket
            this.socket.emit('createOffer', sid, id, offer, success => {
              pc.setRemoteDescription(success);
            });
          });
      };

      // if no stream create stream
      if(this.stream == null) {
        if(this.streamOptions.videoStream || this.streamOptions.audioStream) {
          navigator.mediaDevices.getUserMedia({
            video: this.streamOptions.videoStream,
            audio: this.streamOptions.audioStream
          })
            .then(_stream => {
              this.stream = _stream;
              pc.addStream(_stream);

              handshake();
            });
        } else {
          this.stream = new MediaStream();
          pc.addStream(this.stream);

          handshake();
        }
      }
      // if stream exists use it
      else {
        pc.addStream(this.stream);
        handshake();
      }
      pc.onaddstream = event => {
        let stream = event.stream;
        pcObject.hasAudio = stream.getAudioTracks().length > 0;
        pcObject.hasVideo = stream.getVideoTracks().length > 0;
        this.$el.querySelector('#stream-' + id).srcObject = stream;
      };
      pc.onremovestream = event => {
        pcObject.stream = null;
        pcObject.hasAudio = false;
        pcObject.hasVideo = false;
      };
      pc.onicecandidate = event => {
        this.socket.emit('iceCandidate', sid, id, event.candidate);
      };
      pc.oniceconnectionstatechange = event => {
        if(pc.iceConnectionState == 'disconnected' || pc.iceConnectionState == 'closed') {
          this.pcs.splice(this.pcs.indexOf(pcObject), 1);
          if(this.pcs.length === 0 && this.stream !== null) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
          }
        }
      };
    }
  },
  filters: {
    timeString(time) {
      // return (h)h:mm
      return new Intl.DateTimeFormat('en-us', {
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date(time));
    }
  },
  // set up members, socket handlers, event handlers
  created() {
    // set up resize and drag handlers
    document.addEventListener('mousemove', event => {
      if(this.resizeData.handle) {
        this.resize(event);
      } else if(this.dragData.elem) {
        this.drag(event);
      }
    });
    document.addEventListener('mouseup', () => {
      if(this.resizeData.handle) {
        this.resizeData.handle = null;
      }
      if(this.dragData.elem) {
        this.dragData.elem = null;
      }
    });

    // channel data (now dynamic)
    this.socket.emit('_channelData');
    this.socket.on('_channelData', _channelData => {
      this.channelData = _channelData;
      this.currentDescription = _channelData.description;
    });

    // messages (dynamic)
    this.socket.emit('_messages');
    this.socket.on('_messages', _messages => this.messages = _messages);

    // respond to ice candidate
    let waitForLocalDescription = (pc, candidate) => {
      if(pc.localDescription.type === '') {
        setTimeout(waitForLocalDescription.bind(null, pc, candidate), 100);
      } else {
        pc.addIceCandidate(candidate);
      }
    };
    this.socket.on('icecandidate', (id, candidate) => {
      if(candidate !== null) {
        let pc = this.pcs.find(pc => pc.id === id).pc;
        waitForLocalDescription(pc, candidate);
      }
    });

    // respond to call offer
    this.socket.on('callOffer', (name, sid, id, offer, cb) => {
      let pc, pcObject;

      // check for existing pc object (for renegotiation
      let existingPcObject = this.pcs.find(pcObject => pcObject.id === id);
      if(existingPcObject === undefined) {
        if(this.pcs.find(pcObject => pcObject.sid === sid) !== undefined) {
          return console.log('Cannot have multiple open calls with the same person.');
        } else if(this.pcs.length > 4) {
          return console.log('Cannot have more than four open calls (for the sake of your own bandwidth).');
        }

        pc = new RTCPeerConnection(iceServers);
        pcObject = {
          pc: pc,
          sid: sid,
          name: name,
          id: id,
          stream: null,
          muted: false,
          hasAudio: false,
          hasVideo: false
        };
        this.pcs.push(pcObject);

        // listen for stream and ice candidates
        pc.onaddstream = event => {
          let stream = event.stream;
          pcObject.hasAudio = stream.getAudioTracks().length > 0;
          pcObject.hasVideo = stream.getVideoTracks().length > 0;
          this.$el.querySelector('#stream-' + id).srcObject = stream;
        };
        pc.onremovestream = event => {
          pcObject.stream = null;
          pcObject.hasAudio = false;
          pcObject.hasVideo = false;
        };
        pc.oniceconnectionstatechange = event => {
          if(pc.iceConnectionState == 'disconnected' || pc.iceConnectionState == 'closed') {
            this.pcs.splice(this.pcs.indexOf(pcObject), 1);
            if(this.pcs.length === 0 && this.stream !== null) {
              this.stream.getTracks().forEach(track => track.stop());
              this.stream = null;
            }
          }
        };
        pc.onicecandidate = event => {
          this.socket.emit('iceCandidate', sid, id, event.candidate);
        };
      }
      // otherwise use existing pc object
      else {
        pcObject = existingPcObject;
        pc = pcObject.pc;
      }

      // handshake
      let handshake = () => {
        // create answer
        pc.setRemoteDescription(offer);
        pc.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        })
          .then(answer => {
            pc.setLocalDescription(answer);
            cb(answer);
          });
      };

      // stream back
      // if no stream create one
      if(this.stream === null) {
        if(this.streamOptions.videoStream || this.streamOptions.audioStream) {
          navigator.mediaDevices.getUserMedia({
            video: this.streamOptions.videoStream,
            audio: this.streamOptions.audioStream
          })
            .then(_stream => {
              this.stream = _stream;
              pc.addStream(_stream);

              handshake();
            });
        } else {
          this.stream = new MediaStream();
          pc.addStream(this.stream);

          handshake();
        }
      }
      // if stream exists use it
      else {
        pc.addStream(this.stream);
        handshake();
      }
    });
  },
  // when closed close all calls
  destroyed() {
    this.pcs.forEach(pcObject => pcObject.pc.close());
  }
};

// main vue.js instance
new Vue({
  el: '#app',
  data: {
    socket: io(),
    channel: false,
    sid: '',
    name: false
  },
  methods: {
    toggleView() {
      this.channel = !this.channel;
    },
    setName(name) {
      this.name = name;
      this.socket.emit('*name', this.name, _sid => this.sid = _sid);
    },
    leaveChannel() {
      this.socket.emit('leaveChannel');
      this.toggleView();
    }
  },
  computed: {
    currentView() {
      return !this.name ? IntroComponent : (this.channel ? ChatComponent : ChannelComponent);
    }
  }
});

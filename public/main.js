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
        <div id='stream-options'>
          <p>
            Camera: <input type='checkbox' v-model='streamOptions.videoStream'>
            Microphone: <input type='checkbox' v-model='streamOptions.audioStream'>
          </p>
        </div>
      </div>
      <div id='local-description-stream'>
        <video id='stream-local' v-show='stream !== null' autoplay muted></video> 
      </div>
    </div>
    <div id='videos'>
      <div class='video' v-for='pcObject in pcs' @mousedown='beginDrag'>
        <video :id='"stream-" + pcObject.id' autoplay></video>
        <div class='video-controls'>
          <h3>{{ pcObject.name }}</h3>
          <button @click='disconnect(pcObject)'>Disconnect</button>
          <div id='resize-handle' @mousedown='beginResize'></div>
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
      streamOptions: { videoStream: true, audioStream: false },
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
      let elem = this.resizeData.handle.parentElement;
      let elemParent = elem.parentElement;
      let elemPos = elem.getBoundingClientRect();
      elemParent.style.width = elem.style.width = (event.pageX + this.resizeData.right - elemPos.left) + 'px';
      elemParent.style.height = elem.style.height = (event.pageY + this.resizeData.bottom - elemPos.top) + 'px';
    },
    beginResize(event) {
      let handlePos = event.target.getBoundingClientRect();
      this.resizeData = {
        handle: event.target,
        right: handlePos.right - event.pageX,
        bottom: handlePos.bottom - event.pageY
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
      let pc = new RTCPeerConnection();
      let id = Math.floor(Math.random() * 1e7);
      let pcObject = {
        pc: pc,
        name: name,
        id: id,
        sid: sid,
        stream: null
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
        this.$el.querySelector('#stream-' + id).srcObject = event.stream;
      };
      pc.onicecandidate = event => {
        this.socket.emit('iceCandidate', sid, id, event.candidate);
      };
      pc.oniceconnectionstatechange = event => {
        if(pc.iceConnectionState == 'disconnected' || pc.iceConnectionState == 'closed') {
          this.pcs.splice(this.pcs.indexOf(pcObject), 1);
          if(this.pcs.length === 0) {
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
        pc = new RTCPeerConnection();
        pcObject = {
          pc: pc,
          sid: sid,
          name: name,
          id: id,
          stream: null
        };
        this.pcs.push(pcObject);

        // listen for stream and ice candidates
        pc.onaddstream = event => {
          this.$el.querySelector('#stream-' + id).srcObject = event.stream;
        };
        pc.oniceconnectionstatechange = event => {
          if(pc.iceConnectionState == 'disconnected' || pc.iceConnectionState == 'closed') {
            this.pcs.splice(this.pcs.indexOf(pcObject), 1);
            if(this.pcs.length === 0) {
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
        navigator.mediaDevices.getUserMedia({
          video: this.streamOptions.videoStream,
          audio: this.streamOptions.audioStream
        })
          .then(_stream => {
            this.stream = _stream;
            pc.addStream(_stream);

            handshake();
          });
      }
      // if stream exists use it
      else {
        pc.addStream(this.stream);
        handshake();
      }
    });
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

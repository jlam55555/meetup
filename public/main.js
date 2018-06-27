// component to get into a channel
let ChannelComponent = {
  template: `<div id='#container'>
  <h3>Join / Create a channel</h3>
  <input type='text' placeholder='channel name' v-model='channelName' /><br>
  <input type='text' placeholder='channel key' v-model='channelKey' /><br>
  <button @click='joinChannel'>Join Channel</button><br>
  <button @click='createChannel'>Create Channel</button>
  <div v-for='channel in channels'>{{ channel }}</div>
  <div v-if='error'>{{ error }}</div>
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
    joinChannel() {
      this.socket.emit('joinChannel', this.channelName, this.channelKey, success => {
        if(success) {
          this.channelName = '';
          this.channelKey = '';
          this.error = '';
          this.$emit('toggle-view');
        } else {
          this.error = 'Error joining channel: Channel doesn\'t exist, key is incorrect, or you are already in a channel.';
        }
      });
    },
    createChannel() {
      this.socket.emit('createChannel', this.channelName, this.channelKey, success => {
        if(success) {
          this.channelName = '';
          this.channelKey = '';
          this.error = '';
          this.$emit('toggle-view');
        } else {
          this.error = 'Error creating channel: Channel name must be between 3 and 50 characters (not including leading/trailing spaces). Channel key must be between 3 and 50 characters. Channel names must be unique (case doesn\'t matter).';
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
  <h3>Channel info</h3>
  <div>Name: {{ channelData.name }}</div>
  <div>Key: {{ channelData.key }}</div>
  <h3>Members</h3>
  <div id='members'>
    <div v-for='member in members'>
      <span>{{ member.name }}</span>
      <button v-if='member.name !== name' @click='call(member.sid)'>Call</button>
    </div>
  </div>
  <h3>Chat</h3>
  <div id='chat'>
    <div v-for='message in messages'>
      <div>{{ message.body }}</div>
      <div>{{ message.author }} | {{ message.time }}</div>
    </div>
  </div>
  <input placeholder='Send a message...' v-model='message' />
  <button @click='sendMessage'>Send</button>
  <h3>Video/Audio Chats</h3>
  <p>Working here</p>
  <p>You:</p>
  <video v-if='stream !== null' :src-object.prop='stream' autoplay></video>
  <p>Connections:</p>
  <video v-for='pcObject in pcs' v-if='pcObject.stream !== null' :src-object.prop='pcObject.stream' autoplay></video>
  <div><button @click='leaveChannel'>Leave channel</button></div>
</div>`,
  data() {
    return {
      // general channel variables
      channelData: {},
      members: [],
      // chat ability variables
      message: '',
      messages: [],
      // video/audio chat webrtc peer connections
      stream: null,
      pcs: []
    };
  },
  props: {
    socket: Object,
    name: String
  },
  methods: {
    sendMessage() {
      if(this.message.trim() !== '') {
        this.socket.emit('sendMessage', this.message.trim());
        this.message = '';
      }
    },
    leaveChannel() {
      this.socket.emit('leaveChannel');
      this.$emit('toggle-view');
    },
    call(sid) {
      let pc = new RTCPeerConnection();
      let id = Math.floor(Math.random() * 1e7);
      let pcObject = {
        pc: pc,
        id: id,
        sid: sid,
        stream: null
      };
      this.pcs.push(pcObject);
      navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      })
        .then(_stream => {
          this.stream = _stream;
          pc.addStream(_stream);

          // begin handshake
          pc.createOffer()
            .then(offer => {
              // set local description
              pc.setLocalDescription(offer);

              // ask for response from websocket
              this.socket.emit('createOffer', sid, id, offer, success => {
                pc.setRemoteDescription(success);
              });
            });
        });
      pc.onaddstream = event => {
        pcObject.stream = event.stream;
      };
      pc.onicecandidate = event => {
        this.socket.emit('iceCandidate', sid, id, event.candidate);
      };
    }
  },
  // set up members and socket handlers
  created() {
    // channel data at start
    this.socket.emit('_channelData', _channelData => this.channelData = _channelData);

    // members list (dynamic)
    this.socket.emit('_members');
    this.socket.on('_members', _members => this.members = _members);

    // messages (dynamic)
    this.socket.emit('_messages');
    this.socket.on('_messages', _messages => this.messages = _messages);

    // respond to ice candidate
    let waitForLocalDescription = (pc, candidate) => {
      console.log(pc.currentLocalDescription, pc.localDescription, pc.currentLocalDescription === undefined, pc.localDescription.type === '');
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
      let pc = new RTCPeerConnection();
      let pcObject = {
        pc: pc,
        sid: sid,
        id: id,
        stream: null
      };
      this.pcs.push(pcObject);

      // listen for stream and ice candidates
      pc.onaddstream = event => {
        pcObject.stream = event.stream;
      };
      pc.onicecandidate = event => {
        this.socket.emit('iceCandidate', sid, id, event.candidate);
      };

      // stream back
      navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      })
        .then(_stream => {
          this.stream = _stream;
          pc.addStream(_stream);

          // create answer
          pc.setRemoteDescription(offer);
          pc.createAnswer()
            .then(answer => {
              pc.setLocalDescription(answer);
              cb(answer);
            });
        });

    })
  }
};

// main vue.js instance
new Vue({
  el: '#app',
  data: {
    socket: io(),
    channel: false,
    name: ''
  },
  methods: {
    toggleView() {
      this.channel = !this.channel
    }
  },
  computed: {
    currentView() {
      return this.channel ? ChatComponent : ChannelComponent;
    }
  },
  created() {
    this.name = prompt('What is your name?');
    this.socket.emit('*name', this.name);
  }
});

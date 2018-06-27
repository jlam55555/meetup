// component to get name
let IntroComponent = {
  template: `<div id='container'>
  <div id='intro-container'>
    <h1>Remeet</h1>
    <h3>Hi there. What's your name?</h3>
    <p>
      <input type='text' v-model='name' placeholder='Joe Schmoe' @keyup.enter='submitName'>
      <button @click='submitName'>Enter</button>
    </p>
  </div>
</div>`,
  data() {
    return {
      name: ''
    };
  },
  methods: {
    submitName() {
      this.$emit('set-name', this.name);
    }
  }
};

// component to get into a channel
let ChannelComponent = {
  template: `<div id='container'>
  <div id='create-channel'>
    <h1>Remeet</h1>
    <p>Welcome, {{ name }}.</p>
    <h3>Create a channel</h3>
    <input class='alt' type='text' placeholder='channel name' v-model='channelName' /><br>
    <input class='alt' type='text' placeholder='channel key' v-model='channelKey' /><br>
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
        <h3>{{ channel.name }}</h3>
        <p><input type='text' placeholder='Enter key' v-model='channel.key'></p>
        <p><button @click='joinChannel(channel)'>Join</button></p>
      </div>
    </div>
  </div>
</div>`,
  props: {
    socket: Object,
    name: String
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
    this.socket.on('_channels', _channels => 
      this.channels = _channels.map(channelName => ({ name: channelName, key: '' })));
  }
};

// component when in channel
let ChatComponent = {
  template: `<div id='container'>
  <div id='channel-data'>
    <h1>Remeet</h1>
    <div class='group'>
      <p>Channel: {{ channelData.name }}</p>
      <p>Channel key: {{ channelData.key }}</p>
      <p>Your name: {{ name }}</p>
      <p><button @click='leaveChannel'>Leave channel</button></p>
    </div>
    <div class='group' id='members-group'>
      <h3>Members</h3>
      <div id='members'>
        <div class='member' v-for='member in members'>
          <span>
            {{ member.name }}
            <strong v-if='member.sid === sid'>(you)</strong>
          </span>
          <button v-if='member.sid !== sid' @click='call(member.sid)'>Call</button>
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
    <h3>Video/Audio Chats</h3>
    <p>Working here</p>
    <p>You:</p>
    <video v-if='stream !== null' :src-object.prop='stream' autoplay></video>
    <p>Connections:</p>
    <video v-for='pcObject in pcs' v-if='pcObject.stream !== null' :src-object.prop='pcObject.stream' autoplay></video>
  </div>
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
    name: String,
    sid: String
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
  filters: {
    timeString(time) {
      // return (h)h:mm
      return new Intl.DateTimeFormat('en-us', {
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date(time));
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
    sid: '',
    name: false
  },
  methods: {
    toggleView() {
      this.channel = !this.channel;
    },
    setName(name) {
      console.log('test', name);
      this.name = name;
      this.socket.emit('*name', this.name, _sid => this.sid = _sid);
    }
  },
  computed: {
    currentView() {
      return !this.name ? IntroComponent : (this.channel ? ChatComponent : ChannelComponent);
    }
  }
});

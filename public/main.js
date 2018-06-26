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
        console.log('test');
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
  <div v-for='member of members'>{{ member.name }}</div>
  <div><button @click='leaveChannel'>Leave channel</button></div>
</div>`,
  data() {
    return {
      members: []
    };
  },
  props: {
    socket: Object
  },
  methods: {
    leaveChannel() {
      this.socket.emit('leaveChannel');
      this.$emit('toggle-view');
    }
  },
  // set up members and socket handlers
  created() {
    this.socket.emit('_members');
    this.socket.on('_members', _members => this.members = _members);
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

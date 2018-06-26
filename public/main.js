// component to get into a room
let RoomComponent = {
  template: `<div id='#container'>
  <h3>Join / Create a room</h3>
  <input type='text' placeholder='room name' v-model='roomName' /><br>
  <input type='text' placeholder='room key' v-model='roomKey' /><br>
  <button @click='joinRoom'>Join Room</button><br>
  <button @click='createRoom'>Create Room</button>
  <div v-for='room in rooms'>{{ room }}</div>
  <div v-if='error'>{{ error }}</div>
</div>`,
  props: {
    socket: Object
  },
  data() {
    return {
      rooms: [],
      roomName: '',
      roomKey: '',
      error: ''
    };
  },
  methods: {
    joinRoom() {
      this.$emit('toggle-view');
    },
    createRoom() {
      this.socket.emit('createRoom', this.roomName, this.roomKey, success => {
        if(success) {
          this.roomName = '';
          this.roomKey = '';
          this.error = '';
          this.$emit('toggle-view');
        } else {
          this.error = 'Error creating room: Room name must be between 3 and 50 characters (not including leading/trailing spaces). Room key must be between 3 and 50 characters. Room names must be unique (case doesn\'t matter).';
        }
      });
    }
  },
  // set socket.io listeners
  created() {
    // get initial list of rooms
    this.socket.emit('_rooms');

    // on room update, update list
    this.socket.on('_rooms', _rooms => this.rooms = _rooms);
  }
};

// component when in room
let ChatComponent = {
  template: `<div id='container'>
  <div><button @click='leaveRoom'>Leave room</button></div>
</div>`,
  methods: {
    leaveRoom() {
      this.$emit('toggle-view');
    }
  }
};

// main vue.js instance
new Vue({
  el: '#app',
  data: {
    socket: io(),
    room: false,
  },
  methods: {
    toggleView() {
      this.room = !this.room
    }
  },
  computed: {
    currentView() {
      return this.room ? ChatComponent : RoomComponent;
    }
  }
});

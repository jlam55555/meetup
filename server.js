// get dependencies
let express = require('express');
let app = express();
let http = require('http').Server(app);
let io = require('socket.io')(http);

// rooms (roomNames is available to the public, rooms is essentially hidden)
let rooms = [];
let roomNames = [];
let Room = function(name, key) {
  // set name and key
  this.name = name.trim().toLowerCase();
  this.key = key;

  // check for duplicate name or invalid name/key length
  // if invalid, return false
  // if not, return the room
  return (roomNames.indexOf(this.name) !== -1
    || this.key.length < 3
    || this.key.length > 50
    || this.name < 3
    || this.name.length > 50) ? false : this;
};

// socket.io
io.on('connect', socket => {
 
  // rooms getter
  socket.on('_rooms', () => socket.emit('_rooms', roomNames));

  // create room
  socket.on('createRoom', (name, key, cb) => {
    let newRoom = Room(name, key);
    // if new room valid, create it, join it, and alert everyone
    if(newRoom) {
      rooms.push(newRoom);
      roomNames.push(newRoom.name);
      socket.join(newRoom.name);
      io.sockets.emit('_rooms', roomNames);
      cb(true);
    }
    // or invalid return false
    else {
      cb(false);
    }
  });

});

// routing
app.use(express.static('./public'));
http.listen(process.env.PORT || 5000, () => {
  console.log(`Listening on port ${process.env.PORT || 5000}.`)
});

// get dependencies
let express = require('express');
let app = express();
let http = require('http').Server(app);
let io = require('socket.io')(http);

// channels (channelNames is available to the public, channels is essentially hidden)
let channels = new Map();
let Member = function(name, sid) {
  this.name = name;
  this.sid = sid;
}
let Channel = function(name, key) {
  // set name and key
  this.name = name.trim().toLowerCase();
  this.key = key;
  this.members = [];

  // methods
  this.addMember = function(sid, key) {

    // make sure not in another channel
    let memberFound = false;
    channels.forEach(channel => {
      if(channel.members.find(member => member.sid === sid) !== undefined) memberFound = true;
    })
    if(memberFound) return false;
    
    // make sure key matches
    if(key == this.key) {
      io.sockets.sockets[sid].data.channel = this.name;
      io.sockets.sockets[sid].join(this.name);
      this.members.push(new Member(io.sockets.sockets[sid].data.name, sid));
      io.to(this.name).emit('_members', this.members);
      return true;
    } else {
      return false;
    }
  };
  this.removeMember = function(sid) {
    let member = this.members.find(member => member.sid === sid);
    this.members.splice(this.members.indexOf(member), 1);
    // alert room
    io.to(this.name).emit('_members', this.members);

    // if no members left, delete room and alert all
    if(this.members.length === 0) {
      channels.delete(this.name);
      io.sockets.emit('_channels', Array.from(channels.keys()));
    }
  }

  // check for duplicate name or invalid name/key length
  // if invalid, return false
  // if not, return the channel
  return (channels.has(this.name)
    || this.key.length < 3
    || this.key.length > 50
    || this.name < 3
    || this.name.length > 50) ? false : this;
};

// socket.io
io.on('connect', socket => {

  // custom data in socket.data
  socket.data = {};

  // set name
  socket.on('*name', name => socket.data.name = name);
 
  // channels getter
  socket.on('_channels', () => socket.emit('_channels', Array.from(channels.keys())));

  // join channel
  socket.on('joinChannel', (channelName, key, cb) => {
    // make sure channel exists
    if(!channels.has(channelName)) return cb(false);

    // try to add member
    if(channels.get(channelName).addMember(socket.id, key)) {
      cb(true);
    } else {
      cb(false);
    }
  });

  // create channel
  socket.on('createChannel', (channelName, key, cb) => {
    let newChannel = Channel(channelName, key);
    // if new channel valid, create it, join it, and alert everyone
    if(newChannel) {
      channels.set(newChannel.name, newChannel);
      newChannel.addMember(socket.id, key);
      io.sockets.emit('_channels', Array.from(channels.keys()));
      cb(true);
    }
    // or invalid return false
    else {
      cb(false);
    }
  });

  // get channel members
  socket.on('_members', () => {
    if(socket.data.channel) {
      socket.emit('_members', channels.get(socket.data.channel).members);
    }
  });

  // leave channel when leave button pressed or disconnect
  socket.leaveChannel = () => {
    if(socket.data.channel) {
      channels.get(socket.data.channel).removeMember(socket.id);
      socket.data.channel = null;
    }
  };
  socket.on('leaveChannel', socket.leaveChannel);
  socket.on('disconnect', socket.leaveChannel);

});

// routing
app.use(express.static('./public'));
http.listen(process.env.PORT || 5000, () => {
  console.log(`Listening on port ${process.env.PORT || 5000}.`)
});

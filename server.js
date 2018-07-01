// get dependencies
let express = require('express');
let app = express();
let http = require('http').Server(app);
let io = require('socket.io')(http);

// channel data!
let channels = new Map();

// send channel
let sendChannelsData = socket => {
  // get channel key, name
  let channelData = Array.from(channels.values()).map(channel => ({
    name: channel.name,
    description: channel.description,
    memberCount: channel.members.length,
    key: ''
  }));

  // emit to socket if provided, otherwise emit to all
  (socket ? socket : io.sockets).emit('_channels', channelData);
};

// channel description objects
let Member = function(name, sid) {
  this.name = name;
  this.sid = sid;
}
let Message = function(body, author, sid, time) {
  this.body = body;
  this.author = author;
  this.sid = sid;
  this.time = time;
}
let ServerMessage = function(body) {
  Message.call(this, body, null, null, new Date());
}
let Channel = function(name, key) {
  // set name and key
  this.name = name;
  this.key = key;
  this.description = '';
  this.members = [];
  this.messages = [];

  // methods
  this.addMember = function(sid, key) {
    // make sure not in another channel
    if(io.sockets.sockets[sid].data.channel !== undefined) return false;
    
    // make sure key matches
    if(key === this.key) {
      io.sockets.sockets[sid].data.channel = this.name;
      io.sockets.sockets[sid].join(this.name);
      this.members.push(new Member(io.sockets.sockets[sid].data.name, sid));
      this.sendChannelData();
      this.messages.push(new ServerMessage(io.sockets.sockets[sid].data.name + ' has joined the channel.'));
      io.to(this.name).emit('_messages', this.messages);
      sendChannelsData();
      return true;
    } else {
      return false;
    }
  };
  this.removeMember = function(sid, isDisconnect) {
    let member = this.members.find(member => member.sid === sid);
    this.members.splice(this.members.indexOf(member), 1);
    this.messages.push(new ServerMessage(member.name + ' has left the channel.'));
    io.to(this.name).emit('_messages', this.messages);
    if(!isDisconnect) {
      io.sockets.sockets[sid].data.channel = undefined;
    }

    // if no members left, delete room and alert all
    if(this.members.length === 0) {
      channels.delete(this.name);
    }

    // alert people
    this.sendChannelData();
    sendChannelsData();
  }
  // update description
  this.updateDescription = function(_description) {
    if(_description !== this.description && _description.length <= 50) {
      this.description = _description;
      this.sendChannelData();
      sendChannelsData();
    }
  }
  // send this channel data to socket or room
  this.sendChannelData = function(socket) {
    (socket ? socket : io.to(this.name)).emit('_channelData', {
      name: this.name,
      key: this.key,
      description: this.description,
      members: this.members
    });
  };
};
let createChannel = (name, key) => {
  name = name.trim().toLowerCase();
  
  // check for duplicate name or invalid name/key length
  // if invalid, return false
  // if not, return the channel
  return (channels.has(name)
    || key.length < 3
    || key.length > 50
    || name.length < 3
    || name.length > 50) ? false : new Channel(name, key);
};

// socket.io
io.on('connect', socket => {

  // custom data in socket.data
  socket.data = {};

  // set name
  socket.on('*name', (name, cb) => {
    socket.data.name = name;
    cb(socket.id);
  });
 
  // channels getter
  socket.on('_channels', sendChannelsData.bind(null, socket));

  // join channel
  socket.on('joinChannel', (name, key, cb) => {
    // make sure channel exists
    if(!channels.has(name)) return cb(false);

    // try to add member
    if(channels.get(name).addMember(socket.id, key)) {
      cb(true);
    } else {
      cb(false);
    }
  });

  // create channel
  socket.on('createChannel', (name, key, cb) => {
    let newChannel = createChannel(name, key);

    // if new channel valid, create it, join it, and alert everyone
    if(newChannel) {
      channels.set(newChannel.name, newChannel);
      newChannel.addMember(socket.id, key);
      sendChannelsData();
      cb(true);
    }
    // or invalid return false
    else {
      cb(false);
    }
  });

  // update channel description
  socket.on('*channel.description', description => {
    if(socket.data.channel) {
      channels.get(socket.data.channel).updateDescription(description);
    }
  });

  // get channel members
  socket.on('_members', () => {
    if(socket.data.channel) {
      socket.emit('_members', channels.get(socket.data.channel).members);
    }
  });

  // send message to channel
  socket.on('sendMessage', msg => {
    if(socket.data.channel) {
      let channel = channels.get(socket.data.channel);
      channel.messages.push(new Message(msg, socket.data.name, socket.id, new Date()));
      io.to(socket.data.channel).emit('_messages', channel.messages);
    }
  });

  // get messages
  socket.on('_messages', () => {
    if(socket.data.channel) {
      socket.emit('_messages', channels.get(socket.data.channel).messages);
    }
  });
  
  // get channel data
  socket.on('_channelData', cb => {
    if(socket.data.channel) {
      let channel = channels.get(socket.data.channel);
      channel.sendChannelData(socket);
    }
  });
  
  // send message to specific sid
  socket.on('sendNotification', (sid, message) => {
    if(socket.data.channel) {
      let channel = channels.get(socket.data.channel);

      // make sure sid exists in channel
      let callee = channel.members.find(member => member.sid === sid)
      if(callee === undefined) {
        return cb(false);
      }
      
      // send message
      io.sockets.sockets[sid].emit('_notification', message);
    }
  });

  // request call
  socket.on('createOffer', (sid, id, offer, cb) => {
    if(socket.data.channel) {
      let channel = channels.get(socket.data.channel);

      // make sure sid exists in channel
      let callee = channel.members.find(member => member.sid === sid)
      if(callee === undefined) {
        return cb(false);
      }

      // ask for answer
      io.sockets.sockets[callee.sid].emit('callOffer', socket.data.name, socket.id, id, offer, answer => {
        cb(answer);
      });
      
    }
  });

  // ice candidate (very similar to above)
  socket.on('iceCandidate', (sid, id, candidate) => {
    if(socket.data.channel) {
      let channel = channels.get(socket.data.channel);

      // make sure sid exists in channel
      let callee = channel.members.find(member => member.sid === sid)
      if(callee === undefined) {
        return;
      }

      // ask for answer
      io.sockets.sockets[callee.sid].emit('icecandidate', id, candidate);
    }
  });

  // leave channel when leave button pressed or disconnect
  let leaveChannel = isDisconnect => {
    if(socket.data.channel) {
      channels.get(socket.data.channel).removeMember(socket.id, isDisconnect);
    }
  };
  socket.on('leaveChannel', leaveChannel.bind(null, false));
  socket.on('disconnect', leaveChannel.bind(null, true));

});

// routing
app.use(express.static('./public'));
http.listen(process.env.PORT || 5000, () => {
  console.log(`Listening on port ${process.env.PORT || 5000}.`)
});

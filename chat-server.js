const http = require("http")
const fs = require("fs");
const path = require("path");
const PORT = 3456;

// listens for HTTP connections on port 3456 --> displays client.html upon success
const server = http.createServer(async (req, res) =>{
    const mime = await import('mime');
    const filePath = path.join(__dirname, req.url);
    fs.readFile(filePath, (err, data) => {
        if(err){
            res.writeHead(404); // File Not Found
            return;
        }
        // file exists and is readable
        let contentType = mime.default.getType(filePath);
        if(contentType === null){
            res.writeHead(400); // Bad Request
            return;
        }
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
    });
});
server.listen(PORT, function (){
    console.log(`Server is running on http://localhost:3456`);
});

const socketIO = require("socket.io")(http, {
    wsEngine: 'ws'
});

const io = socketIO.listen(server);

/* stores administrative information about each room
    - roomName (string): Room's Name/ID  maps to { creator (string):    Room's creator,
                                                   admins (set):        Set of users (socketIds) given admin privileges by the creator
                                                   banList (set):       Set of users (socketIds) permanently banned from the room
                                                   password (string):   Room's Password
                                                   maxSize (int):       Room's Maximum Size (as specified when creatign the room)
                                                   currentSize(int):    Room's current size (constantly updated as users enter/leave)
                                                 }
*/
const roomData = {};
  

// user connects to server (enters page)
io.sockets.on("connection", function(socket){
    console.log('User Connected:', socket.id);

    // returns if username is currently available
    socket.on('check_username_availability', async function(data){
        const { username } = data;
        const sockets = await io.fetchSockets();
        const usernameAvailableResult = !sockets.some(sock => sock.username === username);     // available: true | false
        socket.emit('username_availability_result', { available: usernameAvailableResult });
        if(usernameAvailableResult){
            // create user & update the active room list on the next page
            socket.username = username;
            io.emit('update_roomList', roomData);
        }
        console.log('----------------------------------------------------------------------------------------------------------------')
        console.log(sockets);
    });

    // signs out the user
    socket.on('signOut', function(){
        delete socket.username;
        socket.emit('signedOut');
    });

    // returns if room name is currently available (if no room currently has the given name, allow room creation.   else: don't allow)
    socket.on('create_room', async function(data){
        const roomName = data.roomName;
        const password = data.password;
        const maxSize = data.maxSize;

        const rooms = io.of("/").adapter.rooms;
        let roomCreatable = true;
        for(const room of rooms.keys()){
            if(room === roomName){
                roomCreatable = false;
                break;
            }
        }
        // if room name is available --> create the room and store associated local data
        if(roomCreatable){
            socket.join(roomName);
            roomData[roomName] =    {   creator:        socket.username,
                                        admins:         new Set(),
                                        banList:        new Set(),
                                        password:       password,
                                        maxSize:        maxSize,
                                        currentSize:    1
                                    };
            io.emit('update_roomList', roomData);

            // update room's user list
            const socketsInRoom = await io.in(roomName).fetchSockets();
            const updatedUserList = socketsInRoom.map(socket => socket.username);
            io.emit('update_user_list', { roomName, creator: roomData[roomName].creator, adminList : Array.from(roomData[roomName].admins) , updatedUserList });

            // welcome message
            const typeOfMessage = 'help';
            const sender = 'ChitChat Bot';
            const message = `Welcome to the room!\n
                            Help Commands\n
                            • Type !help for help commands\n
                            • Type !pm username to send a private message`;

            io.to(socket.id).emit('receive_message', { sender, message, typeOfMessage });
        }

        socket.emit('create_room_result', { available: roomCreatable });
    });

    socket.on('join_room', async function (data){
        const roomName = data.roomName;
        const password = data.password;
    
        // check if password (if provided) is correct
        if (roomData[roomName].password){
            if (password && password !== roomData[roomName].password){
                socket.emit('join_room_error', { message: 'Incorrect Password' });
                return;
            }
        }
    
        // check if room is full
        if(roomData[roomName].currentSize >= roomData[roomName].maxSize){
            socket.emit('join_room_error', { message: 'Room is full' });
            return;
        }

        // check if user is banned from the room
        if(roomData[roomName].banList.has(socket.username)){
            socket.emit('join_room_error', { message: 'You are permanently banned from this room.' });
            return;
        }
    
        // passes all validation --> join room & increment current room size
        socket.join(roomName);
        roomData[roomName].currentSize++;
    
        socket.emit('join_room_success');

        // update room size list
        io.emit('update_roomList', roomData);
        
        // update room's user list
        const socketsInRoom = await io.in(roomName).fetchSockets();
        const updatedUserList = socketsInRoom.map(socket => socket.username);
        io.emit('update_user_list', { roomName, creator: roomData[roomName].creator, adminList : Array.from(roomData[roomName].admins) , updatedUserList });


        // welcome message
        const typeOfMessage = 'help';
        const sender = 'ChitChat Bot';
        const message = `Welcome to the room!\n
                        Help Commands\n
                        • Type !help for help commands\n
                        • Type !pm username to send a private message`;

        io.to(socket.id).emit('receive_message', { sender, message, typeOfMessage });
    });

    socket.on('get_user_role', function(data){
        const roomName = data.roomName;
        const username = data.username;
        let role = "";
        if(roomData[roomName].creator === username){
            role = "creator";
        }else if(roomData[roomName].admins.has(username)){
            role = "admin";
        }else{
            role = "regular";
        }
        socket.emit('user_role_result', role);
    });
    
    // socket.on('message_to_server', function (data){
    //     console.log("message: " + data["message"]);
    //     io.sockets.emit("message_to_client", { message: data["message"] });
    // });

    socket.on('send_message', async function(data){
        const roomName = data.roomName;

        if(roomName !== null){
            let message = data.message; 
            let sender = data.sender;
            let typeOfMessage = 'public';     // messages are public by default

            /*
                parsing a message:
                    - message is !help --> display usage commands in the messages container
                    - message is !pm <recipient> <message> --> display/send private message to recipient
                    - otherwise: normal message --> display/send message to entire room
            */
            const pmPattern = /^!pm (\w+) ([\s\S]+)$/i;


            if(message === "!help"){
                typeOfMessage = 'help';
                sender = 'ChitChat Bot';
                message =   `Help Commands\n
                            • Type !help for help commands\n
                            • Type !pm username to send a private message`;

                io.to(socket.id).emit('receive_message', { sender, message, typeOfMessage });
            }else if(pmPattern.test(message)){
                const [,recipient, parsedMessage] = message.match(pmPattern);
                typeOfMessage = 'private';

                const socketsInRoom = await io.in(roomName).fetchSockets();
                const recipientSocket = socketsInRoom.find(socket => socket.username === recipient);

                // check if message recipient is in the room --> send private message
                if(recipientSocket){
                    sender = `Private Message from ${socket.username}`
                    typeOfMessage = 'private';
                    const recipientSocketID = recipientSocket.id;

                    // private message FROM sender
                    socket.to(recipientSocketID).emit('receive_message', { sender, message: parsedMessage, typeOfMessage });

                    // private message TO recipient
                    sender = `Private Message to ${recipient}`;
                    io.to(socket.id).emit('receive_message', { sender, message: parsedMessage, typeOfMessage });
                }else{  // recipient is not in the room
                    sender = 'ChitChat Bot';
                    message = `Whoops! ${recipient} isn't currently in the room.`;

                    socket.to(socket.id).emit('receive_message', { sender, message, typeOfMessage });
                }
            }else{  // public message
                io.in(roomName).emit('receive_message', { sender, message, typeOfMessage });
            }

            console.log(`${typeOfMessage} message from ${sender}: ${message}`);
        }
    });

    socket.on('get_current_room', function(){
        // rooms the socket is currently in
        const socketRooms = io.of("/").adapter.sids.get(socket.id);

        /* 
        sockets can be in at most 2 rooms:
            - sockets will ALWAYS be in their own socket.id room (this is also used for private messaging)
            - sockets can join chat rooms
        */
        let roomName = null;
        for(const room of socketRooms){
            if(room !== socket.id){
                roomName = room;
                break;
            }
        }

        // socket is in a chat room --> leave and decrement room size!
        socket.emit('current_room_result', roomName);
    });

    socket.on('admin', async function(username){
        const socketRooms = io.of("/").adapter.sids.get(socket.id);

        /* 
        sockets can be in at most 2 rooms:
            - sockets will ALWAYS be in their own socket.id room (this is also used for private messaging)
            - sockets can join chat rooms
        */
        let roomName = null;
        for(const room of socketRooms){
            if(room !== socket.id){
                roomName = room;
                break;
            }
        }

        if(roomName !== null){
            roomData[roomName].admins.add(username);
            // update room's user list
            const socketsInRoom = await io.in(roomName).fetchSockets();
            const updatedUserList = socketsInRoom.map(socket => socket.username);
            io.emit('update_user_list', { roomName, creator: roomData[roomName].creator, adminList : Array.from(roomData[roomName].admins) , updatedUserList });
        }
    });

    socket.on('unadmin', async function(username){
        const socketRooms = io.of("/").adapter.sids.get(socket.id);

        /* 
        sockets can be in at most 2 rooms:
            - sockets will ALWAYS be in their own socket.id room (this is also used for private messaging)
            - sockets can join chat rooms
        */
        let roomName = null;
        for(const room of socketRooms){
            if(room !== socket.id){
                roomName = room;
                break;
            }
        }

        if(roomName !== null){
            roomData[roomName].admins.delete(username);
            // update room's user list
            const socketsInRoom = await io.in(roomName).fetchSockets();
            const updatedUserList = socketsInRoom.map(socket => socket.username);
            io.emit('update_user_list', { roomName, creator: roomData[roomName].creator, adminList : Array.from(roomData[roomName].admins) , updatedUserList });
            console.log(roomData[roomName]);
        }
    });

    async function leaveRoom(socket){
        // rooms the socket is currently in
        const socketRooms = io.of("/").adapter.sids.get(socket.id);

        /* 
        sockets can be in at most 2 rooms:
            - sockets will ALWAYS be in their own socket.id room (this is also used for private messaging)
            - sockets can join chat rooms
        when leaving a room, we will only make the socket leave a chat room. the socket will continue inside their own socket.id room
        */
        let roomName = null;
        for(const room of socketRooms){
            if(room !== socket.id){
                roomName = room;
                break;
            }
        }

        // socket is in a chat room --> leave and decrement room size!
        if(roomName !== null){
            socket.leave(roomName);
            roomData[roomName].currentSize--;

            // if socket was the last user in the chat room, delete the room
            if(roomData[roomName].currentSize === 0){
                delete roomData[roomName];

                // update room size list
                io.emit('update_roomList', roomData);
            }else{
                // update room size list
                io.emit('update_roomList', roomData);

                // update room's user list
                const socketsInRoom = await io.in(roomName).fetchSockets();
                const updatedUserList = socketsInRoom.map(socket => socket.username);
                io.emit('update_user_list', { roomName, creator: roomData[roomName].creator, adminList : Array.from(roomData[roomName].admins) , updatedUserList });
            }
        }
    }

    socket.on('kick', async function(username){
        const socketRooms = io.of("/").adapter.sids.get(socket.id);

        /* 
        sockets can be in at most 2 rooms:
            - sockets will ALWAYS be in their own socket.id room (this is also used for private messaging)
            - sockets can join chat rooms
        */
        let roomName = null;
        for(const room of socketRooms){
            if(room !== socket.id){
                roomName = room;
                break;
            }
        }

        if(roomName !== null){
            const socketsInRoom = await io.in(roomName).fetchSockets();
            const socketToKick = socketsInRoom.find(socket => socket.username === username);
            await leaveRoom(socketToKick);
            io.to(socketToKick.id).emit('kicked');
        }
    });

    socket.on('ban', async function(username){
        const socketRooms = io.of("/").adapter.sids.get(socket.id);

        /* 
        sockets can be in at most 2 rooms:
            - sockets will ALWAYS be in their own socket.id room (this is also used for private messaging)
            - sockets can join chat rooms
        */
        let roomName = null;
        for(const room of socketRooms){
            if(room !== socket.id){
                roomName = room;
                break;
            }
        }

        if(roomName !== null){
            roomData[roomName].banList.add(username);
            const socketsInRoom = await io.in(roomName).fetchSockets();
            const socketToKick = socketsInRoom.find(socket => socket.username === username);
            await leaveRoom(socketToKick);
        
            // kick and ban user
            io.to(socketToKick.id).emit('banned');
        }
    });

    

    // user leaves the room
    socket.on('leave_room', async function(){
        await leaveRoom(socket);
    });

    // user disconnects from program --> leave all rooms and update displays
    socket.on('disconnecting', async function() {
        await leaveRoom(socket);
    });

    // user disconnects from server (exits page)
    socket.on('disconnect', function (){
        console.log('User Disconnected:', socket.id);
    });
});
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
    socket.on('create_room', function(data){
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
        }

        socket.emit('create_room_result', { available: roomCreatable });
    });

    socket.on('join_room', async function (data){
        const roomName = data.roomName;
        const password = data.password;
    
        // check if password (if provided) is correct
        if (roomData[roomName].password) {
            if (password && password !== roomData[roomName].password) {
                socket.emit('join_room_error', { message: 'Incorrect Password' });
                return;
            }
        }
    
        // check if room is full
        if(roomData[roomName].currentSize >= roomData[roomName].maxSize){
            socket.emit('join_room_error', { message: 'Room is full' });
            return;
        }
    
        // passes all validation --> join room & increment current room size
        socket.join(roomName);
        roomData[roomName].currentSize++;
    
        socket.emit('join_room_success');
        
        // update room's user list
        const socketsInRoom = await io.in(roomName).fetchSockets();
        const updatedUserList = socketsInRoom.map(socket => socket.username);
        io.emit('update_user_list', { roomName, creator: roomData[roomName].creator, adminList : Array.from(roomData[roomName].admins) , updatedUserList });
    });

    socket.on('get_user_role', function(data){
        const roomName = data.roomName;
        const username = data.username;

        console.log(`passed in username: ${username}`);
        console.log(`creator is ${roomData[roomName].creator}`);
        console.log(`admins are ${roomData[roomName].admins}`);

        let role = "";
        if(roomData[roomName].creator === username){
            role = "creator";
        }else if(roomData[roomName].admins.has(username)){
            role = "admin";
        }else{
            role = "regular";
        }

        console.log(`finally, username's role is ${role}`);
        socket.emit('user_role_result', role);
    });
    
    // socket.on('message_to_server', function (data){
    //     console.log("message: " + data["message"]);
    //     io.sockets.emit("message_to_client", { message: data["message"] });
    // });


    // user disconnects from server (exits page)
    socket.on('disconnect', function (){
        console.log('User Disconnected:', socket.id);
    });
});
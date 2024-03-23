socket.on('receive_message', function(data){
    const sender = data.sender;
    const message = data.message;
    const typeOfMessage = data.typeOfMessage;

    const messageContainer = document.getElementById('messagesContainer');

    const chatBox = document.createElement('div');
    $(chatBox).addClass('chatBox');
    const profilePicture = document.createElement('img');
    $(profilePicture).addClass('chatBox-avatar')
    $(profilePicture).attr('src', 'static/default-user.svg');
    $(profilePicture).attr('alt', 'Profile Picture');

    const chatBox_right = document.createElement('div');
    $(chatBox_right).addClass('chatBox-right');

    const messageSender = document.createElement('h6');
    $(messageSender).addClass('chatBox-username');
    $(messageSender).text(sender);

    const messageText = document.createElement('p');
    $(messageText).addClass('chatBox-message');
    $(messageText).html(message.replace(/\n/g, '<br>'));

    if(typeOfMessage === 'help'){
        $(profilePicture).attr('src', 'static/chitchat.png');
        $(messageSender).addClass('helpMessage');
        $(messageText).addClass('helpMessage');
        
    }else if(typeOfMessage === 'private'){
        $(messageSender).addClass('privateMessage');
        $(messageText).addClass('privateMessage');
    }

    $(chatBox_right).append(messageSender);
    $(chatBox_right).append(messageText);
    $(chatBox).append(profilePicture);
    $(chatBox).append(chatBox_right);
    $(messageContainer).append(chatBox);

    // scroll to newest message
    messageContainer.scrollTop = messageContainer.scrollHeight;
});

// handles send message form submission
function sendMessage(submit){
    const form = document.getElementById("sendMessage");
    submit.preventDefault(); // prevent default form refresh upon submission

    if(form.checkValidity()){
        const message = document.getElementById('message').value;

        socket.emit('get_current_room');
        socket.once('current_room_result', function(room){
            if(room !== null){
                if(room !== null){
                    console.log(message);
                    socket.emit('send_message', {roomName: room, message, sender: socket.username});
                }

                resetForms();
            }
        });
    }else{
        console.log('form validation');
        form.reportValidity();
    }
}


// user wants to enter password-protected room --> prompt user for password --> validate password
function validatePassword(submit, roomName){
    const form = document.getElementById("passwordForm");
    submit.preventDefault(); // prevent default form refresh upon submission

    if(form.checkValidity()){
        const enteredPassword = document.getElementById("password").value;
        joinRoom(roomName, enteredPassword);
    }else{
        form.reportValidity();
    }
}

// user clicks on a room to join --> verifies password (if protected) is correct, and room size is not at maximum capacity --> join room
function joinRoom(roomName, password = null){
    socket.emit('join_room', { roomName, password });
}

// notifies user that the room is full or the provided password is incorrect --> DO NOT ALLOW ENTRY
socket.on('join_room_error', function (data){
    if(data.message === 'Room is full'){
        $('#roomPasswordModal').modal('hide');
        $('#warning-roomFull h6').text(data.message);
        $('#warning-roomFull').show();
    }else if(data.message === 'Incorrect Password'){
        $('#warning-password h6').text(data.message);
        $('#warning-password').show();
    }
});

// join room success! --> allow entry!
socket.on('join_room_success', function (){
    $('#roomPasswordModal').modal('hide');
    displayPage('#page3-chatRoom');
});

function userClickHandler(socketUsername, clickedUsername, roomName){
    return function(){
        // get socket's role
        socket.emit('get_user_role', { roomName, username: socketUsername });
        socket.once('user_role_result', function(socketRole){
            // get clickedUser's role
            socket.emit('get_user_role', { roomName, username: clickedUsername });
            socket.once('user_role_result', function(clickedUserRole){
            
                /* user action modal logic:
                    - If current user is the room CREATOR:
                        - Allow creator to kick/ban/admin/unadmin any other user in the room.
                    - If current user is a room ADMIN:
                        - Allow admin to kick/ban any other REGULAR user (not creator or another admin)
                    - If current user is not a room CREATOR and not a room ADMIN, they are a REGULAR user
                        - No special priviledges.
                */

                $('#userAction-username').text(clickedUsername);
                $('#userActionModalBody').show();
                // current user is the CREATOR
                if(socketRole === "creator"){
                    // CREATOR clicked on an ADMIN --> kick/ban/unadmin
                    if(clickedUserRole === "admin"){
                        $('#admin').hide();
                    }else if(clickedUserRole === "regular"){      // CREATOR clicked on a REGULAR user --> kick/ban/admin
                        $('#unadmin').hide();
                    }
                // current user is an ADMIN
                }else if(socketRole === "admin"){
                    // ADMIN clicked on a REGULAR user --> kick/ban
                    if(clickedUserRole !== "creator" && clickedUserRole !== "admin"){
                        $('#admin', '#unadmin').hide();
                    }
                }
            });
        });
    };
}

socket.on('update_user_list', function(data){
    const roomName = data.roomName;
    const creator = data.creator;
    const adminList = data.adminList;
    const updatedUserList = data.updatedUserList;
    
    // clear user list before updating
    const userList = $('#userListBody');
    $(userList).html('');

    for(const user of updatedUserList){
        const tableRow = document.createElement('tr');
        const usernameDisplay = document.createElement('td');

        // displays crown for creator, shield for admins
        if(user === creator){
            $(usernameDisplay).addClass('userWithImage');
            $(usernameDisplay).html(`<img src="static/crown.png"></img>${user}`);
        }else if(adminList.includes(user)){
            $(usernameDisplay).addClass('userWithImage');
            $(usernameDisplay).html(`<img src="static/shield.png">${user}`);   
        }else{  // regular user
            $(usernameDisplay).text(user);
        }

        // user action modal toggle view
        // creator can click on any other name and commit an action
        // admins can only click on regular user and commit an action (can't click on other admin, or creator)
        tableRow.setAttribute('data-bs-target', '#userActionModal');
        if((socket.username === creator && user !== creator) || (adminList.includes(socket.username) && !adminList.includes(user) && user !== creator)){
            $(tableRow).attr('data-bs-toggle', 'modal');
        }else{
            tableRow.setAttribute('data-bs-toggle', 'disabled');
        }

        $(tableRow).click(userClickHandler(socket.username, user, roomName));

        $(tableRow).append(usernameDisplay);
        $(userList).append(tableRow);
    }
});

// updates room list to reflect actively open rooms
socket.on('update_roomList', function (roomData){
    console.log(roomData);
    const roomList = $('#roomList-body');
    
    // clear active roomList and re-populate entries
    $(roomList).html('');

    for(const [roomName, room_data] of Object.entries(roomData)){
        const tableRow = document.createElement('tr');
        const roomNameDisplay = document.createElement('td');
        roomNameDisplay.textContent = roomName;
        const chatters = document.createElement('td');
        chatters.textContent = `${room_data.currentSize}/${room_data.maxSize}`;
        const private = document.createElement('td');
        private.textContent = room_data.password === '' ? 'No' : 'Yes';

        $(tableRow).append(roomNameDisplay);
        $(tableRow).append(chatters);
        $(tableRow).append(private);

        $(roomList).append(tableRow);

        $(tableRow).off(); // Remove all event listeners from tableRow

        // attach join room event listener to the table row
        if(room_data.password){
            $('#roomPassword-submit').off();
            console.log('u have a password');
            tableRow.setAttribute('data-bs-toggle', 'modal');
            tableRow.setAttribute('data-bs-target', '#roomPasswordModal');
            $('#roomPassword-submit').click(function (submit){
                $('#warning-password').hide();
                validatePassword(submit, roomName);
                resetForms();
            });
        }else{
            console.log('u dont have a password');
            $(tableRow).click(function (){
                joinRoom(roomName);
            });
        }
    }
});

// handles edit username form submission
function editUsername(submit){
    const form = document.getElementById("editUsername");
    submit.preventDefault(); // prevent default form refresh upon submission
    if(form.checkValidity()){
        // changed username
        const username = document.getElementById("editUsername-field").value;

        // remove previous event listeners
        socket.off('username_availability_result');

        socket.emit('check_username_availability', {username});
    
        socket.on('username_availability_result', function(data){
            if(data.available){
                // username is available --> change username success!
                $('#roomList-username span').text(username);
            }else{
                // username is currently taken
                $('#warning-editUsername h6').text(`Username ${username} is already taken`);
                $('#warning-editUsername').show();
            }
        });
    }else{
        form.reportValidity();
    }
}

// handles leaving room
function leaveRoom(){
    // leave room logic 
    console.log(`left room`);
    socket.emit('leave_room');
    displayPage('#page2-roomList');
}

// handles create room form submission
function createRoom(submit){
    const form = document.getElementById("createRoomForm");
    submit.preventDefault(); // prevent default form refresh upon submission

    if(form.checkValidity()){
        const roomName = document.getElementById('createRoom-name').value;
        const password = document.getElementById('createRoom-password').value;  // optional
        const maxSize = document.getElementById('createRoom-maxSize').value;    // optional


        //remove previous event listeners
        socket.off('create_room_result');

        socket.emit('create_room', { roomName, password, maxSize });

        socket.on('create_room_result', function(data){
            console.log(data);
            if(data.available){
                // room name is available --> create room success!
                $('#createRoomModal').modal('hide');
                displayPage('#page3-chatRoom');
            }else{
                // room name is currently taken
                $('#warning-add h6').text(`Room ${roomName} already exists.`);
                $('#warning-add').show();
            }
        });
    }else{
        form.reportValidity();
    }
}

// handles sign up form submission
function signout(){
    const username = socket.username;

    // remove previous event listeners
    socket.off('signedOut');

    socket.emit('signOut', {username});
    
    socket.on('signedOut', function(){
        displayPage('#page1-signIn');
    });
}

// handles sign up form submission
function signup(submit){
    const form = document.getElementById("signIn");
    submit.preventDefault(); // prevent default form refresh upon submission
    if(form.checkValidity()){
        const username = document.getElementById("signIn-name").value;

        // remove previous event listeners
        socket.off('username_availability_result');

        socket.emit('check_username_availability', {username});
    
        socket.on('username_availability_result', function(data){
            if(data.available){
                // username is available --> sign in success!
                $('#roomList-username span').text(username);
                socket.username = username;
                displayPage('#page2-roomList');
            }else{
                // username is currently taken
                $('#warning-signIn h6').text(`Username ${username} is already taken`);
                $('#warning-signIn').show();
            }
        });
    }else{
        form.reportValidity();
    }
}

// pre: user signs out, signs in, or enters some form data and leaves without submitting
// post: resets form to blank state
function resetForms(){
    const signInForm = document.getElementById("signIn");
    const createRoomForm = document.getElementById("createRoomForm");
    const editUsernameForm = document.getElementById('editUsername');
    const roomPasswordForm = document.getElementById('passwordForm');
    const sendMessageForm = document.getElementById('sendMessage');
    signInForm.reset();
    createRoomForm.reset();
    editUsernameForm.reset();
    roomPasswordForm.reset();
    sendMessageForm.reset();
}

// hides all pages EXCEPT the page to display
function displayPage(pageID){
    $('#page1-signIn, #page2-roomList, #page3-chatRoom, .warning').hide();
    $(pageID).show();
}

// event listeners

$('#signIn-submit').click(function(submit){
    signup(submit);
    resetForms();
    socket.off('check_username_availability');
});

$('#editUsername-submit').click(function(submit){
    $('#warning-editUsername').hide();
    editUsername(submit);
    resetForms();
});

$('#sign-out').click(function(){
    signout();
});

$('#createRoom-submit').click(function(submit){
    $('#warning-add').hide();
    createRoom(submit);
    resetForms();
});

$('#sendMessage-submit').click(function(submit){
    // $('#warning-add').hide();
    sendMessage(submit);
});

$('#leave').click(function(){
    leaveRoom();
});

// styling
// note: you're gonna have to put this in the method for when we click on the userActionModal
const buttonContainer = document.getElementById("userActionModalBody");
const buttons = buttonContainer.querySelectorAll(".btn");

// calculate width of each button based on number of buttons
const width = (100 / buttons.length) - 1;

buttons.forEach(button => {
    button.style.width = width + "%";
});



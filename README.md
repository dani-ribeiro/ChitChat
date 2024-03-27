[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-24ddc0f5d75046c5622901739e7c5dd533143b0c8e959d652212380cedb1ea36.svg)](https://classroom.github.com/a/OiggXh1o)
# CSE330
# Author: Daniel Ribeiro d.d.ribeiro@wustl.edu, ID: 511148, GitHub: dani-ribeiro

### Link:
* When Node.js is up and running on the instance, the Chat Server is served here: http://ec2-44-201-138-135.compute-1.amazonaws.com:3456/client.html. Otherwise, locally run here: http://localhost:3456/client.html

* Ease Of Use (Basic Features):
    * Sign In: Type a username and press Chat to sign in.
    * Sign Out: Sign In --> Click on Sign Out
    * Create Room: Sign In --> Click on Create Room --> Enter Room Details --> Create
    * Join Room: Sign In --> In the table of rooms, click on the row of the room you want to join
    * Messages: Sign In --> Create/Join Room --> Type messages at the bottom of the page --> Click > to send message
        - Public Messages: Type any message and send
        - Private Messages: Type !pm [recipient username] [message]
            - Example: !pm Daniel Hi will send a private message "Hi" to a user named Daniel IF they are in the room
        - Help Messages: Type !help to read a usage message (basically what I just typed above)
    * Kick User: Sign In --> Create Room --> Have another user join the room --> As a creator, click on the username you want to kick (left side) --> Kick
    * Ban User: Sign In --> Create Room --> Have another user join the room --> As a creator, click on the username you want to ban (left side) --> Ban
    * Leave Room: Sign In --> Create/Join Room --> Click Leave (bottom left corner)

### Creative Portion:
* Admin privileges. The creator of the room can assign admins to the room to create a distribution of power. This allows for chat room moderation even when the creator of the room is offline.
    1. Creator: Kick/Ban/Admin/Unadmin any user in the room.
    2. Admin User: Kick/Ban any regular user (non-creator, non-admin)
    3. Regular User: Nothing. Just chat and have fun.
    * How to access:
        * Creator Roles: Sign In --> Create a room --> You now have creator roles --> Have another user join the room --> Click their username --> Kick/Ban/Admin/Unadmin (Unadmin is only an option if the user clicked on is an admin)
        * Admin Roles: Sign In --> Join a room --> Have the creator of the room give you admin --> Have a regular user join the room --> Kick/Ban
        * Regular Roles: Sign In --> Join a room --> Click on anybody's username --> Notice nothing happens.

* Maximum Room Capacity. When creating a room, creators can optionally specify a maximum room size for their room. This will prevent other users from joining the room when at maximum capacity. However, if you wish to create a room with no maximum size, you can! Just don't type anything in the maximum room size field. That way it will be processed as "Unlimited" space.

* Room Invitations. Users in a room can invite other users to join the room.
    * Note: I have designed this feature such that room invitations bypass password-protected rooms. This means, if a user is invited to a password-protected room, they can simply accept the invitation and join without entering a password. I figured this makes sense because they are being invited by a trusted user who is already in the room.
    * How to access:
        * Sign In --> Create/Join a room --> Click Invite (bottom left corner, above Leave) --> Type the username of the user you wish to invite --> Invite
        * Now, if the user you invited actually exists, and they're not already in a room, you should see that the invite modal disappeared. The user you invited to the room should have received an invitation to the room --> Accept/Reject the invitation

* Change Nickname. Users are able to change their nicknames after signing in.
    * How to access:
        * Sign In --> Right side of screen has an Avatar section --> Click your username (has a pencil icon next to it) --> Type a new username --> Click Change

## Repository Contents
* [client.html](client.html): Chat room web page

* [chat-server.js](chat-server.js): Node.js server and server-side functionality

* [display.js](display.js): Client-side functionality

* [static](static): All images used

* [style.css](style.css): Stylesheet 

* [package.json](package.json), [package-lock.json](package-lock.json): App Dependencies

### Web Server Contents 
* Same contents as above [Repository Contents](#repository-contents)
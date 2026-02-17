// server.js
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

console.log("服务器启动在端口:", PORT);

let users = {};   // { username: { password, socket, friends: [] } }
let groups = {};  // { groupName: [username,...] }

// 发送 JSON 消息
function sendTo(socket, type, data) {
    socket.send(JSON.stringify({ type, data }));
}

// 群组广播
function broadcastToGroup(groupName, fromUser, msg) {
    if (!groups[groupName]) return;
    groups[groupName].forEach(username => {
        const user = users[username];
        if (user && user.socket && user.socket.readyState === WebSocket.OPEN) {
            sendTo(user.socket, "group_msg", { from: fromUser, group: groupName, msg });
        }
    });
}

// 私聊
function sendPrivate(fromUser, toUser, msg) {
    const user = users[toUser];
    if (user && user.socket && user.socket.readyState === WebSocket.OPEN) {
        sendTo(user.socket, "private_msg", { from: fromUser, msg });
    }
}

wss.on("connection", ws => {
    let currentUser = null;

    ws.on("message", message => {
        let data;
        try { data = JSON.parse(message); } catch { return; }

        switch(data.type) {
            case "register":
                if (users[data.username]) {
                    sendTo(ws, "register", { success: false, msg: "用户名已存在" });
                } else {
                    users[data.username] = { password: data.password, socket: null, friends: [] };
                    sendTo(ws, "register", { success: true });
                }
                break;

            case "login":
                const user = users[data.username];
                if (!user || user.password !== data.password) {
                    sendTo(ws, "login", { success: false, msg: "用户名或密码错误" });
                } else {
                    currentUser = data.username;
                    user.socket = ws;
                    sendTo(ws, "login", { success: true, friends: user.friends, groups: Object.keys(groups).filter(g => groups[g].includes(currentUser)) });
                }
                break;

            case "add_friend":
                if (users[data.friend] && currentUser) {
                    if (!users[currentUser].friends.includes(data.friend))
                        users[currentUser].friends.push(data.friend);
                    sendTo(ws, "add_friend", { success: true, friend: data.friend });
                }
                break;

            case "create_group":
                if (!groups[data.group]) {
                    groups[data.group] = [currentUser];
                    sendTo(ws, "create_group", { success: true, group: data.group });
                }
                break;

            case "join_group":
                if (groups[data.group] && !groups[data.group].includes(currentUser)) {
                    groups[data.group].push(currentUser);
                    sendTo(ws, "join_group", { success: true, group: data.group });
                }
                break;

            case "group_msg":
                if (currentUser) {
                    broadcastToGroup(data.group, currentUser, data.msg);
                }
                break;

            case "private_msg":
                if (currentUser) {
                    sendPrivate(currentUser, data.to, data.msg);
                }
                break;

            default:
                break;
        }
    });

    ws.on("close", () => {
        if (currentUser && users[currentUser]) {
            users[currentUser].socket = null;
        }
    });
});

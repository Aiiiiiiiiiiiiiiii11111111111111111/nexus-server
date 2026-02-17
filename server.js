const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

let history = [];

console.log("服务器启动在端口:", PORT);

wss.on("connection", (ws) => {

    history.forEach(msg => ws.send(msg));

    ws.on("message", (message) => {

        const text = message.toString();

        if (text === "/purge") {
            history = [];
            broadcast("系统: 聊天已清空");
            return;
        }

        history.push(text);
        broadcast(text);
    });
});

function broadcast(msg) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}

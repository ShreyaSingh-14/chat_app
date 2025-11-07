const express = require("express");
const path = require("path");
const WebSocket = require("ws");

const app = express();
const PORT = 3000;

// serve static files from /public
app.use(express.static(path.join(__dirname, "public")));

const server = app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);

// websocket server
const wss = new WebSocket.Server({ server });

// Track typing users
const typingUsers = new Map();

wss.on("connection", (ws) => {
  console.log("✅ New client connected");

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case "message":
          console.log(`📩 Message from ${message.user}: ${message.content}`);
          // Broadcast message to all clients
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(message));
            }
          });
          break;
          
        case "typing_start":
          console.log(`⌨️  ${message.user} is typing...`);
          typingUsers.set(message.user, true);
          // Broadcast typing indicator to other clients (not sender)
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN && client !== ws) {
              client.send(JSON.stringify({
                type: "typing_start",
                user: message.user
              }));
            }
          });
          break;
          
        case "typing_stop":
          console.log(`⏹️  ${message.user} stopped typing`);
          typingUsers.delete(message.user);
          // Broadcast typing stop to other clients (not sender)
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN && client !== ws) {
              client.send(JSON.stringify({
                type: "typing_stop",
                user: message.user
              }));
            }
          });
          break;
          
        default:
          // Handle legacy format (backward compatibility)
          console.log(`📩 Legacy message: ${data}`);
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(data.toString());
            }
          });
      }
    } catch (error) {
      // Handle non-JSON messages (legacy format)
      console.log(`📩 Legacy message: ${data}`);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data.toString());
        }
      });
    }
  });

  ws.on("close", () => {
    console.log("❌ Client disconnected");
    // Clean up any typing indicators for this connection
    typingUsers.forEach((value, user) => {
      // Broadcast typing stop for any users that were typing from this connection
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: "typing_stop",
            user: user
          }));
        }
      });
    });
  });
});

// Cleanup typing indicators periodically (in case of network issues)
setInterval(() => {
  if (typingUsers.size > 0) {
    console.log(`🔄 Currently typing: ${Array.from(typingUsers.keys()).join(", ")}`);
  }
}, 10000); // Log every 10 seconds if someone is typing
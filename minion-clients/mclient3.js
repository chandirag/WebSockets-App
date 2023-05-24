const WebSocket = require('ws');

const minionType = 3;

function connectWebSocket() {
  const ws = new WebSocket('ws://localhost:8080');

  ws.on('open', () => {
    ws.send(JSON.stringify({
      messageType: 'connection',
      type: minionType,
    }));
    console.log(new Date(), `Connection to server established.`)
  });

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    const { messageType, type, message: targetMessage } = data;

    if (messageType === 'message' && type === 'master') {
      console.log(new Date(), `Received message from server: ${targetMessage}`);

      // Send a response to the server
      ws.send(JSON.stringify({
        messageType: 'message',
        type: minionType,
        message: `Response from Minion 3: ${targetMessage}`,
        balance: 30
      }));
    }
  });

  ws.on('error', (error) => {
    console.error(new Date(), 'Error connecting to server. Server may be down. Retrying in 2 seconds...');
  });

  ws.on('close', () => {
    console.log(new Date(), 'Connection closed. Attempting to reconnect...');
    setTimeout(connectWebSocket, 2000); // Wait for 2 seconds before attempting to reconnect
  });
}

connectWebSocket();

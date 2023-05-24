const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Create a WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Track connected clients
const connectedClients = new Map();

// Track overall balance sum
let balanceSum = 0;

wss.on('connection', (ws) => {
    const clientID = uuidv4();

    ws.on('message', (message) => {
        const parsedMessage = JSON.parse(message);
        const { messageType, type } = parsedMessage;

        // Handle connection requests from clients
        if (messageType === 'connection') {
            if (type === 'master') {
                handleMasterClientConnect(ws, clientID);
            } else {
                handleMinionConnect(ws, type, clientID);
            }
        }

        // Listen for messages from master clients
        if (messageType === 'message' && type === 'master') {
            const data = JSON.parse(message);
            const { targetMinion, message: targetMessage } = data;

            console.log(new(Date), `Received message from master client: '${targetMessage}' for Minion Type: ${targetMinion}`);

            // Get all connected clients matching the target minion type
            let clients = [...connectedClients.values()].filter((client) => client.type == targetMinion);

            // If target minion type is 0 (all minions), send the message to all connected clients
            if (targetMinion == 0) {
                clients = [...connectedClients.values()];
            }

            // Send the message to all connected clients matching the target minion type
            clients.forEach((client) => {
                client.ws.send(JSON.stringify({
                    messageType: 'message',
                    type: 'master',
                    message: targetMessage,
                }));
            });
        }

        // Listen for responses from minions
        if (messageType === 'message' && type !== 'master') {
            const data = JSON.parse(message);
            const { message: targetMessage, balance } = data;
            balanceSum += balance;
            console.log(new(Date), `Received response from minion: '${targetMessage}' from Minion Type: ${type} | BALANCE = ${balance}`);

            // Send message to the master clients
            const masterClients = [...connectedClients.values()].filter((client) => client.type === 'master');
            masterClients.forEach((client) => {
                const currentDate = new Date().toLocaleString(undefined, {
                    dateStyle: 'short',
                    timeStyle: 'short'
                });
                client.ws.send(JSON.stringify({
                    messageType: 'response',
                    type: type,
                    message: `${currentDate} | Received ${targetMessage} | BALANCE = ${balance}`,
                }));
            });
            broadcastBalanceSum();
        }
    });
    
    ws.on('close', () => {
        handleClientDisconnect(clientID);
    });
});


function broadcastBalanceSum() {
    // Get list of connected master clients
    const connectedMasterClients = Array.from(connectedClients.values())
        .filter(({ type }) => type === 'master')
        .map(({ ws }) => ws);

    // Send message to master clients indicating the balance sum
    connectedMasterClients.forEach((ws) => {
        ws.send(JSON.stringify({
            messageType: 'balance-sum',
            balanceSum: balanceSum,
        }));
    });
}


function broadcastConnectedClientsList() {
    // Get list of connected minions with their types and counts
    const connectedMinions = Array.from(connectedClients.values())
        .filter(({ type }) => type !== 'master')
        .reduce((minions, { type }) => {
        if (minions[type]) {
            minions[type]++;
        } else {
            minions[type] = 1;
        }
        return minions;
        }, {});

    // Get list of connected master clients
    const connectedMasterClients = Array.from(connectedClients.values())
        .filter(({ type }) => type === 'master')
        .map(({ ws }) => ws);

    // Send message to master clients indicating which minions are connected
    connectedMasterClients.forEach((ws) => {
        ws.send(JSON.stringify({
            messageType: 'connected-clients',
            connectedClients: connectedMinions,
        }));
    });
}


function handleMinionConnect(ws, minionType, clientID) {
    connectedClients.set(clientID, {
        ws,
        type: minionType,
    });
    console.log(new(Date), `Minion ${minionType} connected: ${clientID}`);
    broadcastConnectedClientsList();
}


function handleMasterClientConnect(ws, clientID) {
    connectedClients.set(clientID, {
        ws,
        type: 'master',
    });
    console.log(new(Date), `Master client connected: ${clientID}`);
    broadcastConnectedClientsList();
}


function handleClientDisconnect(clientID) {
    const { type } = connectedClients.get(clientID);
    connectedClients.delete(clientID);

    if (type === 'master') {
        console.log(new(Date), `Master client disconnected: ${clientID}`);
    } else {
        console.log(new(Date), `Minion ${type} disconnected: ${clientID}`);
    }

    broadcastConnectedClientsList();
}

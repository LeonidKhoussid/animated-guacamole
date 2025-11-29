// WebSocket utility for streaming AI responses
export const createWebSocketHandler = (fastify) => {
  return async (connection, request) => {
    const { requestId } = request.params;
    
    connection.socket.on('message', (message) => {
      // Handle incoming messages if needed
      console.log('Received message:', message.toString());
    });

    connection.socket.on('close', () => {
      console.log('WebSocket closed');
    });

    // Return connection for use in services
    return connection;
  };
};

// Send message to WebSocket client
export const sendWebSocketMessage = (connection, type, data) => {
  if (connection && connection.socket && connection.socket.readyState === 1) {
    connection.socket.send(JSON.stringify({ type, data }));
  }
};



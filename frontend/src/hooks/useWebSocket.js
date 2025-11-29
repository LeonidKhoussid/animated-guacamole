import { useEffect, useRef, useState, useCallback } from 'react';

export const useWebSocket = (url, onMessage) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const onMessageRef = useRef(onMessage);

  // Keep onMessage ref updated
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!url) {
      setIsConnected(false);
      setError(null);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setError('No authentication token');
      return;
    }

    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
    const wsBaseUrl = baseUrl.replace('http', 'ws').replace('https', 'wss');
    const separator = url.includes('?') ? '&' : '?';
    const wsUrl = `${wsBaseUrl}${url}${separator}token=${token}`;

    console.log('Connecting to WebSocket:', wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onMessageRef.current) {
          onMessageRef.current(data);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      setError('WebSocket connection error');
    };

    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setIsConnected(false);
      if (event.code !== 1000) {
        setError('WebSocket connection closed unexpectedly');
      }
    };

    wsRef.current = ws;

    return () => {
      if (wsRef.current) {
        console.log('Closing WebSocket connection');
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, [url]);

  const sendMessage = (message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  const close = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  return { isConnected, error, sendMessage, close };
};


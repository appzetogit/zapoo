import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { API_BASE_URL } from '@/lib/api/config';
import { deliveryAPI } from '@/lib/api';
import alertSound from '@/assets/audio/alert.mp3';
import originalSound from '@/assets/audio/original.mp3';
export const useDeliveryNotifications = () => {
  // CRITICAL: All hooks must be called unconditionally and in the same order every render
  // Order: useRef -> useState -> useEffect -> useCallback

  // Step 1: All refs first (unconditional)
  const socketRef = useRef(null);
  const audioRef = useRef(null);
  const deliveryPartnerIdRef = useRef(null);

  // Step 2: All state hooks (unconditional)
  const [newOrder, setNewOrder] = useState(null);
  const [orderReady, setOrderReady] = useState(null);
  const [orderTaken, setOrderTaken] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [deliveryPartnerId, setDeliveryPartnerId] = useState(null);
  const debugSessionRef = useRef(Math.random().toString(36).slice(2, 8));

  const debugLog = useCallback((message, data) => {
    const ts = new Date().toISOString();
    if (data !== undefined) {
      console.warn(`[DeliverySocketDebug][${debugSessionRef.current}][${ts}] ${message}`, data);
      return;
    }
    console.warn(`[DeliverySocketDebug][${debugSessionRef.current}][${ts}] ${message}`);
  }, []);

  // Step 3: All callbacks before effects (unconditional)
  // Track user interaction for autoplay policy
  const userInteractedRef = useRef(false);
  const stopNotificationSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      debugLog('Notification sound stopped');
    }
  }, [debugLog]);

  const isDeliveryPartnerOnline = useCallback(() => {
    try {
      const appOnlineStatusRaw = localStorage.getItem('app:isOnline');
      if (appOnlineStatusRaw != null) {
        return JSON.parse(appOnlineStatusRaw) === true;
      }
      return localStorage.getItem('delivery_online_status') === 'true';
    } catch {
      return false;
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      if (!isDeliveryPartnerOnline()) {
        debugLog('Skipping sound: delivery partner is offline');
        stopNotificationSound();
        return;
      }

      // Get current selected sound preference from localStorage
      const storedSound = localStorage.getItem('delivery_alert_sound');
      const selectedSound = storedSound === 'zomato_tone' ? 'zapoo_tone' : (storedSound || 'zapoo_tone');
      const soundFile = selectedSound === 'original' ? originalSound : alertSound;

      // Update audio source if preference changed or initialize if not exists
      if (audioRef.current) {
        const currentSrc = audioRef.current.src;
        const newSrc = soundFile;
        // Check if source needs to be updated
        if (!currentSrc.includes(newSrc.split('/').pop())) {
          audioRef.current.pause();
          audioRef.current.src = newSrc;
          audioRef.current.load();
        }
      } else {
        // Initialize audio if not exists
        audioRef.current = new Audio(soundFile);
        audioRef.current.volume = 0.7;
      }
      if (audioRef.current) {
        // Only play if user has interacted with the page (browser autoplay policy)
        if (!userInteractedRef.current) {
          debugLog('Skipping sound: browser interaction not detected yet');
          return;
        }
        audioRef.current.currentTime = 0;
        debugLog('Attempting to play notification sound', {
          selectedSound
        });
        audioRef.current.play().catch(error => {
          // Don't log autoplay policy errors as they're expected
          if (!error.message?.includes('user didn\'t interact') && !error.name?.includes('NotAllowedError')) {
            console.warn('Error playing notification sound:', error);
            debugLog('Sound play failed', {
              message: error?.message,
              name: error?.name
            });
          } else {
            debugLog('Sound blocked by browser autoplay policy');
          }
        });
      }
    } catch (error) {
      // Don't log autoplay policy errors
      if (!error.message?.includes('user didn\'t interact') && !error.name?.includes('NotAllowedError')) {
        console.warn('Error playing sound:', error);
        debugLog('Unexpected sound error', {
          message: error?.message,
          name: error?.name
        });
      }
    }
  }, [debugLog, isDeliveryPartnerOnline, stopNotificationSound]);

  // Step 4: All effects (unconditional hook calls, conditional logic inside)
  // Track user interaction for autoplay policy
  useEffect(() => {
    deliveryPartnerIdRef.current = deliveryPartnerId;
    debugLog('deliveryPartnerId updated', {
      deliveryPartnerId
    });
  }, [debugLog, deliveryPartnerId]);

  useEffect(() => {
    const handleUserInteraction = () => {
      userInteractedRef.current = true;
      debugLog('User interaction detected, sound autoplay unlocked');
      // Remove listeners after first interaction
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };

    // Listen for user interaction
    document.addEventListener('click', handleUserInteraction, {
      once: true
    });
    document.addEventListener('touchstart', handleUserInteraction, {
      once: true
    });
    document.addEventListener('keydown', handleUserInteraction, {
      once: true
    });
    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
    };
  }, []);

  // Initialize audio on mount - use selected preference from localStorage
  useEffect(() => {
    // Get selected alert sound preference from localStorage
    const storedSound = localStorage.getItem('delivery_alert_sound');
    const selectedSound = storedSound === 'zomato_tone' ? 'zapoo_tone' : (storedSound || 'zapoo_tone');
    const soundFile = selectedSound === 'original' ? originalSound : alertSound;
    if (!audioRef.current) {
      audioRef.current = new Audio(soundFile);
      audioRef.current.volume = 0.7;
      debugLog('Audio initialized', {
        selectedSound
      });
    } else {
      // Update audio source if preference changed
      const currentSrc = audioRef.current.src;
      const newSrc = soundFile;
      if (!currentSrc.includes(newSrc.split('/').pop())) {
        audioRef.current.pause();
        audioRef.current.src = newSrc;
        audioRef.current.load();
        debugLog('Audio source updated', {
          selectedSound
        });
      }
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        debugLog('Audio destroyed on cleanup');
      }
    };
  }, [debugLog]); // Note: This runs once on mount. To update dynamically, we'd need to listen to storage events

  // Fetch delivery partner ID
  useEffect(() => {
    const extractId = (obj) => {
      if (!obj) return null;
      return obj.id?.toString() || obj._id?.toString() || obj.deliveryId || null;
    };

    const readIdFromKnownStorage = () => {
      const parseSafe = (raw) => {
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      };

      // Legacy/local fallback keys
      const deliveryUser = parseSafe(localStorage.getItem('delivery_user'));
      const deliveryAuthData = parseSafe(sessionStorage.getItem('deliveryAuthData'));

      const candidates = [
        deliveryUser,
        deliveryAuthData,
        deliveryAuthData?.user,
        deliveryAuthData?.delivery,
        deliveryAuthData?.deliveryPartner,
        deliveryAuthData?.data,
        deliveryAuthData?.data?.user,
        deliveryAuthData?.data?.deliveryPartner
      ];

      for (const candidate of candidates) {
        const id = extractId(candidate);
        if (id) return id;
      }

      return null;
    };

    const readIdFromToken = () => {
      const token = localStorage.getItem('delivery_accessToken') || localStorage.getItem('accessToken');
      if (!token) return null;
      try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        return payload?.userId?.toString?.() || payload?.id?.toString?.() || payload?._id?.toString?.() || payload?.sub?.toString?.() || null;
      } catch {
        return null;
      }
    };

    const fetchDeliveryPartnerId = async () => {
      // Set an immediate fallback ID first so socket can join room even if /me is delayed/fails.
      const immediateId = readIdFromKnownStorage() || readIdFromToken();
      if (immediateId) {
        debugLog('Setting delivery ID from immediate fallback', {
          immediateId
        });
        setDeliveryPartnerId(immediateId);
      }

      try {
        const response = await deliveryAPI.getCurrentDelivery();
        if (response.data?.success && response.data.data) {
          const deliveryPartner = response.data.data.user || response.data.data.deliveryPartner;
          const id = extractId(deliveryPartner);
          if (id) {
            debugLog('Setting delivery ID from /delivery/auth/me', {
              id
            });
            setDeliveryPartnerId(id);
            return;
          }
          console.warn('⚠️ Could not extract delivery partner ID from API response');
        } else {
          console.warn('⚠️ Could not fetch delivery partner ID from API');
        }
      } catch (error) {
        console.error('Error fetching delivery partner:', error);
      }

      // Final fallback chain if API failed/no ID
      const fallbackId = readIdFromKnownStorage() || readIdFromToken();
      if (fallbackId) {
        console.warn('⚠️ Using delivery ID from storage/token fallback');
        debugLog('Setting delivery ID from final fallback', {
          fallbackId
        });
        setDeliveryPartnerId(fallbackId);
      } else {
        debugLog('Failed to resolve delivery ID from API and all fallbacks');
      }
    };
    fetchDeliveryPartnerId();
  }, [debugLog]);

  // Socket connection effect
  useEffect(() => {
    // Normalize backend URL - use simpler, more robust approach
    let backendUrl = API_BASE_URL;

    // Step 1: Extract protocol and hostname using URL parsing if possible
    try {
      const urlObj = new URL(backendUrl);
      // Remove /api from pathname
      let pathname = urlObj.pathname.replace(/^\/api\/?$/, '');
      // Reconstruct clean URL
      const hostname = urlObj.hostname === 'localhost' ? '127.0.0.1' : urlObj.hostname;
      backendUrl = `${urlObj.protocol}//${hostname}${urlObj.port ? `:${urlObj.port}` : ''}${pathname}`;
    } catch (e) {
      // If URL parsing fails, use regex-based normalization
      // Remove /api suffix first
      backendUrl = backendUrl.replace(/\/api\/?$/, '');
      backendUrl = backendUrl.replace(/\/+$/, ''); // Remove trailing slashes

      // Normalize protocol - ensure exactly two slashes after protocol
      // Fix patterns: https:/, https:///, https://https://
      if (backendUrl.startsWith('https:') || backendUrl.startsWith('http:')) {
        // Extract protocol
        const protocolMatch = backendUrl.match(/^(https?):/i);
        if (protocolMatch) {
          const protocol = protocolMatch[1].toLowerCase();
          // Remove everything up to and including the first valid domain part
          const afterProtocol = backendUrl.substring(protocol.length + 1);
          // Remove leading slashes
          const cleanPath = afterProtocol.replace(/^\/+/, '');
          // Reconstruct with exactly two slashes
          backendUrl = `${protocol}://${cleanPath}`;
        }
      }
    }

    // Final cleanup: ensure exactly two slashes after protocol
    backendUrl = backendUrl.replace(/^(https?):\/+/gi, '$1://');
    backendUrl = backendUrl.replace(/\/+$/, ''); // Remove trailing slashes

    // Avoid IPv6 localhost resolution issues in some browsers
    backendUrl = backendUrl.replace('://localhost', '://127.0.0.1');

    const socketUrl = `${backendUrl}/delivery`;
    console.warn('[DeliverySocket] init', { socketUrl, deliveryPartnerId, API_BASE_URL });
    debugLog('Socket effect init', {
      socketUrl,
      deliveryPartnerId,
      API_BASE_URL
    });
    // Warn if trying to connect to localhost in production
    if (import.meta.env.MODE === 'production' && backendUrl.includes('localhost')) {
      console.error('❌ CRITICAL: Trying to connect Socket.IO to localhost in production!');
      console.error('💡 This means VITE_API_BASE_URL was not set during build time');
      console.error('💡 Current socketUrl:', socketUrl);
      console.error('💡 Current API_BASE_URL:', API_BASE_URL);
      console.error('💡 Fix: Rebuild frontend with: VITE_API_BASE_URL=https://your-backend-domain.com/api npm run build');
      console.error('💡 Note: Vite environment variables are embedded at BUILD TIME, not runtime');
      console.error('💡 You must rebuild and redeploy the frontend with correct VITE_API_BASE_URL');

      // Don't try to connect to localhost in production - it will fail
      setIsConnected(false);
      return;
    }

    // Validate backend URL format
    if (!backendUrl || !backendUrl.startsWith('http')) {
      console.error('❌ CRITICAL: Invalid backend URL format:', backendUrl);
      console.error('💡 API_BASE_URL:', API_BASE_URL);
      console.error('💡 Expected format: https://your-domain.com or http://localhost:5000');
      return; // Don't try to connect with invalid URL
    }

    // Validate socket URL format
    try {
      new URL(socketUrl); // This will throw if URL is invalid
    } catch (urlError) {
      console.error('❌ CRITICAL: Invalid Socket.IO URL:', socketUrl);
      console.error('💡 URL validation error:', urlError.message);
      console.error('💡 Backend URL:', backendUrl);
      console.error('💡 API_BASE_URL:', API_BASE_URL);
      return; // Don't try to connect with invalid URL
    }
    if (socketRef.current) {
      debugLog('Socket instance already exists', {
        connected: socketRef.current.connected,
        deliveryPartnerId
      });
      if (deliveryPartnerId) {
        if (socketRef.current.connected) {
          debugLog('Emitting join-delivery on existing connected socket', {
            deliveryPartnerId
          });
          socketRef.current.emit('join-delivery', deliveryPartnerId);
        } else {
          debugLog('Socket exists but disconnected, forcing connect()');
          socketRef.current.connect();
        }
      }
      return;
    }

    socketRef.current = io(socketUrl, {
      path: '/socket.io/',
      transports: ['polling'],
      // Start with polling only
      upgrade: false,
      // Disable WebSocket upgrade to prevent WebSocket connection errors
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      forceNew: false,
      autoConnect: true,
      auth: {
        token: localStorage.getItem('delivery_accessToken') || localStorage.getItem('accessToken')
      }
    });
    socketRef.current.on('connect', () => {
      setIsConnected(true);
      debugLog('Socket connected', {
        socketId: socketRef.current?.id,
        transport: socketRef.current?.io?.engine?.transport?.name
      });
      const latestId = deliveryPartnerIdRef.current;
      if (latestId) {
        debugLog('Emitting join-delivery after connect', {
          latestId
        });
        socketRef.current.emit('join-delivery', latestId);
      } else {
        debugLog('connect event but latest delivery ID is null');
      }
    });
    socketRef.current.on('delivery-room-joined', data => {
      debugLog('delivery-room-joined ack received', data);
    });
    socketRef.current.on('connect_error', error => {
      // Only log if it's not a network/polling/websocket error (backend might be down or WebSocket not available)
      // Socket.IO will automatically retry connection and fall back to polling
      const isTransportError = error.type === 'TransportError' || error.message === 'xhr poll error' || error.message?.includes('WebSocket') || error.message?.includes('websocket') || error.description === 0; // WebSocket upgrade failures

      if (!isTransportError) {
        console.error('❌ Delivery Socket connection error:', error);
        debugLog('connect_error', {
          message: error?.message,
          type: error?.type,
          description: error?.description
        });
      } else {
        // Silently handle transport errors - backend might not be running or WebSocket not available
        // Socket.IO will automatically retry with exponential backoff and fall back to polling
        // Only log in development for debugging
        if (process.env.NODE_ENV === 'development') {}
        debugLog('Transport-level connect_error (expected fallback case)', {
          message: error?.message,
          type: error?.type
        });
      }
      setIsConnected(false);
    });
    socketRef.current.on('disconnect', reason => {
      setIsConnected(false);
      debugLog('Socket disconnected', {
        reason
      });
      if (reason === 'io server disconnect') {
        debugLog('Server forced disconnect, reconnecting manually');
        socketRef.current.connect();
      }
    });
    socketRef.current.on('reconnect_attempt', attemptNumber => {
      debugLog('Reconnect attempt', {
        attemptNumber
      });
    });
    socketRef.current.on('reconnect', attemptNumber => {
      setIsConnected(true);
      debugLog('Socket reconnected', {
        attemptNumber
      });
      const latestId = deliveryPartnerIdRef.current;
      if (latestId) {
        debugLog('Emitting join-delivery after reconnect', {
          latestId
        });
        socketRef.current.emit('join-delivery', latestId);
      } else {
        debugLog('reconnect event but latest delivery ID is null');
      }
    });
    socketRef.current.on('new_order', orderData => {
      debugLog('new_order received', {
        orderId: orderData?.orderId,
        orderMongoId: orderData?.orderMongoId,
        status: orderData?.status
      });
      if (!isDeliveryPartnerOnline()) {
        debugLog('Ignoring new_order: delivery partner offline');
        stopNotificationSound();
        return;
      }
      setNewOrder(orderData);
      playNotificationSound();
    });

    // Listen for priority-based order notifications (new_order_available)
    socketRef.current.on('new_order_available', orderData => {
      debugLog('new_order_available received', {
        orderId: orderData?.orderId,
        phase: orderData?.phase,
        status: orderData?.status
      });
      if (!isDeliveryPartnerOnline()) {
        debugLog('Ignoring new_order_available: delivery partner offline');
        stopNotificationSound();
        return;
      }
      // Treat it the same as new_order for now - delivery boy can accept it
      setNewOrder(orderData);
      playNotificationSound();
    });
    socketRef.current.on('order_taken', data => {
      debugLog('order_taken received', data);
      stopNotificationSound();
      setOrderTaken(data);
    });
    socketRef.current.on('play_notification_sound', data => {
      debugLog('play_notification_sound received', data);
      if (!isDeliveryPartnerOnline()) {
        debugLog('Ignoring play_notification_sound: delivery partner offline');
        stopNotificationSound();
        return;
      }
      playNotificationSound();
    });
    socketRef.current.on('order_ready', orderData => {
      debugLog('order_ready received', {
        orderId: orderData?.orderId,
        mongoId: orderData?.mongoId,
        status: orderData?.status
      });
      if (!isDeliveryPartnerOnline()) {
        debugLog('Ignoring order_ready: delivery partner offline');
        stopNotificationSound();
        return;
      }
      setOrderReady(orderData);
      playNotificationSound();
    });
    return () => {
      debugLog('Socket effect cleanup: disconnecting socket');
      stopNotificationSound();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [debugLog, deliveryPartnerId, isDeliveryPartnerOnline, playNotificationSound, stopNotificationSound]);

  // Helper functions
  const clearNewOrder = () => {
    stopNotificationSound();
    setNewOrder(null);
  };
  const clearOrderReady = () => {
    stopNotificationSound();
    setOrderReady(null);
  };
  const clearOrderTaken = () => {
    setOrderTaken(null);
  };
  return {
    newOrder,
    clearNewOrder,
    orderReady,
    clearOrderReady,
    orderTaken,
    clearOrderTaken,
    isConnected,
    playNotificationSound,
    stopNotificationSound
  };
};

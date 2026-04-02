import { useQuery, useMutation, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';

// React Query configuration
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      cacheTime: 5 * 60 * 1000, // 5 minutes
      retry: 3,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Custom hooks for data fetching
export const useLeaderboard = (period: string = 'global') => {
  return useQuery({
    queryKey: ['leaderboard', period],
    queryFn: async () => {
      const response = await fetch(`/api/leaderboard?period=${period}`);
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      return response.json();
    },
    staleTime: period === 'global' ? 60 * 1000 : 30 * 1000, // Global data cached longer
  });
};

export const useUserProfile = (userId: string) => {
  return useQuery({
    queryKey: ['userProfile', userId],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch user profile');
      return response.json();
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
  });
};

export const usePuzzles = (filters: any = {}) => {
  return useQuery({
    queryKey: ['puzzles', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/problems?${params}`);
      if (!response.ok) throw new Error('Failed to fetch puzzles');
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const usePuzzle = (puzzleId: string) => {
  return useQuery({
    queryKey: ['puzzle', puzzleId],
    queryFn: async () => {
      const response = await fetch(`/api/problems/${puzzleId}`);
      if (!response.ok) throw new Error('Failed to fetch puzzle');
      return response.json();
    },
    enabled: !!puzzleId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useSubmissionHistory = (userId: string, limit: number = 10) => {
  return useQuery({
    queryKey: ['submissions', userId, limit],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}/submissions?limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch submission history');
      return response.json();
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
  });
};

// Socket.io hook with connection management
export const useSocket = (serverUrl: string) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const newSocket = io(serverUrl, {
      transports: ['websocket'],
      upgrade: false,
      rememberUpgrade: false,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to server');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from server');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [serverUrl]);

  return { socket, isConnected };
};

// Custom hook for battle state management
export const useBattleState = (roomId: string) => {
  const [battleState, setBattleState] = useState<any>(null);
  const { socket } = useSocket(process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001');

  useEffect(() => {
    if (!socket || !roomId) return;

    socket.emit('join_room', { roomId });

    socket.on('battle:state_update', (state: any) => {
      setBattleState(state);
    });

    socket.on('battle:damage', (damageEvent: any) => {
      setBattleState(prev => ({
        ...prev,
        ...damageEvent,
      }));
    });

    return () => {
      socket.emit('leave_room', { roomId });
      socket.off('battle:state_update');
      socket.off('battle:damage');
    };
  }, [socket, roomId]);

  return battleState;
};

// Mutation hooks
export const useSubmitCode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (submissionData: any) => {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData),
      });
      if (!response.ok) throw new Error('Failed to submit code');
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['submissions', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['userProfile', variables.userId] });
    },
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profileData: any) => {
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });
      if (!response.ok) throw new Error('Failed to update profile');
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['userProfile', variables.userId], data);
    },
  });
};

// Prefetching utilities
export const prefetchPuzzles = (queryClient: QueryClient, filters: any = {}) => {
  queryClient.prefetchQuery({
    queryKey: ['puzzles', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/problems?${params}`);
      if (!response.ok) throw new Error('Failed to fetch puzzles');
      return response.json();
    },
  });
};

export const prefetchLeaderboard = (queryClient: QueryClient, period: string = 'global') => {
  queryClient.prefetchQuery({
    queryKey: ['leaderboard', period],
    queryFn: async () => {
      const response = await fetch(`/api/leaderboard?period=${period}`);
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      return response.json();
    },
  });
};

// Provider component
export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

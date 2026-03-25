import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface FriendProfile {
  id: string;
  displayName: string;
}

export interface Friendship {
  id: string;
  friend: FriendProfile;
  status: 'pending' | 'accepted' | 'declined';
  isIncoming: boolean;
}

export function useFriends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<FriendProfile[]>([]);
  const [searching, setSearching] = useState(false);

  const loadFriends = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from('friendships')
      .select(`
        id, status,
        requester:profiles!requester_id(id, display_name),
        addressee:profiles!addressee_id(id, display_name)
      `)
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .in('status', ['pending', 'accepted']);

    if (data) {
      const mapped: Friendship[] = data.map((row: any) => {
        const isIncoming = row.addressee?.id === user.id;
        const friend = isIncoming ? row.requester : row.addressee;
        return {
          id: row.id,
          friend: { id: friend.id, displayName: friend.display_name },
          status: row.status,
          isIncoming,
        };
      });
      setFriends(mapped);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadFriends();
  }, [loadFriends]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('friendships-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships' },
        () => { loadFriends(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, loadFriends]);

  const searchUsers = useCallback(async (query: string) => {
    if (!user || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name')
      .ilike('display_name', `%${query.trim()}%`)
      .neq('id', user.id)
      .limit(10);

    if (data) {
      setSearchResults(data.map(d => ({ id: d.id, displayName: d.display_name })));
    }
    setSearching(false);
  }, [user]);

  const sendRequest = useCallback(async (addresseeId: string) => {
    if (!user) return;
    await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: addresseeId,
    });
    await loadFriends();
  }, [user, loadFriends]);

  const acceptRequest = useCallback(async (friendshipId: string) => {
    await supabase.from('friendships').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', friendshipId);
    await loadFriends();
  }, [loadFriends]);

  const declineRequest = useCallback(async (friendshipId: string) => {
    await supabase.from('friendships').update({ status: 'declined', updated_at: new Date().toISOString() }).eq('id', friendshipId);
    await loadFriends();
  }, [loadFriends]);

  const acceptedFriends = friends.filter(f => f.status === 'accepted');
  const pendingIncoming = friends.filter(f => f.status === 'pending' && f.isIncoming);
  const pendingSent = friends.filter(f => f.status === 'pending' && !f.isIncoming);

  return {
    friends: acceptedFriends,
    pendingIncoming,
    pendingSent,
    loading,
    searchResults,
    searching,
    searchUsers,
    sendRequest,
    acceptRequest,
    declineRequest,
  };
}

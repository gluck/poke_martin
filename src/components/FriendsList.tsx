import { useState } from 'react';
import { useFriends } from '../hooks/useFriends';
import './FriendsList.css';

export function FriendsList() {
  const {
    friends,
    pendingIncoming,
    pendingSent,
    loading,
    searchResults,
    searching,
    searchUsers,
    sendRequest,
    acceptRequest,
    declineRequest,
  } = useFriends();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchUsers(searchQuery);
  };

  const alreadyFriendOrPending = (userId: string) =>
    friends.some(f => f.friend.id === userId) ||
    pendingIncoming.some(f => f.friend.id === userId) ||
    pendingSent.some(f => f.friend.id === userId);

  return (
    <section className="friends-section">
      <div className="friends-header">
        <h2>Amis</h2>
        <button
          className="add-friend-toggle"
          onClick={() => setShowSearch(!showSearch)}
        >
          {showSearch ? 'Fermer' : '+ Ajouter'}
        </button>
      </div>

      {showSearch && (
        <div className="friend-search">
          <form onSubmit={handleSearch} className="friend-search-form">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Chercher un dresseur..."
              className="friend-search-input"
            />
            <button type="submit" className="friend-search-btn" disabled={searching}>
              {searching ? '...' : 'Chercher'}
            </button>
          </form>
          {searchResults.length > 0 && (
            <div className="friend-search-results">
              {searchResults.map(u => (
                <div key={u.id} className="friend-search-result">
                  <span>{u.displayName}</span>
                  {alreadyFriendOrPending(u.id) ? (
                    <span className="already-friend">Deja ami</span>
                  ) : (
                    <button
                      className="send-request-btn"
                      onClick={() => sendRequest(u.id)}
                    >
                      Ajouter
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {pendingIncoming.length > 0 && (
        <div className="friend-requests">
          <h3>Demandes recues</h3>
          {pendingIncoming.map(f => (
            <div key={f.id} className="friend-request">
              <span className="friend-name">{f.friend.displayName}</span>
              <div className="friend-request-actions">
                <button className="accept-btn" onClick={() => acceptRequest(f.id)}>Accepter</button>
                <button className="decline-btn" onClick={() => declineRequest(f.id)}>Refuser</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingSent.length > 0 && (
        <div className="friend-pending-sent">
          <h3>Demandes envoyees</h3>
          {pendingSent.map(f => (
            <div key={f.id} className="friend-pending">
              <span className="friend-name">{f.friend.displayName}</span>
              <span className="pending-label">En attente...</span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="friends-loading">Chargement...</p>
      ) : friends.length === 0 ? (
        <p className="no-friends">Pas encore d'amis. Cherche des dresseurs !</p>
      ) : (
        <div className="friends-list">
          {friends.map(f => (
            <div key={f.id} className="friend-item">
              <div className="friend-avatar">
                {f.friend.displayName.charAt(0).toUpperCase()}
              </div>
              <span className="friend-name">{f.friend.displayName}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

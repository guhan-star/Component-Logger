'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Check,
  X,
  Clock,
  Trash2,
  AlertCircle,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

interface Friend {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  friendsSince: string;
}

interface FriendRequestItem {
  id: string;
  createdAt: string;
  sender?: { id: string; username: string; name: string; avatarUrl: string | null };
  receiver?: { id: string; username: string; name: string; avatarUrl: string | null };
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchSearched, setSearchSearched] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        fetch('/api/friends'),
        fetch('/api/friends/requests'),
      ]);

      if (friendsRes.ok) {
        const data = await friendsRes.json();
        setFriends(data.friends || []);
      }

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setIncoming(data.incoming || []);
        setOutgoing(data.outgoing || []);
      }
    } catch (err) {
      console.error('Failed to load friends data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;

    setSearching(true);
    setActionError(null);
    setSearchSearched(true);

    try {
      const res = await fetch(`/api/friends/search?username=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Failed to search for operator.');
        setSearchResult(null);
      } else if (!data.found) {
        setSearchResult(null);
      } else {
        setSearchResult(data);
      }
    } catch {
      setActionError('Search network error.');
      setSearchResult(null);
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (targetUserId: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch('/api/friends/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send request.');
      }
      setActionSuccess(data.message || 'Friend request sent!');
      // Refresh search result state
      if (searchResult && searchResult.user.id === targetUserId) {
        setSearchResult({
          ...searchResult,
          relationship: data.autoAccepted ? 'FRIEND' : 'REQUEST_SENT',
        });
      }
      loadData();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleRequestAction = async (requestId: string, action: 'ACCEPT' | 'REJECT' | 'CANCEL') => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/friends/requests/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to process request.');
      }
      setActionSuccess(data.message);
      loadData();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleRemoveFriend = async (friendId: string, friendName: string) => {
    if (!confirm(`Are you sure you want to remove ${friendName} from your friends?`)) return;

    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch('/api/friends', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove friend.');
      }
      setActionSuccess('Friend removed successfully.');
      loadData();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--amber)]" />
            <h1 className="text-xl font-bold tracking-tight text-[var(--text)]">
              Friends &amp; Operator Discovery
            </h1>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">
            Private peer network. Connect with team members via exact username search to invite them to project BOMs.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-[var(--muted)] bg-[var(--panel2)] px-3 py-1.5 rounded border border-[var(--line)]">
          <ShieldCheck className="w-4 h-4 text-[var(--amber)]" />
          <span>Zero Directory Leakage · Private Discovery</span>
        </div>
      </div>

      {/* Notifications */}
      {actionError && (
        <div className="p-3 rounded bg-[var(--red)]/10 border border-[var(--red)] text-xs text-[var(--text)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[var(--red)] shrink-0" />
          <span>{actionError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Discovery Section */}
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--amber)]">
            Exact Username Discovery
          </h2>
          <span className="text-[10px] font-mono text-[var(--muted)]">
            Exact match required · No email search
          </span>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder="Enter operator username (e.g. ironman, tony_stark)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded text-xs text-[var(--text)] font-mono focus:border-[var(--amber)] focus:outline-hidden"
            />
          </div>
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="px-4 py-2 bg-[var(--amber)] text-[#17120a] font-bold text-xs uppercase tracking-wider rounded hover:bg-[#d97706] disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {searching ? 'Searching...' : 'Find Operator'}
          </button>
        </form>

        {/* Search Result Card */}
        {searchSearched && (
          <div className="pt-2">
            {searchResult && searchResult.found ? (
              <div className="flex items-center justify-between p-3.5 bg-[var(--panel2)] border border-[var(--line)] rounded">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[var(--bg)] border border-[var(--line)] flex items-center justify-center font-bold text-xs text-[var(--amber)]">
                    {searchResult.user.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[var(--text)]">{searchResult.user.name}</div>
                    <div className="text-[11px] font-mono text-[var(--muted)]">@{searchResult.user.username}</div>
                  </div>
                </div>

                <div>
                  {searchResult.relationship === 'FRIEND' && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30">
                      <UserCheck className="w-3.5 h-3.5" /> Already Friends
                    </span>
                  )}
                  {searchResult.relationship === 'REQUEST_SENT' && (
                    <span className="flex items-center gap-1 text-[11px] text-[var(--amber)] font-semibold px-2.5 py-1 rounded bg-[var(--amber)]/10 border border-[var(--amber)]/30">
                      <Clock className="w-3.5 h-3.5" /> Request Sent
                    </span>
                  )}
                  {searchResult.relationship === 'REQUEST_RECEIVED' && (
                    <button
                      onClick={() => handleRequestAction(searchResult.requestId, 'ACCEPT')}
                      className="flex items-center gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" /> Accept Request
                    </button>
                  )}
                  {searchResult.relationship === 'NONE' && (
                    <button
                      onClick={() => handleSendRequest(searchResult.user.id)}
                      className="flex items-center gap-1.5 text-xs bg-[var(--amber)] hover:bg-[#d97706] text-[#17120a] font-bold px-3 py-1.5 rounded uppercase tracking-wider transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Add Friend
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[var(--panel2)] border border-dashed border-[var(--line)] rounded text-center text-xs text-[var(--muted)]">
                No active operator found with exact username &ldquo;<span className="font-mono text-[var(--text)]">{searchQuery}</span>&rdquo;.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid: Pending Requests & Friends List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Requests */}
        <div className="space-y-6">
          {/* Incoming Requests */}
          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)] flex items-center gap-1.5">
                Incoming Requests
                {incoming.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-[var(--amber)] text-[#17120a] rounded text-[10px] font-bold">
                    {incoming.length}
                  </span>
                )}
              </span>
            </div>

            {incoming.length === 0 ? (
              <p className="text-xs text-[var(--muted)] py-4 text-center">No incoming friend requests.</p>
            ) : (
              <div className="space-y-2">
                {incoming.map((req) => (
                  <div key={req.id} className="p-2.5 bg-[var(--panel2)] border border-[var(--line)] rounded flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-[var(--text)]">{req.sender?.name}</div>
                      <div className="text-[10px] font-mono text-[var(--muted)]">@{req.sender?.username}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRequestAction(req.id, 'ACCEPT')}
                        title="Accept"
                        className="p-1.5 rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors border border-emerald-500/30"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRequestAction(req.id, 'REJECT')}
                        title="Decline"
                        className="p-1.5 rounded bg-[var(--red)]/10 text-[var(--red)] hover:bg-[var(--red)] hover:text-white transition-colors border border-[var(--red)]/30"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing Requests */}
          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)]">
                Outgoing Requests ({outgoing.length})
              </span>
            </div>

            {outgoing.length === 0 ? (
              <p className="text-xs text-[var(--muted)] py-4 text-center">No pending outgoing requests.</p>
            ) : (
              <div className="space-y-2">
                {outgoing.map((req) => (
                  <div key={req.id} className="p-2.5 bg-[var(--panel2)] border border-[var(--line)] rounded flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-[var(--text)]">{req.receiver?.name}</div>
                      <div className="text-[10px] font-mono text-[var(--muted)]">@{req.receiver?.username}</div>
                    </div>
                    <button
                      onClick={() => handleRequestAction(req.id, 'CANCEL')}
                      title="Cancel request"
                      className="text-[10px] font-mono px-2 py-1 rounded bg-[var(--bg)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--red)] hover:border-[var(--red)] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (2 cols): My Friends */}
        <div className="lg:col-span-2 bg-[var(--panel)] border border-[var(--line)] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--amber)]">
                Accepted Friends ({friends.length})
              </h2>
              <p className="text-[11px] text-[var(--muted)]">
                Only accepted friends can be invited to collaborative project BOM teams.
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-xs text-[var(--muted)] py-8 text-center font-mono">Loading friends roster...</p>
          ) : friends.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Users className="w-8 h-8 text-[var(--muted)] mx-auto opacity-50" />
              <p className="text-xs text-[var(--muted)] font-medium">You haven&apos;t added any operator friends yet.</p>
              <p className="text-[11px] text-[var(--muted)]">Use the exact username search above to connect with peers.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="p-3.5 bg-[var(--panel2)] border border-[var(--line)] rounded flex items-center justify-between hover:border-[var(--muted)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--bg)] border border-[var(--line)] flex items-center justify-center font-bold text-xs text-[var(--amber)]">
                      {friend.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--text)]">{friend.name}</div>
                      <div className="text-[10px] font-mono text-[var(--muted)]">@{friend.username}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveFriend(friend.id, friend.name)}
                    title="Remove friend"
                    className="p-1.5 rounded text-[var(--muted)] hover:text-[var(--red)] hover:bg-[var(--red)]/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

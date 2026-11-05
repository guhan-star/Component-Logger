'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
  Sparkles,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  ExternalLink,
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

interface SuggestionItem {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  professionalTitle: string | null;
  bio: string | null;
  tags: string[];
  mutualFriends: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestItem[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Exact Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searchSearched, setSearchSearched] = useState(false);

  // Suggestions State (People You May Know)
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestionsPage, setSuggestionsPage] = useState(1);
  const [suggestionsPagination, setSuggestionsPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 8,
    totalCount: 0,
    totalPages: 1,
  });

  // Action feedback states
  const [pendingActionIds, setPendingActionIds] = useState<Set<string>>(new Set());
  const [sentRequestUserIds, setSentRequestUserIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Load roster data (friends + requests)
  const loadRosterData = useCallback(async () => {
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
      console.error('Failed to load friends roster:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load suggestions (People You May Know)
  const loadSuggestions = useCallback(async (page = 1) => {
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    try {
      const res = await fetch(`/api/friends/suggestions?page=${page}&limit=8`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch suggestions');
      }
      setSuggestions(data.suggestions || []);
      if (data.pagination) {
        setSuggestionsPagination(data.pagination);
        setSuggestionsPage(data.pagination.page);
      }
    } catch (err: any) {
      console.error('Failed to load suggestions:', err);
      setSuggestionsError(err.message || 'Unable to load suggestions. Please try again.');
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRosterData();
    loadSuggestions(1);
  }, [loadRosterData, loadSuggestions]);

  // Exact Username Search Handler
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
        setActionError(data.error || 'Failed to search for user.');
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

  // Send Friend Request Handler (Used by both Search and Suggestions)
  const handleSendRequest = async (targetUserId: string, username?: string) => {
    setActionError(null);
    setActionSuccess(null);
    setPendingActionIds((prev) => new Set(prev).add(targetUserId));

    try {
      const res = await fetch('/api/friends/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to send friend request.');
      }

      setActionSuccess(data.message || 'Friend request sent.');
      setTimeout(() => setActionSuccess(null), 4000);

      // Track as sent in local state
      setSentRequestUserIds((prev) => new Set(prev).add(targetUserId));

      // Refresh search result if target was searched
      if (searchResult && searchResult.user.id === targetUserId) {
        setSearchResult({
          ...searchResult,
          relationship: data.autoAccepted ? 'FRIEND' : 'REQUEST_SENT',
        });
      }

      // Refresh roster and suggestions
      loadRosterData();
    } catch (err: any) {
      setActionError(err.message || 'Unable to send friend request.');
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setPendingActionIds((prev) => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
    }
  };

  // Process Request (Accept / Reject / Cancel)
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
      setTimeout(() => setActionSuccess(null), 4000);
      loadRosterData();
      loadSuggestions(suggestionsPage);
    } catch (err: any) {
      setActionError(err.message);
      setTimeout(() => setActionError(null), 5000);
    }
  };

  // Remove Friend Handler
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
      setTimeout(() => setActionSuccess(null), 4000);
      loadRosterData();
      loadSuggestions(suggestionsPage);
    } catch (err: any) {
      setActionError(err.message);
      setTimeout(() => setActionError(null), 5000);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 select-none">
      {/* ============================================================ */}
      {/* 1. PAGE HEADER                                              */}
      {/* ============================================================ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--amber)] animate-pulse" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text)]">
              FRIENDS &amp; TEAMMATES
            </h1>
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">
            Connect with other Component Logger users and collaborate on projects.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <Link
            href="/profile?tab=privacy"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            title="Manage discovery and privacy in Profile Settings"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--amber)]" />
            <span>Privacy Controls</span>
          </Link>
          <span className="px-3 py-1.5 rounded-lg bg-[var(--panel2)] border border-[var(--line)] text-[var(--muted)]">
            Active Friends: <strong className="text-[var(--text)]">{friends.length}</strong>
          </span>
        </div>
      </div>

      {/* Notifications / Feedback Toasts */}
      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between gap-2 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="p-1 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between gap-2 shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="p-1 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. SECTION 1: EXACT USERNAME DISCOVERY                       */}
      {/* ============================================================ */}
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-xl p-4 sm:p-5 space-y-3.5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--amber)] mono">
              EXACT USERNAME DISCOVERY
            </h2>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">
              Enter another operator&apos;s exact username to perform a direct peer lookup.
            </p>
          </div>
          <span className="text-[10px] font-mono text-[var(--muted)]">
            Exact match required · No email search
          </span>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--muted)]">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Enter exact username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs text-[var(--text)] font-mono focus:border-[var(--amber)] focus:outline-hidden min-h-[38px]"
            />
          </div>
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="px-4 py-2 bg-[var(--amber)] text-[#17120a] font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-[#d97706] disabled:opacity-50 transition-colors flex items-center gap-1.5 min-h-[38px] shadow-sm"
          >
            {searching ? 'SEARCHING...' : 'FIND FRIEND'}
          </button>
        </form>

        {/* Search Result Card */}
        {searchSearched && (
          <div className="pt-1">
            {searchResult && searchResult.found ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-[var(--panel2)] border border-[var(--line)] rounded-xl gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--bg)] border border-[var(--line)] flex items-center justify-center font-bold text-xs text-[var(--amber)] overflow-hidden shrink-0">
                    {searchResult.user.avatarUrl ? (
                      <img
                        src={searchResult.user.avatarUrl}
                        alt={searchResult.user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      searchResult.user.name?.charAt(0).toUpperCase() || 'U'
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[var(--text)]">{searchResult.user.name}</div>
                    <div className="text-[11px] font-mono text-[var(--muted)]">@{searchResult.user.username}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {searchResult.relationship === 'FRIEND' && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                      <UserCheck className="w-3.5 h-3.5" /> Already Friends
                    </span>
                  )}
                  {searchResult.relationship === 'REQUEST_SENT' && (
                    <span className="flex items-center gap-1 text-[11px] text-[var(--amber)] font-semibold px-3 py-1.5 rounded-lg bg-[var(--amber)]/10 border border-[var(--amber)]/30">
                      <Clock className="w-3.5 h-3.5" /> Request Sent
                    </span>
                  )}
                  {searchResult.relationship === 'REQUEST_RECEIVED' && (
                    <button
                      onClick={() => handleRequestAction(searchResult.requestId, 'ACCEPT')}
                      className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" /> Accept Request
                    </button>
                  )}
                  {searchResult.relationship === 'NONE' && (
                    <button
                      onClick={() => handleSendRequest(searchResult.user.id, searchResult.user.username)}
                      disabled={pendingActionIds.has(searchResult.user.id)}
                      className="flex items-center gap-1.5 text-xs bg-[var(--amber)] hover:bg-[#d97706] text-[#17120a] font-bold px-3.5 py-1.5 rounded-lg uppercase tracking-wider transition-colors disabled:opacity-50 shadow-sm"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{pendingActionIds.has(searchResult.user.id) ? 'Sending...' : 'Add Friend'}</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[var(--panel2)] border border-dashed border-[var(--line)] rounded-lg text-center text-xs text-[var(--muted)]">
                No user found with exact username &ldquo;<span className="font-mono text-[var(--text)]">{searchQuery}</span>&rdquo;.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 3. SECTION 2: PEOPLE YOU MAY KNOW                           */}
      {/* ============================================================ */}
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[var(--line)] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--amber)]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text)] mono">
                PEOPLE YOU MAY KNOW
              </h2>
            </div>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Discover other Component Logger users and connect with people in the community.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => loadSuggestions(suggestionsPage)}
              disabled={suggestionsLoading}
              title="Refresh suggestions"
              className="p-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-[var(--muted)] hover:text-[var(--text)] transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${suggestionsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Suggestion Content / States */}
        {suggestionsLoading ? (
          <div className="py-12 text-center space-y-2">
            <RefreshCw className="w-6 h-6 text-[var(--amber)] animate-spin mx-auto opacity-80" />
            <p className="text-xs text-[var(--muted)] font-mono">Finding people you may know...</p>
          </div>
        ) : suggestionsError ? (
          <div className="p-6 text-center rounded-xl bg-[var(--panel2)] border border-[var(--line)] space-y-2.5">
            <AlertCircle className="w-6 h-6 text-rose-400 mx-auto" />
            <p className="text-xs text-rose-300 font-medium">{suggestionsError}</p>
            <button
              onClick={() => loadSuggestions(1)}
              className="px-3 py-1.5 rounded-lg bg-[var(--amber)] text-black font-bold text-xs hover:bg-amber-400 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="py-10 text-center rounded-xl bg-[var(--panel2)] border border-dashed border-[var(--line)] space-y-2 p-6">
            <Users className="w-8 h-8 text-[var(--muted)] mx-auto opacity-40" />
            <p className="text-xs font-bold text-[var(--text)]">No suggestions available yet.</p>
            <p className="text-[11px] text-[var(--muted)] max-w-md mx-auto leading-relaxed">
              Suggestions depend on account discoverability. When new users register or existing members enable community suggestions in their privacy settings, they will automatically appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {suggestions.map((person) => {
                const isSent = sentRequestUserIds.has(person.id);
                const isPending = pendingActionIds.has(person.id);

                return (
                  <div
                    key={person.id}
                    className="p-3.5 rounded-xl bg-[var(--panel2)] border border-[var(--line)] flex flex-col justify-between space-y-3 hover:border-[var(--line-strong)] transition-all shadow-xs"
                  >
                    {/* User Identity */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="w-10 h-10 rounded-full bg-[var(--bg)] border border-[var(--line)] flex items-center justify-center font-bold text-xs text-[var(--amber)] overflow-hidden shrink-0">
                          {person.avatarUrl ? (
                            <img
                              src={person.avatarUrl}
                              alt={person.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            person.name?.charAt(0).toUpperCase() || 'U'
                          )}
                        </div>

                        {person.mutualFriends > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-500/10 text-[var(--amber)] border border-amber-500/20">
                            {person.mutualFriends} mutual
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="text-xs font-bold text-[var(--text)] truncate" title={person.name}>
                          {person.name}
                        </div>
                        <div className="text-[11px] font-mono text-[var(--muted)] truncate">
                          @{person.username}
                        </div>
                      </div>

                      {/* Professional Role or Bio */}
                      {person.professionalTitle ? (
                        <p className="text-[11px] text-[var(--muted)] line-clamp-1 font-medium">
                          {person.professionalTitle}
                        </p>
                      ) : person.bio ? (
                        <p className="text-[11px] text-[var(--muted)] line-clamp-2 leading-relaxed">
                          {person.bio}
                        </p>
                      ) : null}

                      {/* Technical Tags */}
                      {person.tags && person.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {person.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--line)] text-[10px] font-mono text-[var(--text)] truncate max-w-[120px]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <button
                      onClick={() => handleSendRequest(person.id, person.username)}
                      disabled={isSent || isPending}
                      className={`w-full h-8 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-xs ${
                        isSent
                          ? 'bg-[var(--panel)] border border-[var(--line)] text-[var(--amber)] cursor-default'
                          : 'bg-[var(--amber)] text-[#17120a] hover:bg-[#d97706] active:scale-[0.98]'
                      } disabled:opacity-60`}
                    >
                      {isPending ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : isSent ? (
                        <>
                          <Clock className="w-3.5 h-3.5 text-[var(--amber)]" />
                          <span>Request Sent</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Add Friend</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {suggestionsPagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 border-t border-[var(--line)]/50 text-xs font-mono">
                <span className="text-[11px] text-[var(--muted)]">
                  Page {suggestionsPagination.page} of {suggestionsPagination.totalPages} · {suggestionsPagination.totalCount} members
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => loadSuggestions(suggestionsPage - 1)}
                    disabled={suggestionsPage <= 1 || suggestionsLoading}
                    className="p-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => loadSuggestions(suggestionsPage + 1)}
                    disabled={suggestionsPage >= suggestionsPagination.totalPages || suggestionsLoading}
                    className="p-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel2)] hover:border-[var(--amber)] text-[var(--text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 4. SECTIONS 3 & 4 & 5: INCOMING, OUTGOING & ACCEPTED FRIENDS */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 Cols): Incoming & Outgoing Requests */}
        <div className="lg:col-span-5 space-y-6">
          {/* Incoming Requests */}
          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-xl p-4 sm:p-5 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)] mono">
                  INCOMING REQUESTS
                </span>
                {incoming.length > 0 && (
                  <span className="px-2 py-0.5 bg-[var(--amber)] text-[#17120a] rounded-full text-[10px] font-bold">
                    {incoming.length}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono text-[var(--muted)]">Action required</span>
            </div>

            {incoming.length === 0 ? (
              <p className="text-xs text-[var(--muted)] py-6 text-center font-mono">
                No pending incoming friend requests.
              </p>
            ) : (
              <div className="space-y-2">
                {incoming.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 bg-[var(--panel2)] border border-[var(--line)] rounded-xl flex items-center justify-between gap-2 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-8 h-8 rounded-full bg-[var(--bg)] border border-[var(--line)] flex items-center justify-center font-bold text-xs text-[var(--amber)] overflow-hidden shrink-0">
                        {req.sender?.avatarUrl ? (
                          <img
                            src={req.sender.avatarUrl}
                            alt={req.sender.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          req.sender?.name?.charAt(0).toUpperCase() || 'U'
                        )}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-[var(--text)] truncate">{req.sender?.name}</div>
                        <div className="text-[10px] font-mono text-[var(--muted)] truncate">@{req.sender?.username}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleRequestAction(req.id, 'ACCEPT')}
                        title="Accept friend request"
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors border border-emerald-500/30 text-xs font-bold flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleRequestAction(req.id, 'REJECT')}
                        title="Decline friend request"
                        className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors border border-rose-500/30"
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
          <div className="bg-[var(--panel)] border border-[var(--line)] rounded-xl p-4 sm:p-5 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text)] mono">
                OUTGOING REQUESTS ({outgoing.length})
              </span>
              <span className="text-[10px] font-mono text-[var(--muted)]">Awaiting peer response</span>
            </div>

            {outgoing.length === 0 ? (
              <p className="text-xs text-[var(--muted)] py-6 text-center font-mono">
                No pending outgoing requests.
              </p>
            ) : (
              <div className="space-y-2">
                {outgoing.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 bg-[var(--panel2)] border border-[var(--line)] rounded-xl flex items-center justify-between gap-2 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-8 h-8 rounded-full bg-[var(--bg)] border border-[var(--line)] flex items-center justify-center font-bold text-xs text-[var(--amber)] overflow-hidden shrink-0">
                        {req.receiver?.avatarUrl ? (
                          <img
                            src={req.receiver.avatarUrl}
                            alt={req.receiver.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          req.receiver?.name?.charAt(0).toUpperCase() || 'U'
                        )}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-semibold text-[var(--text)] truncate">{req.receiver?.name}</div>
                        <div className="text-[10px] font-mono text-[var(--muted)] truncate">@{req.receiver?.username}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRequestAction(req.id, 'CANCEL')}
                      title="Cancel friend request"
                      className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-[var(--muted)] hover:text-rose-400 hover:border-rose-500/40 transition-colors shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (7 Cols): Accepted Friends */}
        <div className="lg:col-span-7 bg-[var(--panel)] border border-[var(--line)] rounded-xl p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[var(--line)] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[var(--amber)]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text)] mono">
                  ACCEPTED FRIENDS ({friends.length})
                </h2>
              </div>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">
                Only accepted friends are eligible for collaborative project BOM invitations and hardware sharing.
              </p>
            </div>
            <Link
              href="/projects"
              className="text-[11px] text-[var(--amber)] hover:underline flex items-center gap-1 self-start sm:self-auto font-semibold"
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>Project Teams →</span>
            </Link>
          </div>

          {loading ? (
            <p className="text-xs text-[var(--muted)] py-12 text-center font-mono">
              Loading friends roster...
            </p>
          ) : friends.length === 0 ? (
            <div className="py-14 text-center space-y-2.5">
              <Users className="w-10 h-10 text-[var(--muted)] mx-auto opacity-40" />
              <p className="text-xs font-bold text-[var(--text)]">You haven&apos;t added any friends or teammates yet.</p>
              <p className="text-[11px] text-[var(--muted)] max-w-sm mx-auto leading-relaxed">
                Connect with peers from the People You May Know suggestions above or use Exact Username Discovery to find project collaborators.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="p-3.5 bg-[var(--panel2)] border border-[var(--line)] rounded-xl flex items-center justify-between hover:border-[var(--line-strong)] transition-all shadow-xs"
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="w-9 h-9 rounded-full bg-[var(--bg)] border border-[var(--line)] flex items-center justify-center font-bold text-xs text-[var(--amber)] overflow-hidden shrink-0">
                      {friend.avatarUrl ? (
                        <img
                          src={friend.avatarUrl}
                          alt={friend.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        friend.name?.charAt(0).toUpperCase() || 'U'
                      )}
                    </div>
                    <div className="truncate">
                      <div className="text-xs font-bold text-[var(--text)] truncate">{friend.name}</div>
                      <div className="text-[10px] font-mono text-[var(--muted)] truncate">@{friend.username}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleRemoveFriend(friend.id, friend.name)}
                      title={`Remove ${friend.name} from friends`}
                      className="p-1.5 rounded-lg text-[var(--muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

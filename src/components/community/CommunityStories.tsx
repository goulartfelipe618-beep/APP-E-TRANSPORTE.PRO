import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeMediaSrc } from "@/lib/safeExternalUrl";

const STORIES_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const SEGMENT_MS = 10_000;
const SWIPE_H_THRESHOLD = 72;
const SWIPE_X_THRESHOLD = 56;

type StoryPost = {
  id: string;
  author_user_id: string;
  content: string;
  created_at: string;
};

type StoryMedia = {
  id: string;
  post_id: string;
  media_type: "image" | "video";
  media_url: string;
  position: number;
};

type StoryProfile = {
  user_id: string;
  nome_completo: string | null;
  nome_projeto: string | null;
  logo_url: string | null;
};

type StoryUserGroup = {
  userId: string;
  profile: StoryProfile;
  posts: StoryPost[];
  latestAt: number;
};

function displayName(p?: StoryProfile | null) {
  if (!p) return "Usuário";
  return p.nome_completo || p.nome_projeto || "Usuário";
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

function buildStoryGroups(posts: StoryPost[], profiles: Record<string, StoryProfile>): StoryUserGroup[] {
  const byUser = new Map<string, StoryPost[]>();
  for (const p of posts) {
    const list = byUser.get(p.author_user_id);
    if (list) list.push(p);
    else byUser.set(p.author_user_id, [p]);
  }
  const groups: StoryUserGroup[] = [];
  for (const [userId, userPosts] of byUser) {
    userPosts.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const latestAt = Math.max(...userPosts.map((x) => new Date(x.created_at).getTime()));
    const profile =
      profiles[userId] ||
      ({
        user_id: userId,
        nome_completo: null,
        nome_projeto: null,
        logo_url: null,
      } satisfies StoryProfile);
    groups.push({ userId, profile, posts: userPosts, latestAt });
  }
  groups.sort((a, b) => b.latestAt - a.latestAt);
  return groups;
}

function useNarrowScreen() {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 640px)").matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const fn = () => setNarrow(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return narrow;
}

type CommunityStoriesProps = {
  panel?: "motorista" | "admin";
};

export default function CommunityStories({ panel = "motorista" }: CommunityStoriesProps) {
  const isAdminPanel = panel === "admin";
  const narrow = useNarrowScreen();
  const [groups, setGroups] = useState<StoryUserGroup[]>([]);
  const [mediaByPost, setMediaByPost] = useState<Record<string, StoryMedia[]>>({});
  const [loading, setLoading] = useState(!isAdminPanel);

  const groupsRef = useRef(groups);
  const userIdxRef = useRef(0);
  const segIdxRef = useRef(0);

  const [viewerOpen, setViewerOpen] = useState(false);
  const [userIndex, setUserIndex] = useState(0);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [pullDismissDy, setPullDismissDy] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const touchMoved = useRef(false);
  const rafRef = useRef<number | null>(null);

  groupsRef.current = groups;
  userIdxRef.current = userIndex;
  segIdxRef.current = segmentIndex;

  const loadStories = useCallback(async () => {
    if (isAdminPanel) {
      setLoading(false);
      return;
    }
    const since = new Date(Date.now() - STORIES_WINDOW_MS).toISOString();
    const { data: postsRaw, error: postsErr } = await supabase
      .from("community_posts")
      .select("id,author_user_id,content,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    if (postsErr) {
      setGroups([]);
      setMediaByPost({});
      setLoading(false);
      return;
    }

    const posts = (postsRaw || []) as StoryPost[];
    const postIds = posts.map((p) => p.id);
    let mediaList: StoryMedia[] = [];
    if (postIds.length > 0) {
      const { data: mediaRaw } = await supabase
        .from("community_post_media")
        .select("id,post_id,media_type,media_url,position")
        .in("post_id", postIds)
        .order("position", { ascending: true });
      mediaList = (mediaRaw || []) as StoryMedia[];
    }

    const byPost: Record<string, StoryMedia[]> = {};
    for (const m of mediaList) {
      const arr = byPost[m.post_id];
      if (arr) arr.push(m);
      else byPost[m.post_id] = [m];
    }

    const authorIds = [...new Set(posts.map((p) => p.author_user_id))];
    const profiles: Record<string, StoryProfile> = {};
    if (authorIds.length > 0) {
      const { data: cfg } = await supabase
        .from("configuracoes")
        .select("user_id,nome_completo,nome_projeto,logo_url")
        .in("user_id", authorIds);
      for (const row of (cfg || []) as StoryProfile[]) {
        profiles[row.user_id] = row;
      }
    }

    setMediaByPost(byPost);
    setGroups(buildStoryGroups(posts, profiles));
    setLoading(false);
  }, [isAdminPanel]);

  useEffect(() => {
    void loadStories();
  }, [loadStories]);

  useEffect(() => {
    if (isAdminPanel) return;
    const ch = supabase
      .channel("community-stories-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, () => void loadStories())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_post_media" }, () => void loadStories())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [loadStories, isAdminPanel]);

  const closeViewer = useCallback(() => {
    setViewerOpen(false);
    setPullDismissDy(0);
    touchMoved.current = false;
    touchStart.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const openViewerAt = useCallback((uIdx: number) => {
    setUserIndex(uIdx);
    setSegmentIndex(0);
    setProgress(0);
    setPullDismissDy(0);
    touchMoved.current = false;
    touchStart.current = null;
    setViewerOpen(true);
  }, []);

  const advanceSegmentAuto = useCallback(() => {
    const gList = groupsRef.current;
    const u = userIdxRef.current;
    const s = segIdxRef.current;
    const g = gList[u];
    if (!g) {
      closeViewer();
      return;
    }
    if (s < g.posts.length - 1) {
      setSegmentIndex(s + 1);
      return;
    }
    if (u < gList.length - 1) {
      setUserIndex(u + 1);
      setSegmentIndex(0);
      return;
    }
    closeViewer();
  }, [closeViewer]);

  const goNextTap = useCallback(() => {
    advanceSegmentAuto();
  }, [advanceSegmentAuto]);

  const goPrevTap = useCallback(() => {
    const gList = groupsRef.current;
    const u = userIdxRef.current;
    const s = segIdxRef.current;
    if (s > 0) {
      setSegmentIndex(s - 1);
      return;
    }
    if (u > 0) {
      const prev = gList[u - 1];
      if (!prev) return;
      setUserIndex(u - 1);
      setSegmentIndex(prev.posts.length - 1);
    }
  }, []);

  const goNextUserSwipe = useCallback(() => {
    const gList = groupsRef.current;
    const u = userIdxRef.current;
    if (u >= gList.length - 1) {
      closeViewer();
      return;
    }
    setUserIndex(u + 1);
    setSegmentIndex(0);
  }, [closeViewer]);

  const goPrevUserSwipe = useCallback(() => {
    const u = userIdxRef.current;
    if (u <= 0) return;
    setUserIndex(u - 1);
    setSegmentIndex(0);
  }, []);

  useEffect(() => {
    if (!viewerOpen) return;
    const gList = groupsRef.current;
    if (gList.length === 0) return;
    const g = gList[userIndex];
    if (!g?.posts[segmentIndex]) {
      closeViewer();
      return;
    }
    const deadline = Date.now() + SEGMENT_MS;
    const tick = () => {
      const left = deadline - Date.now();
      if (left <= 0) {
        setProgress(1);
        advanceSegmentAuto();
        return;
      }
      setProgress(1 - left / SEGMENT_MS);
      rafRef.current = requestAnimationFrame(tick);
    };
    setProgress(0);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [viewerOpen, userIndex, segmentIndex, groups, advanceSegmentAuto, closeViewer]);

  useEffect(() => {
    if (!viewerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeViewer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerOpen, closeViewer]);

  useEffect(() => {
    if (!viewerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [viewerOpen]);

  useEffect(() => {
    if (viewerOpen && groups.length === 0) closeViewer();
  }, [viewerOpen, groups.length, closeViewer]);

  const currentGroup = groups[userIndex];
  const currentPost = currentGroup?.posts[segmentIndex];
  const currentMedia = currentPost ? mediaByPost[currentPost.id] ?? [] : [];

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStart.current = { x: t.clientX, y: t.clientY };
    touchMoved.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const s = touchStart.current;
    if (!t || !s) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) touchMoved.current = true;
    const pullFromTop = s.y < 140;
    if (pullFromTop && dy > 0 && dy > Math.abs(dx) * 0.55) setPullDismissDy(Math.min(dy, 220));
    else if (!pullFromTop) setPullDismissDy(0);
  };

  const onTouchEndSwipe = (e: React.TouchEvent) => {
    const s = touchStart.current;
    if (!s) {
      setPullDismissDy(0);
      return;
    }
    const t = e.changedTouches[0];
    if (!t) {
      touchStart.current = null;
      setPullDismissDy(0);
      return;
    }
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    touchStart.current = null;
    setPullDismissDy(0);

    if (dy > SWIPE_H_THRESHOLD && dy > Math.abs(dx) * 0.85) {
      closeViewer();
      return;
    }
    if (Math.abs(dx) > SWIPE_X_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 0.85) {
      if (dx < 0) goNextUserSwipe();
      else goPrevUserSwipe();
    }
  };

  const bar = useMemo(() => {
    if (groups.length === 0 || loading) return null;
    return (
      <div className="w-full space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stories</p>
        <div className="flex gap-3 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:thin]">
          {groups.map((g, idx) => {
            const name = displayName(g.profile);
            return (
              <button
                key={g.userId}
                type="button"
                onClick={() => openViewerAt(idx)}
                className="flex shrink-0 flex-col items-center gap-1.5 rounded-lg p-1 text-center transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6600]/50"
              >
                <span
                  className={cn(
                    "rounded-full bg-gradient-to-tr from-amber-400 via-[#FF6600] to-rose-500 p-[2.5px]",
                    "shadow-sm",
                  )}
                >
                  <span className="block rounded-full bg-card p-0.5">
                    <Avatar className="h-14 w-14 border border-border/60">
                      <AvatarImage src={g.profile.logo_url || undefined} alt={name} />
                      <AvatarFallback className="text-xs">{initialsFromName(name)}</AvatarFallback>
                    </Avatar>
                  </span>
                </span>
                <span className="max-w-[4.5rem] truncate text-[10px] font-medium text-foreground">{name}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }, [groups, loading, openViewerAt]);

  if (isAdminPanel) return null;

  if (loading) {
    return (
      <div className="flex h-20 items-center gap-3 overflow-hidden rounded-xl border border-border bg-muted/20 px-4">
        <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-muted" />
        <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-muted" />
        <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  if (groups.length === 0) return null;

  const viewer =
    viewerOpen && currentPost && currentGroup
      ? createPortal(
          <div
            className={cn(
              "fixed inset-0 z-[100] flex flex-col bg-black text-white",
              !narrow && "items-center justify-center bg-black/90 p-4",
            )}
            style={{
              transform: pullDismissDy ? `translateY(${pullDismissDy}px)` : undefined,
              transition: "transform 0.2s ease-out",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Visualizador de Stories"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEndSwipe}
          >
            <div
              className={cn(
                "relative flex min-h-0 w-full flex-1 flex-col bg-black",
                narrow ? "min-h-[100dvh]" : "max-h-[min(90dvh,820px)] max-w-lg overflow-hidden rounded-2xl border border-white/10 shadow-2xl",
              )}
            >
              <div className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex gap-0.5 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
                {currentGroup.posts.map((_, i) => (
                  <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25">
                    <div
                      className="h-full bg-[#FF6600]"
                      style={{
                        width: i < segmentIndex ? "100%" : i === segmentIndex ? `${progress * 100}%` : "0%",
                        transition: i === segmentIndex ? "none" : "width 0.15s ease-out",
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="relative z-20 flex shrink-0 items-center gap-3 px-3 pb-2 pt-[max(2.75rem,env(safe-area-inset-top))] sm:pt-12">
                <Avatar className="h-9 w-9 border border-white/20">
                  <AvatarImage src={currentGroup.profile.logo_url || undefined} alt="" />
                  <AvatarFallback className="bg-white/10 text-xs text-white">
                    {initialsFromName(displayName(currentGroup.profile))}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{displayName(currentGroup.profile)}</p>
                  <p className="text-[11px] text-white/60">
                    {new Date(currentPost.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="shrink-0 text-white hover:bg-white/10"
                  onClick={closeViewer}
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="relative z-10 flex min-h-0 flex-1">
                <button
                  type="button"
                  className="absolute bottom-0 left-0 top-0 z-20 w-[28%] max-w-[140px] cursor-w-resize border-0 bg-transparent p-0"
                  aria-label="Anterior"
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrevTap();
                  }}
                />
                <button
                  type="button"
                  className="absolute bottom-0 right-0 top-0 z-20 w-[28%] max-w-[140px] cursor-e-resize border-0 bg-transparent p-0"
                  aria-label="Seguinte"
                  onClick={(e) => {
                    e.stopPropagation();
                    goNextTap();
                  }}
                />

                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-10 pt-2">
                  <div className="flex min-h-[40dvh] flex-col justify-center py-4">
                    {currentMedia.length === 0 ? (
                      <div className="mx-auto max-w-md rounded-xl bg-white/5 p-6">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/95">{currentPost.content}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {currentMedia.map((m) => {
                          const src = safeMediaSrc(m.media_url);
                          if (!src) return null;
                          return m.media_type === "image" ? (
                            <img
                              key={m.id}
                              src={src}
                              alt=""
                              className="mx-auto max-h-[min(55dvh,480px)] w-full max-w-full object-contain"
                            />
                          ) : (
                            <video
                              key={m.id}
                              src={src}
                              className="mx-auto max-h-[min(55dvh,480px)] w-full max-w-full bg-black object-contain"
                              controls
                              playsInline
                              muted
                            />
                          );
                        })}
                        {currentPost.content.trim() ? (
                          <p className="whitespace-pre-wrap px-1 pt-2 text-center text-sm text-white/85">{currentPost.content}</p>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {bar}
      {viewer}
    </>
  );
}

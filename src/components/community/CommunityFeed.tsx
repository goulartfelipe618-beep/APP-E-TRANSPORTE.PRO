import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import SlideCarousel from "@/components/SlideCarousel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, MessageCircle, Pencil, Trash2, RefreshCw, ImagePlus, Video, Tags, MoreHorizontal, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useConfiguracoes } from "@/contexts/ConfiguracoesContext";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { cn } from "@/lib/utils";
import { assertUploadMagicBytes, extensionForDetectedMime } from "@/lib/validateUploadMagicBytes";

type CommunityProfile = {
  user_id: string;
  nome_completo: string | null;
  nome_projeto: string | null;
  logo_url: string | null;
};

type CommunityPost = {
  id: string;
  author_user_id: string;
  category_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
};

type CommunityMedia = {
  id: string;
  post_id: string;
  media_type: "image" | "video";
  media_url: string;
  position: number;
};

type CommunityMention = {
  post_id: string;
  mentioned_user_id: string;
};

type CommunityLike = {
  post_id: string;
  user_id: string;
};

type CommunityComment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at?: string;
  is_edited?: boolean;
};

type CommunityCategory = {
  id: string;
  name: string;
  is_active: boolean;
  created_by_user_id: string;
};

function displayName(profile?: CommunityProfile) {
  if (!profile) return "Usuário";
  return profile.nome_completo || profile.nome_projeto || "Usuário";
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

/** Tamanho da página de posts (Supabase `.range` inclusivo). */
const COMMUNITY_POSTS_PAGE_SIZE = 20;

function sortPostsByCreatedAtDesc(list: CommunityPost[]): CommunityPost[] {
  return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function mergeUniquePosts(prev: CommunityPost[], incoming: CommunityPost[]): CommunityPost[] {
  const byId = new Map<string, CommunityPost>();
  for (const p of prev) byId.set(p.id, p);
  for (const p of incoming) {
    if (!byId.has(p.id)) byId.set(p.id, p);
  }
  return sortPostsByCreatedAtDesc(Array.from(byId.values()));
}

function mergeUniqueMedia(prev: CommunityMedia[], incoming: CommunityMedia[]): CommunityMedia[] {
  const seen = new Set(prev.map((m) => m.id));
  const out = [...prev];
  for (const m of incoming) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      out.push(m);
    }
  }
  return out;
}

function mergeUniqueComments(prev: CommunityComment[], incoming: CommunityComment[]): CommunityComment[] {
  const seen = new Set(prev.map((c) => c.id));
  const out = [...prev];
  for (const c of incoming) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}

function mentionKey(m: CommunityMention) {
  return `${m.post_id}:${m.mentioned_user_id}`;
}

function mergeUniqueMentions(prev: CommunityMention[], incoming: CommunityMention[]): CommunityMention[] {
  const seen = new Set(prev.map(mentionKey));
  const out = [...prev];
  for (const m of incoming) {
    const k = mentionKey(m);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(m);
    }
  }
  return out;
}

function likeKey(l: CommunityLike) {
  return `${l.post_id}:${l.user_id}`;
}

function mergeUniqueLikes(prev: CommunityLike[], incoming: CommunityLike[]): CommunityLike[] {
  const seen = new Set(prev.map(likeKey));
  const out = [...prev];
  for (const l of incoming) {
    const k = likeKey(l);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(l);
    }
  }
  return out;
}

async function fetchCommunityFeedRelatedRows(postIds: string[]): Promise<{
  media: CommunityMedia[];
  mentions: CommunityMention[];
  likes: CommunityLike[];
  comments: CommunityComment[];
  error: Error | null;
}> {
  if (postIds.length === 0) {
    return { media: [], mentions: [], likes: [], comments: [], error: null };
  }
  const [mediaRes, mentionsRes, likesRes, commentsRes] = await Promise.all([
    supabase
      .from("community_post_media")
      .select("id,post_id,media_type,media_url,position")
      .in("post_id", postIds)
      .order("position", { ascending: true }),
    supabase
      .from("community_post_mentions")
      .select("post_id,mentioned_user_id")
      .in("post_id", postIds)
      .order("created_at", { ascending: true }),
    supabase.from("community_post_likes").select("post_id,user_id").in("post_id", postIds).order("created_at", { ascending: true }),
    supabase
      .from("community_post_comments")
      .select("id,post_id,user_id,content,created_at,updated_at,is_edited")
      .in("post_id", postIds)
      .order("created_at", { ascending: true }),
  ]);
  const err = mediaRes.error || mentionsRes.error || likesRes.error || commentsRes.error;
  if (err) {
    return { media: [], mentions: [], likes: [], comments: [], error: err };
  }
  return {
    media: (mediaRes.data || []) as CommunityMedia[],
    mentions: (mentionsRes.data || []) as CommunityMention[],
    likes: (likesRes.data || []) as CommunityLike[],
    comments: (commentsRes.data || []) as CommunityComment[],
    error: null,
  };
}

type CommunityFeedProps = {
  /** `admin`: banner em largura total da área de conteúdo (painel Admin Master). */
  panel?: "motorista" | "admin";
};

type FeedCardInteractions = {
  toggleLike: (postId: string) => void;
  addComment: (postId: string) => void;
  savePostEdit: (post: CommunityPost) => void;
  saveCommentEdit: (comment: CommunityComment) => void;
};

type CommunityFeedPostCardProps = {
  post: CommunityPost;
  postMedia: CommunityMedia[];
  postMentions: CommunityMention[];
  postLikes: CommunityLike[];
  postComments: CommunityComment[];
  authorProfile?: CommunityProfile;
  categoryLabel: string;
  profiles: Record<string, CommunityProfile>;
  currentUserId: string | null;
  isAdminMaster: boolean;
  canEditPost: boolean;
  userLiked: boolean;
  editingPostId: string | null;
  editingBodyForCard: string;
  editingCommentId: string | null;
  editingCommentDraftForCard: string;
  commentDraftForPost: string;
  interactionsRef: MutableRefObject<FeedCardInteractions>;
  setEditingPostId: Dispatch<SetStateAction<string | null>>;
  setEditingContent: Dispatch<SetStateAction<string>>;
  setPendingDeletePost: Dispatch<SetStateAction<CommunityPost | null>>;
  setEditingCommentId: Dispatch<SetStateAction<string | null>>;
  setEditingCommentText: Dispatch<SetStateAction<string>>;
  setPendingDeleteComment: Dispatch<SetStateAction<CommunityComment | null>>;
  setCommentDrafts: Dispatch<SetStateAction<Record<string, string>>>;
};

function communityFeedPostCardPropsEqual(a: CommunityFeedPostCardProps, b: CommunityFeedPostCardProps) {
  return (
    a.post.id === b.post.id &&
    a.post.content === b.post.content &&
    a.post.created_at === b.post.created_at &&
    a.post.updated_at === b.post.updated_at &&
    a.post.is_edited === b.post.is_edited &&
    a.post.author_user_id === b.post.author_user_id &&
    a.post.category_id === b.post.category_id &&
    a.postMedia === b.postMedia &&
    a.postMentions === b.postMentions &&
    a.postLikes === b.postLikes &&
    a.postComments === b.postComments &&
    a.authorProfile === b.authorProfile &&
    a.categoryLabel === b.categoryLabel &&
    a.profiles === b.profiles &&
    a.currentUserId === b.currentUserId &&
    a.isAdminMaster === b.isAdminMaster &&
    a.canEditPost === b.canEditPost &&
    a.userLiked === b.userLiked &&
    a.editingPostId === b.editingPostId &&
    a.editingBodyForCard === b.editingBodyForCard &&
    a.editingCommentId === b.editingCommentId &&
    a.editingCommentDraftForCard === b.editingCommentDraftForCard &&
    a.commentDraftForPost === b.commentDraftForPost &&
    a.interactionsRef === b.interactionsRef &&
    a.setEditingPostId === b.setEditingPostId &&
    a.setEditingContent === b.setEditingContent &&
    a.setPendingDeletePost === b.setPendingDeletePost &&
    a.setEditingCommentId === b.setEditingCommentId &&
    a.setEditingCommentText === b.setEditingCommentText &&
    a.setPendingDeleteComment === b.setPendingDeleteComment &&
    a.setCommentDrafts === b.setCommentDrafts
  );
}

const CommunityFeedPostCard = memo(function CommunityFeedPostCard({
  post,
  postMedia,
  postMentions,
  postLikes,
  postComments,
  authorProfile,
  categoryLabel,
  profiles,
  currentUserId,
  isAdminMaster,
  canEditPost,
  userLiked,
  editingPostId,
  editingBodyForCard,
  editingCommentId,
  editingCommentDraftForCard,
  commentDraftForPost,
  interactionsRef,
  setEditingPostId,
  setEditingContent,
  setPendingDeletePost,
  setEditingCommentId,
  setEditingCommentText,
  setPendingDeleteComment,
  setCommentDrafts,
}: CommunityFeedPostCardProps) {
  const authorName = displayName(authorProfile);
  const editingThisPost = editingPostId === post.id;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={authorProfile?.logo_url || undefined} alt={authorName} />
              <AvatarFallback>{initialsFromName(authorName)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-foreground">{authorName}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(post.created_at).toLocaleString("pt-BR")}
                {post.is_edited ? " · editado" : ""}
              </p>
            </div>
          </div>
          {canEditPost && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setEditingPostId(post.id);
                    setEditingContent(post.content);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setPendingDeletePost(post)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {editingThisPost ? (
          <div className="space-y-2">
            <Textarea value={editingBodyForCard} onChange={(e) => setEditingContent(e.target.value)} rows={4} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void interactionsRef.current.savePostEdit(post)}>
                Salvar edição
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingPostId(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-foreground">{post.content}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{categoryLabel}</Badge>
          {postMentions.map((mention) => (
            <Badge key={`${mention.post_id}-${mention.mentioned_user_id}`} variant="secondary">
              @{displayName(profiles[mention.mentioned_user_id])}
            </Badge>
          ))}
        </div>

        {postMedia.length > 0 && (
          <div className="-mx-6 space-y-0">
            {postMedia.map((item) =>
              item.media_type === "image" ? (
                <div key={item.id} className="overflow-hidden border-y border-border bg-black">
                  <img src={item.media_url} alt="Mídia da publicação" className="block h-auto w-full object-contain" />
                </div>
              ) : (
                <div key={item.id} className="overflow-hidden border-y border-border">
                  <video src={item.media_url} controls className="h-56 w-full bg-black object-contain" />
                </div>
              ),
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button
            variant={userLiked ? "default" : "outline"}
            size="sm"
            onClick={() => void interactionsRef.current.toggleLike(post.id)}
          >
            <Heart className="mr-1.5 h-4 w-4" />
            Curtir ({postLikes.length})
          </Button>
          <Badge variant="outline" className="gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {postComments.length} comentário(s)
          </Badge>
          {postMedia.some((m) => m.media_type === "image") && (
            <Badge variant="outline" className="gap-1">
              <ImagePlus className="h-3.5 w-3.5" />
              imagem
            </Badge>
          )}
          {postMedia.some((m) => m.media_type === "video") && (
            <Badge variant="outline" className="gap-1">
              <Video className="h-3.5 w-3.5" />
              vídeo
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          {postComments.map((comment) => {
            const commentAuthor = profiles[comment.user_id];
            const commentAuthorName = displayName(commentAuthor);
            const canManageComment = !!currentUserId && (comment.user_id === currentUserId || isAdminMaster);
            const editingThisComment = editingCommentId === comment.id;
            return (
              <div key={comment.id} className="rounded-md border border-border bg-muted/20 p-2">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={commentAuthor?.logo_url || undefined} alt={commentAuthorName} />
                      <AvatarFallback className="text-[10px]">{initialsFromName(commentAuthorName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">{commentAuthorName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(comment.created_at).toLocaleString("pt-BR")}
                        {comment.is_edited ? " · editado" : ""}
                      </p>
                    </div>
                  </div>
                  {canManageComment && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          aria-label="Opções do comentário"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingCommentId(comment.id);
                            setEditingCommentText(comment.content);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setPendingDeleteComment(comment)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                {editingThisComment ? (
                  <div className="space-y-2 pt-1">
                    <Textarea
                      value={editingThisComment ? editingCommentDraftForCard : ""}
                      onChange={(e) => setEditingCommentText(e.target.value)}
                      rows={3}
                      className="text-xs"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void interactionsRef.current.saveCommentEdit(comment)}>
                        Salvar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingCommentId(null);
                          setEditingCommentText("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-xs text-foreground">{comment.content}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Comentar nesta publicação..."
            value={commentDraftForPost}
            onChange={(e) =>
              setCommentDrafts((prev) => ({
                ...prev,
                [post.id]: e.target.value,
              }))
            }
          />
          <Button size="sm" onClick={() => void interactionsRef.current.addComment(post.id)}>
            Enviar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}, communityFeedPostCardPropsEqual);

export default function CommunityFeed({ panel = "motorista" }: CommunityFeedProps) {
  const isAdminPanel = panel === "admin";
  const { config } = useConfiguracoes();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdminMaster, setIsAdminMaster] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, CommunityProfile>>({});

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [media, setMedia] = useState<CommunityMedia[]>([]);
  const [mentions, setMentions] = useState<CommunityMention[]>([]);
  const [likes, setLikes] = useState<CommunityLike[]>([]);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [categories, setCategories] = useState<CommunityCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [newPostContent, setNewPostContent] = useState("");
  const [newPostFiles, setNewPostFiles] = useState<File[]>([]);
  const [newPostCategoryId, setNewPostCategoryId] = useState<string>("");
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");

  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [pendingDeletePost, setPendingDeletePost] = useState<CommunityPost | null>(null);
  const [pendingDeleteComment, setPendingDeleteComment] = useState<CommunityComment | null>(null);
  const [pendingDeleteCategoryId, setPendingDeleteCategoryId] = useState<string | null>(null);
  const [categoryDeleteLoading, setCategoryDeleteLoading] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  const postsRef = useRef<CommunityPost[]>([]);
  const likesRef = useRef(likes);
  const currentUserIdRef = useRef(currentUserId);
  const editingContentRef = useRef(editingContent);
  const commentDraftsRef = useRef(commentDrafts);
  const editingCommentTextRef = useRef(editingCommentText);
  const feedCardInteractionsRef = useRef<FeedCardInteractions>({
    toggleLike: () => {},
    addComment: () => {},
    savePostEdit: async () => {},
    saveCommentEdit: async () => {},
  });

  postsRef.current = posts;
  likesRef.current = likes;
  currentUserIdRef.current = currentUserId;
  editingContentRef.current = editingContent;
  commentDraftsRef.current = commentDrafts;
  editingCommentTextRef.current = editingCommentText;

  const getImageDimensions = (file: File) =>
    new Promise<{ width: number; height: number }>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        reject(new Error("Não foi possível ler a imagem"));
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });

  const handleFilesPicked = async (files: File[]) => {
    const validFiles: File[] = [];
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        const dims = await getImageDimensions(file);
        if (dims.width !== 1536 || dims.height !== 1024) {
          toast.error(`A imagem "${file.name}" precisa ter exatamente 1536x1024px.`);
          continue;
        }
      }
      validFiles.push(file);
    }
    setNewPostFiles(validFiles);
  };

  const fetchAll = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoading(true);
    const prevPostCount = postsRef.current.length;

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;
    setCurrentUserId(userId);

    if (userId) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin_master")
        .maybeSingle();
      setIsAdminMaster(!!roleRow);
    } else {
      setIsAdminMaster(false);
    }

    const rangeEnd = silent
      ? Math.max(prevPostCount > 0 ? prevPostCount - 1 : COMMUNITY_POSTS_PAGE_SIZE - 1, 0)
      : COMMUNITY_POSTS_PAGE_SIZE - 1;

    const [postsRes, profilesRes, categoriesRes] = await Promise.all([
      supabase
        .from("community_posts")
        .select("id,author_user_id,category_id,content,created_at,updated_at,is_edited")
        .order("created_at", { ascending: false })
        .range(0, rangeEnd),
      supabase.from("configuracoes").select("user_id,nome_completo,nome_projeto,logo_url"),
      supabase
        .from("community_categories")
        .select("id,name,is_active,created_by_user_id")
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);

    if (postsRes.error || profilesRes.error || categoriesRes.error) {
      toast.error("Erro ao carregar Comunidade");
      if (!silent) setLoading(false);
      return;
    }

    const rows = (postsRes.data || []) as CommunityPost[];
    const postIds = rows.map((p) => p.id);
    const related = await fetchCommunityFeedRelatedRows(postIds);
    if (related.error) {
      toast.error("Erro ao carregar Comunidade");
      if (!silent) setLoading(false);
      return;
    }

    if (!silent) {
      setPosts(sortPostsByCreatedAtDesc(rows));
      setMedia(related.media);
      setMentions(related.mentions);
      setLikes(related.likes);
      setComments(related.comments);
      setHasMorePosts(rows.length === COMMUNITY_POSTS_PAGE_SIZE);
    } else {
      if (rows.length === 0 && prevPostCount > 0) {
        setPosts([]);
        setMedia([]);
        setMentions([]);
        setLikes([]);
        setComments([]);
        setHasMorePosts(false);
      } else if (rows.length === 0) {
        setPosts([]);
        setHasMorePosts(false);
      } else {
        const idSet = new Set(postIds);
        setPosts(sortPostsByCreatedAtDesc(rows));
        setMedia((prev) => {
          const without = prev.filter((m) => !idSet.has(m.post_id));
          return mergeUniqueMedia(without, related.media);
        });
        setMentions((prev) => {
          const without = prev.filter((m) => !idSet.has(m.post_id));
          return mergeUniqueMentions(without, related.mentions);
        });
        setLikes((prev) => {
          const without = prev.filter((l) => !idSet.has(l.post_id));
          return mergeUniqueLikes(without, related.likes);
        });
        setComments((prev) => {
          const without = prev.filter((c) => !idSet.has(c.post_id));
          return mergeUniqueComments(without, related.comments);
        });

        if (rows.length < COMMUNITY_POSTS_PAGE_SIZE) {
          setHasMorePosts(false);
        } else if (prevPostCount === 0) {
          setHasMorePosts(rows.length === COMMUNITY_POSTS_PAGE_SIZE);
        } else if (rows.length < prevPostCount) {
          setHasMorePosts(true);
        } else {
          setHasMorePosts(rows.length % COMMUNITY_POSTS_PAGE_SIZE === 0);
        }
      }
    }

    const loadedCategories = (categoriesRes.data || []) as CommunityCategory[];
    setCategories(loadedCategories);
    setNewPostCategoryId((prev) => {
      if (!prev && loadedCategories.length > 0) return loadedCategories[0].id;
      return prev;
    });

    const nextProfiles: Record<string, CommunityProfile> = {};
    ((profilesRes.data || []) as CommunityProfile[]).forEach((p) => {
      nextProfiles[p.user_id] = p;
    });
    if (userId) {
      nextProfiles[userId] = {
        user_id: userId,
        nome_completo: config.nome_completo || nextProfiles[userId]?.nome_completo || null,
        nome_projeto: config.nome_projeto || nextProfiles[userId]?.nome_projeto || null,
        logo_url: config.logo_url || nextProfiles[userId]?.logo_url || null,
      };
    }
    setProfiles(nextProfiles);
    if (!silent) setLoading(false);
  }, [config.logo_url, config.nome_completo, config.nome_projeto]);

  const loadMorePosts = useCallback(async () => {
    if (loadingMore || !hasMorePosts) return;
    setLoadingMore(true);
    try {
      const start = postsRef.current.length;
      const end = start + COMMUNITY_POSTS_PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("community_posts")
        .select("id,author_user_id,category_id,content,created_at,updated_at,is_edited")
        .order("created_at", { ascending: false })
        .range(start, end);
      if (error) {
        toast.error("Erro ao carregar mais publicações");
        return;
      }
      const batch = (data || []) as CommunityPost[];
      if (batch.length === 0) {
        setHasMorePosts(false);
        return;
      }
      const batchIds = batch.map((p) => p.id);
      const batchRelated = await fetchCommunityFeedRelatedRows(batchIds);
      if (batchRelated.error) {
        toast.error("Erro ao carregar mais publicações");
        return;
      }
      setPosts((prev) => mergeUniquePosts(prev, batch));
      setMedia((prev) => mergeUniqueMedia(prev, batchRelated.media));
      setMentions((prev) => mergeUniqueMentions(prev, batchRelated.mentions));
      setLikes((prev) => mergeUniqueLikes(prev, batchRelated.likes));
      setComments((prev) => mergeUniqueComments(prev, batchRelated.comments));
      setHasMorePosts(batch.length === COMMUNITY_POSTS_PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMorePosts, loadingMore]);

  useEffect(() => {
    void fetchAll({ silent: false });
  }, [fetchAll]);

  useEffect(() => {
    const channel = supabase
      .channel("community-feed-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, () => void fetchAll({ silent: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "community_post_media" }, () => void fetchAll({ silent: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "community_post_mentions" }, () => void fetchAll({ silent: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "community_post_likes" }, () => void fetchAll({ silent: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "community_post_comments" }, () => void fetchAll({ silent: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "community_categories" }, () => void fetchAll({ silent: true }))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const mentionOptions = useMemo(
    () =>
      Object.values(profiles)
        .filter((p) => p.user_id !== currentUserId)
        .sort((a, b) => displayName(a).localeCompare(displayName(b))),
    [profiles, currentUserId],
  );

  const mediaByPost = useMemo(() => {
    const map: Record<string, CommunityMedia[]> = {};
    for (const m of media) {
      const list = map[m.post_id];
      if (list) list.push(m);
      else map[m.post_id] = [m];
    }
    return map;
  }, [media]);

  const mentionsByPost = useMemo(() => {
    const map: Record<string, CommunityMention[]> = {};
    for (const m of mentions) {
      const list = map[m.post_id];
      if (list) list.push(m);
      else map[m.post_id] = [m];
    }
    return map;
  }, [mentions]);

  const likesByPost = useMemo(() => {
    const map: Record<string, CommunityLike[]> = {};
    for (const l of likes) {
      const list = map[l.post_id];
      if (list) list.push(l);
      else map[l.post_id] = [l];
    }
    return map;
  }, [likes]);

  const commentsByPost = useMemo(() => {
    const map: Record<string, CommunityComment[]> = {};
    for (const c of comments) {
      const list = map[c.post_id];
      if (list) list.push(c);
      else map[c.post_id] = [c];
    }
    return map;
  }, [comments]);

  const visiblePosts = useMemo(
    () => posts.filter((p) => activeCategoryId === "all" || p.category_id === activeCategoryId),
    [posts, activeCategoryId],
  );

  const categoryById = useMemo(() => {
    const map: Record<string, CommunityCategory> = {};
    for (const c of categories) {
      map[c.id] = c;
    }
    return map;
  }, [categories]);

  const toggleMention = (userId: string) => {
    setSelectedMentions((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const canEditOrDeletePost = (post: CommunityPost) => {
    if (!currentUserId) return false;
    return post.author_user_id === currentUserId || isAdminMaster;
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name || !currentUserId) return;
    const { error } = await supabase.from("community_categories").insert({
      name,
      created_by_user_id: currentUserId,
      is_active: true,
    });
    if (error) {
      toast.error("Erro ao criar categoria");
      return;
    }
    setNewCategoryName("");
    toast.success("Categoria criada");
    void fetchAll({ silent: true });
  };

  const handleSaveCategoryEdit = async () => {
    const name = editingCategoryName.trim();
    if (!editingCategoryId || !name) return;
    const { error } = await supabase
      .from("community_categories")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", editingCategoryId);
    if (error) {
      toast.error("Erro ao editar categoria");
      return;
    }
    setEditingCategoryId(null);
    setEditingCategoryName("");
    toast.success("Categoria atualizada");
    void fetchAll({ silent: true });
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const { error } = await supabase.from("community_categories").delete().eq("id", categoryId);
    if (error) {
      toast.error("Erro ao excluir categoria");
      return;
    }
    if (activeCategoryId === categoryId) setActiveCategoryId("all");
    if (newPostCategoryId === categoryId) setNewPostCategoryId("");
    toast.success("Categoria excluída");
    void fetchAll({ silent: true });
  };

  const confirmDeleteCategory = async () => {
    if (!pendingDeleteCategoryId) return;
    setCategoryDeleteLoading(true);
    try {
      await handleDeleteCategory(pendingDeleteCategoryId);
    } finally {
      setCategoryDeleteLoading(false);
      setPendingDeleteCategoryId(null);
    }
  };

  const handleCreatePost = async () => {
    const content = newPostContent.trim();
    if (!content) {
      toast.error("Escreva algo para publicar");
      return;
    }
    if (!currentUserId) {
      toast.error("Usuário não autenticado");
      return;
    }
    if (!newPostCategoryId) {
      toast.error("Selecione uma categoria da publicação");
      return;
    }

    setPublishing(true);
    try {
      const { data: inserted, error: postError } = await supabase
        .from("community_posts")
        .insert({ author_user_id: currentUserId, content, category_id: newPostCategoryId })
        .select("id")
        .single();

      if (postError || !inserted) throw postError || new Error("Falha ao criar publicação");

      const postId = inserted.id as string;

      if (newPostFiles.length > 0) {
        const mediaRows: { post_id: string; media_type: "image" | "video"; media_url: string; storage_path: string; position: number }[] = [];

        for (let i = 0; i < newPostFiles.length; i += 1) {
          const file = newPostFiles[i];
          const { mime } = await assertUploadMagicBytes(file, "raster-or-video", 25 * 1024 * 1024);
          const isVideo = mime.startsWith("video/");
          const mediaType = isVideo ? "video" : "image";
          const ext = extensionForDetectedMime(mime);
          const filePath = `${currentUserId}/${postId}/${Date.now()}-${i}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("community-media")
            .upload(filePath, file, { upsert: false, cacheControl: "3600" });
          if (uploadError) throw uploadError;

          const { data: pub } = supabase.storage.from("community-media").getPublicUrl(filePath);
          mediaRows.push({
            post_id: postId,
            media_type: mediaType,
            media_url: pub.publicUrl,
            storage_path: filePath,
            position: i,
          });
        }

        const { error: mediaError } = await supabase.from("community_post_media").insert(mediaRows);
        if (mediaError) throw mediaError;
      }

      if (selectedMentions.length > 0) {
        const rows = selectedMentions.map((mentionedUserId) => ({
          post_id: postId,
          mentioned_user_id: mentionedUserId,
          mentioned_by_user_id: currentUserId,
        }));
        const { error: mentionsError } = await supabase.from("community_post_mentions").insert(rows);
        if (mentionsError) throw mentionsError;
      }

      setNewPostContent("");
      setNewPostFiles([]);
      setSelectedMentions([]);
      setNewPostCategoryId(categories[0]?.id || "");
      toast.success("Publicação criada");
      void fetchAll({ silent: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "desconhecido";
      toast.error(`Erro ao publicar: ${message}`);
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveEditPost = async (post: CommunityPost) => {
    const content = editingContentRef.current.trim();
    if (!content) {
      toast.error("O texto não pode ficar vazio");
      return;
    }
    const { error } = await supabase
      .from("community_posts")
      .update({ content, updated_at: new Date().toISOString(), is_edited: true })
      .eq("id", post.id);
    if (error) {
      toast.error("Erro ao salvar edição");
      return;
    }
    toast.success("Publicação atualizada");
    setEditingPostId(null);
    setEditingContent("");
    void fetchAll({ silent: true });
  };

  const handleDeletePost = async (post: CommunityPost) => {
    const { error } = await supabase.from("community_posts").delete().eq("id", post.id);
    if (error) {
      toast.error("Erro ao excluir publicação");
      return;
    }
    toast.success("Publicação removida");
    void fetchAll({ silent: true });
  };

  const confirmDeletePost = async () => {
    if (!pendingDeletePost) return;
    await handleDeletePost(pendingDeletePost);
    setPendingDeletePost(null);
  };

  const handleToggleLike = async (postId: string) => {
    const uid = currentUserIdRef.current;
    if (!uid) return;
    const liked = likesRef.current.some((l) => l.post_id === postId && l.user_id === uid);
    if (liked) {
      const { error } = await supabase
        .from("community_post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", uid);
      if (error) toast.error("Erro ao remover curtida");
    } else {
      // PK (post_id, user_id): insert duplicado retorna 409 — upsert com ignore evita corrida / duplo clique.
      const { error } = await supabase.from("community_post_likes").upsert(
        { post_id: postId, user_id: uid },
        { onConflict: "post_id,user_id", ignoreDuplicates: true },
      );
      if (error) toast.error("Erro ao curtir publicação");
    }
    void fetchAll({ silent: true });
  };

  const handleAddComment = async (postId: string) => {
    const content = (commentDraftsRef.current[postId] || "").trim();
    if (!content) return;
    const uid = currentUserIdRef.current;
    if (!uid) return;

    const { error } = await supabase.from("community_post_comments").insert({
      post_id: postId,
      user_id: uid,
      content,
    });
    if (error) {
      toast.error("Erro ao comentar");
      return;
    }
    setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    void fetchAll({ silent: true });
  };

  const handleDeleteComment = async (comment: CommunityComment) => {
    const { error } = await supabase.from("community_post_comments").delete().eq("id", comment.id);
    if (error) {
      toast.error("Erro ao excluir comentário");
      return;
    }
    toast.success("Comentário removido");
    void fetchAll({ silent: true });
  };

  const confirmDeleteComment = async () => {
    if (!pendingDeleteComment) return;
    await handleDeleteComment(pendingDeleteComment);
    setPendingDeleteComment(null);
  };

  const handleSaveCommentEdit = async (comment: CommunityComment) => {
    const content = editingCommentTextRef.current.trim();
    if (!content) {
      toast.error("O comentário não pode ficar vazio");
      return;
    }
    const { error } = await supabase
      .from("community_post_comments")
      .update({
        content,
        updated_at: new Date().toISOString(),
        is_edited: true,
      })
      .eq("id", comment.id);
    if (error) {
      toast.error("Erro ao salvar comentário");
      return;
    }
    toast.success("Comentário atualizado");
    setEditingCommentId(null);
    setEditingCommentText("");
    void fetchAll({ silent: true });
  };

  feedCardInteractionsRef.current = {
    toggleLike: (postId: string) => {
      void handleToggleLike(postId);
    },
    addComment: (postId: string) => {
      void handleAddComment(postId);
    },
    savePostEdit: (post: CommunityPost) => {
      void handleSaveEditPost(post);
    },
    saveCommentEdit: (comment: CommunityComment) => {
      void handleSaveCommentEdit(comment);
    },
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-20", isAdminPanel && "px-6")}>
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isAdminPanel ? (
        <SlideCarousel
          pagina="comunidade"
          variant="banner"
          breakoutHorizontal={false}
          breakoutTop={false}
        />
      ) : (
        <SlideCarousel pagina="comunidade" variant="banner" />
      )}

      <div
        className={cn(
          "flex flex-col gap-6 xl:flex-row xl:items-start",
          isAdminPanel && "px-6",
        )}
      >
        <div className="flex min-w-0 flex-1 justify-center xl:min-h-0">
          <div className="mx-auto w-full max-w-3xl space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <p className="font-semibold text-foreground">Nova publicação</p>
              <Button variant="outline" size="icon" onClick={() => void fetchAll({ silent: true })} title="Atualizar feed">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Compartilhe uma novidade com a comunidade..."
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                rows={4}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm">Categoria</Label>
                  <Select value={newPostCategoryId} onValueChange={setNewPostCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Adicionar imagens e vídeos</Label>
                  <Input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={(e) => void handleFilesPicked(Array.from(e.target.files || []))}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Imagens obrigatoriamente em 1536x1024px. Vídeos seguem formato livre.
                  </p>
                  {newPostFiles.length > 0 && (
                    <p className="text-xs text-muted-foreground">{newPostFiles.length} arquivo(s) selecionado(s)</p>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm">Marcar usuários</Label>
                  <div className="max-h-28 overflow-y-auto rounded-md border border-border p-2">
                    {mentionOptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum usuário disponível para marcação</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {mentionOptions.map((m) => (
                          <button
                            key={m.user_id}
                            type="button"
                            onClick={() => toggleMention(m.user_id)}
                            className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                              selectedMentions.includes(m.user_id)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            @{displayName(m)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <Button onClick={() => void handleCreatePost()} disabled={publishing}>
                Publicar
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {visiblePosts.map((post) => {
              const authorProfile = profiles[post.author_user_id];
              const postMedia = mediaByPost[post.id] ?? [];
              const postMentions = mentionsByPost[post.id] ?? [];
              const postLikes = likesByPost[post.id] ?? [];
              const postComments = commentsByPost[post.id] ?? [];
              const userLiked = !!currentUserId && postLikes.some((l) => l.user_id === currentUserId);
              const editingCommentOnThisPost =
                editingCommentId !== null && postComments.some((c) => c.id === editingCommentId);
              const editingCommentDraftForCard = editingCommentOnThisPost ? editingCommentText : "";
              const categoryLabel = categoryById[post.category_id ?? ""]?.name ?? "Sem categoria";

              return (
                <CommunityFeedPostCard
                  key={post.id}
                  post={post}
                  postMedia={postMedia}
                  postMentions={postMentions}
                  postLikes={postLikes}
                  postComments={postComments}
                  authorProfile={authorProfile}
                  categoryLabel={categoryLabel}
                  profiles={profiles}
                  currentUserId={currentUserId}
                  isAdminMaster={isAdminMaster}
                  canEditPost={canEditOrDeletePost(post)}
                  userLiked={userLiked}
                  editingPostId={editingPostId}
                  editingBodyForCard={editingPostId === post.id ? editingContent : ""}
                  editingCommentId={editingCommentId}
                  editingCommentDraftForCard={editingCommentDraftForCard}
                  commentDraftForPost={commentDrafts[post.id] || ""}
                  interactionsRef={feedCardInteractionsRef}
                  setEditingPostId={setEditingPostId}
                  setEditingContent={setEditingContent}
                  setPendingDeletePost={setPendingDeletePost}
                  setEditingCommentId={setEditingCommentId}
                  setEditingCommentText={setEditingCommentText}
                  setPendingDeleteComment={setPendingDeleteComment}
                  setCommentDrafts={setCommentDrafts}
                />
              );
            })}
            {hasMorePosts && (
              <div className="flex justify-center pt-2">
                <Button type="button" variant="outline" disabled={loadingMore} onClick={() => void loadMorePosts()}>
                  {loadingMore ? "A carregar…" : "Carregar mais"}
                </Button>
              </div>
            )}
          </div>
        </div>
        </div>

        <aside className="w-full shrink-0 space-y-4 xl:w-[min(100%,28rem)] xl:min-w-[24rem]">
          <Card>
            <CardHeader className="pb-2">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <Tags className="h-4 w-4" />
                Categorias
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              <button
                type="button"
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                  activeCategoryId === "all" ? "border-primary bg-primary/10 text-primary" : "border-border"
                }`}
                onClick={() => setActiveCategoryId("all")}
              >
                Todas as categorias
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                    activeCategoryId === category.id ? "border-primary bg-primary/10 text-primary" : "border-border"
                  }`}
                  onClick={() => setActiveCategoryId(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </CardContent>
          </Card>

          {isAdminMaster && (
            <Card>
              <CardHeader className="pb-2">
                <p className="font-semibold text-foreground">Gerenciar categorias</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nova categoria"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                  <Button size="sm" onClick={() => void handleCreateCategory()}>Criar</Button>
                </div>
                <div className="space-y-2">
                  {categories.map((category) => (
                    <div key={category.id} className="rounded-md border border-border p-2">
                      {editingCategoryId === category.id ? (
                        <div className="space-y-2">
                          <Input value={editingCategoryName} onChange={(e) => setEditingCategoryName(e.target.value)} />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => void handleSaveCategoryEdit()}>Salvar</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingCategoryId(null)}>Cancelar</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm text-foreground">{category.name}</p>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingCategoryId(category.id);
                                setEditingCategoryName(category.name);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setPendingDeleteCategoryId(category.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      <ConfirmDeleteDialog
        open={pendingDeleteCategoryId !== null}
        onOpenChange={(o) => !o && setPendingDeleteCategoryId(null)}
        title="Excluir categoria?"
        description="Posts podem estar vinculados a esta categoria. A categoria será removida permanentemente. Deseja continuar?"
        onConfirm={confirmDeleteCategory}
        loading={categoryDeleteLoading}
      />

      <AlertDialog open={!!pendingDeletePost} onOpenChange={(open) => !open && setPendingDeletePost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir publicação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A publicação será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDeletePost()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDeleteComment} onOpenChange={(open) => !open && setPendingDeleteComment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comentário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza de que deseja remover este comentário? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDeleteComment()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

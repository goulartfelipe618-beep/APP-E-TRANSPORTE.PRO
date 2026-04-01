import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Heart, MessageCircle, Pencil, Trash2, RefreshCw, ImagePlus, Video, Tags, MoreHorizontal } from "lucide-react";
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

export default function CommunityFeed() {
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

  const fetchAll = useCallback(async () => {
    setLoading(true);
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

    const [postsRes, mediaRes, mentionsRes, likesRes, commentsRes, profilesRes, categoriesRes] = await Promise.all([
      supabase.from("community_posts").select("*").order("created_at", { ascending: false }),
      supabase.from("community_post_media").select("*").order("position", { ascending: true }),
      supabase.from("community_post_mentions").select("*"),
      supabase.from("community_post_likes").select("*"),
      supabase.from("community_post_comments").select("*").order("created_at", { ascending: true }),
      supabase.from("configuracoes").select("user_id,nome_completo,nome_projeto,logo_url"),
      supabase.from("community_categories").select("*").eq("is_active", true).order("name", { ascending: true }),
    ]);

    if (postsRes.error || mediaRes.error || mentionsRes.error || likesRes.error || commentsRes.error || profilesRes.error || categoriesRes.error) {
      toast.error("Erro ao carregar Comunidade");
      setLoading(false);
      return;
    }

    setPosts((postsRes.data || []) as CommunityPost[]);
    setMedia((mediaRes.data || []) as CommunityMedia[]);
    setMentions((mentionsRes.data || []) as CommunityMention[]);
    setLikes((likesRes.data || []) as CommunityLike[]);
    setComments((commentsRes.data || []) as CommunityComment[]);
    const loadedCategories = (categoriesRes.data || []) as CommunityCategory[];
    setCategories(loadedCategories);
    if (!newPostCategoryId && loadedCategories.length > 0) {
      setNewPostCategoryId(loadedCategories[0].id);
    }

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
    setLoading(false);
  }, [config.logo_url, config.nome_completo, config.nome_projeto]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const channel = supabase
      .channel("community-feed-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_posts" }, () => void fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_post_media" }, () => void fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_post_mentions" }, () => void fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_post_likes" }, () => void fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_post_comments" }, () => void fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "community_categories" }, () => void fetchAll())
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
    void fetchAll();
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
    void fetchAll();
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
    void fetchAll();
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
          const isVideo = file.type.startsWith("video/");
          const mediaType = isVideo ? "video" : "image";
          const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const filePath = `${currentUserId}/${postId}/${Date.now()}-${i}-${sanitized}`;

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
      void fetchAll();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "desconhecido";
      toast.error(`Erro ao publicar: ${message}`);
    } finally {
      setPublishing(false);
    }
  };

  const handleSaveEditPost = async (post: CommunityPost) => {
    const content = editingContent.trim();
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
    void fetchAll();
  };

  const handleDeletePost = async (post: CommunityPost) => {
    const { error } = await supabase.from("community_posts").delete().eq("id", post.id);
    if (error) {
      toast.error("Erro ao excluir publicação");
      return;
    }
    toast.success("Publicação removida");
    void fetchAll();
  };

  const confirmDeletePost = async () => {
    if (!pendingDeletePost) return;
    await handleDeletePost(pendingDeletePost);
    setPendingDeletePost(null);
  };

  const handleToggleLike = async (postId: string) => {
    if (!currentUserId) return;
    const liked = likes.some((l) => l.post_id === postId && l.user_id === currentUserId);
    if (liked) {
      const { error } = await supabase
        .from("community_post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", currentUserId);
      if (error) toast.error("Erro ao remover curtida");
    } else {
      const { error } = await supabase.from("community_post_likes").insert({ post_id: postId, user_id: currentUserId });
      if (error) toast.error("Erro ao curtir publicação");
    }
    void fetchAll();
  };

  const handleAddComment = async (postId: string) => {
    const content = (commentDrafts[postId] || "").trim();
    if (!content) return;
    if (!currentUserId) return;

    const { error } = await supabase.from("community_post_comments").insert({
      post_id: postId,
      user_id: currentUserId,
      content,
    });
    if (error) {
      toast.error("Erro ao comentar");
      return;
    }
    setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    void fetchAll();
  };

  const handleDeleteComment = async (comment: CommunityComment) => {
    const { error } = await supabase.from("community_post_comments").delete().eq("id", comment.id);
    if (error) {
      toast.error("Erro ao excluir comentário");
      return;
    }
    void fetchAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const visiblePosts = posts.filter((p) => activeCategoryId === "all" || p.category_id === activeCategoryId);
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="mx-auto w-full max-w-3xl space-y-6 xl:mx-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <p className="font-semibold text-foreground">Nova publicação</p>
              <Button variant="outline" size="icon" onClick={() => void fetchAll()} title="Atualizar feed">
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
              const authorName = displayName(authorProfile);
              const postMedia = media.filter((m) => m.post_id === post.id);
              const postMentions = mentions.filter((m) => m.post_id === post.id);
              const postLikes = likes.filter((l) => l.post_id === post.id);
              const postComments = comments.filter((c) => c.post_id === post.id);
              const userLiked = !!currentUserId && postLikes.some((l) => l.user_id === currentUserId);

              return (
                <Card key={post.id}>
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
                      {canEditOrDeletePost(post) && (
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
                    {editingPostId === post.id ? (
                      <div className="space-y-2">
                        <Textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} rows={4} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => void handleSaveEditPost(post)}>Salvar edição</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingPostId(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm text-foreground">{post.content}</p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{categoryMap.get(post.category_id || "") || "Sem categoria"}</Badge>
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
                        onClick={() => void handleToggleLike(post.id)}
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
                        const canDeleteComment = !!currentUserId && (comment.user_id === currentUserId || isAdminMaster);
                        return (
                          <div key={comment.id} className="rounded-md border border-border bg-muted/20 p-2">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={commentAuthor?.logo_url || undefined} alt={commentAuthorName} />
                                  <AvatarFallback className="text-[10px]">{initialsFromName(commentAuthorName)}</AvatarFallback>
                                </Avatar>
                                <p className="text-xs font-medium text-foreground">{commentAuthorName}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-[11px] text-muted-foreground">
                                  {new Date(comment.created_at).toLocaleString("pt-BR")}
                                </p>
                                {canDeleteComment && (
                                  <button
                                    type="button"
                                    className="text-destructive text-xs hover:underline"
                                    onClick={() => void handleDeleteComment(comment)}
                                  >
                                    excluir
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="whitespace-pre-wrap text-xs text-foreground">{comment.content}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        placeholder="Comentar nesta publicação..."
                        value={commentDrafts[post.id] || ""}
                        onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                      />
                      <Button size="sm" onClick={() => void handleAddComment(post.id)}>
                        Enviar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
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
                              onClick={() => void handleDeleteCategory(category.id)}
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
    </div>
  );
}

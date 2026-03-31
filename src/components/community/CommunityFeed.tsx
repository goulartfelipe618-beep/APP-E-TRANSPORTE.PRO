import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, MessageCircle, Pencil, Trash2, RefreshCw, Tags, MoreHorizontal, Check } from "lucide-react";
import { cn } from "@/lib/utils";
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

type Props = {
  /** Texto de apoio discreto (ex.: contexto admin x motorista). O título principal do hero é fixo: Aba Comunidade. */
  subtitle: string;
};

const COMMUNITY_VALUE_PROPOSITION =
  "Conecte sua operação, fortaleça reputação e mantenha todos alinhados — sem misturar o foco da conversa com ofertas externas ao canal.";

const COMMUNITY_BENEFITS = [
  "Canal oficial para comunicação entre administradores, motoristas executivos e taxistas",
  "Publicações e comentários com identidade visual consistente da plataforma",
  "Conteúdo organizado por categorias, com mídia padronizada para leitura clara",
];

const HERO_CAR_IMAGE =
  "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=80";

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

export default function CommunityFeed({ subtitle }: Props) {
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
    <div className="space-y-10 pb-10">
      {/* Hero — hierarquia premium, foco na Aba Comunidade */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0b1220] via-[#0f172a] to-[#111827] px-5 py-10 shadow-2xl md:px-10 md:py-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-30%,rgba(37,99,235,0.18),transparent)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(255,255,255,0.04),transparent)]" />

        <div className="relative">
          <div className="mb-6 flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:bg-white/5 hover:text-white"
              onClick={() => void fetchAll()}
              title="Atualizar feed"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-center text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
            E-Transporte.pro
          </p>
          <h1 className="mx-auto mt-3 max-w-4xl text-center font-sans text-4xl font-extrabold leading-[1.1] tracking-tight text-white md:text-5xl">
            Aba Comunidade
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-center text-base leading-relaxed text-slate-300 md:text-lg">
            {COMMUNITY_VALUE_PROPOSITION}
          </p>
          <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-relaxed text-slate-500">
            {subtitle}
          </p>

          <div className="mx-auto mt-12 max-w-5xl border-t border-white/10 pt-10">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
              <ul className="space-y-4 text-left">
                {COMMUNITY_BENEFITS.map((line) => (
                  <li key={line} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-blue-300 ring-1 ring-blue-500/30">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <span className="text-sm leading-relaxed text-slate-400 md:text-[0.9375rem]">{line}</span>
                  </li>
                ))}
              </ul>
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_64px_rgba(0,0,0,0.45)]">
                <img
                  src={HERO_CAR_IMAGE}
                  alt="Veículo executivo em perspectiva — representação aspiracional do serviço premium"
                  className="h-full w-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b1220]/80 via-transparent to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="mx-auto w-full max-w-2xl space-y-8 xl:mx-0">
          <div
            className={cn(
              "rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl shadow-xl",
              "md:p-8",
            )}
          >
            <p className="font-semibold tracking-tight text-slate-100">Nova publicação</p>
            <p className="mt-1 text-sm text-slate-500">
              Compartilhe atualizações oficiais. Imagens devem seguir o padrão da plataforma (1536×1024).
            </p>
            <div className="mt-6 space-y-6">
              <Textarea
                placeholder="Escreva o conteúdo principal da publicação…"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                rows={4}
                className="border-white/10 bg-white/[0.04] text-slate-100 placeholder:text-slate-500"
              />
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-300">Categoria</Label>
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
                  <Label className="text-sm text-slate-300">Imagens e vídeos</Label>
                  <Input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={(e) => void handleFilesPicked(Array.from(e.target.files || []))}
                  />
                  <p className="text-[11px] text-slate-500">
                    Imagens: exatamente 1536×1024 px. Vídeos: formato livre.
                  </p>
                  {newPostFiles.length > 0 && (
                    <p className="text-xs text-slate-500">{newPostFiles.length} arquivo(s) selecionado(s)</p>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm text-slate-300">Marcar usuários</Label>
                  <div className="max-h-28 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.03] p-2">
                    {mentionOptions.length === 0 ? (
                      <p className="text-xs text-slate-500">Nenhum usuário disponível para marcação</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {mentionOptions.map((m) => (
                          <button
                            key={m.user_id}
                            type="button"
                            onClick={() => toggleMention(m.user_id)}
                            className={cn(
                              "rounded-lg border px-2.5 py-1 text-xs transition-colors",
                              selectedMentions.includes(m.user_id)
                                ? "border-blue-500/40 bg-blue-600/15 text-blue-100"
                                : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-slate-200",
                            )}
                          >
                            @{displayName(m)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <Button className="w-full sm:w-auto" onClick={() => void handleCreatePost()} disabled={publishing}>
                Publicar na comunidade
              </Button>
            </div>
          </div>

          <div className="space-y-8">
            {visiblePosts.map((post) => {
              const authorProfile = profiles[post.author_user_id];
              const authorName = displayName(authorProfile);
              const postMedia = media.filter((m) => m.post_id === post.id);
              const postImages = postMedia.filter((m) => m.media_type === "image");
              const postVideos = postMedia.filter((m) => m.media_type === "video");
              const postMentions = mentions.filter((m) => m.post_id === post.id);
              const postLikes = likes.filter((l) => l.post_id === post.id);
              const postComments = comments.filter((c) => c.post_id === post.id);
              const userLiked = !!currentUserId && postLikes.some((l) => l.user_id === currentUserId);

              return (
                <article
                  key={post.id}
                  className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-xl backdrop-blur-xl"
                >
                  <div className="border-b border-white/10 px-6 py-5 md:px-8">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-11 w-11 ring-2 ring-white/10">
                          <AvatarImage src={authorProfile?.logo_url || undefined} alt={authorName} />
                          <AvatarFallback className="bg-slate-800 text-slate-200">{initialsFromName(authorName)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold tracking-tight text-slate-100">{authorName}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(post.created_at).toLocaleString("pt-BR")}
                            {post.is_edited ? " · editado" : ""}
                          </p>
                        </div>
                      </div>
                      {canEditOrDeletePost(post) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-white/5 hover:text-white">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="border-white/10 bg-slate-900 text-slate-100">
                            <DropdownMenuItem
                              className="focus:bg-white/10"
                              onClick={() => {
                                setEditingPostId(post.id);
                                setEditingContent(post.content);
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-400 focus:bg-red-500/10 focus:text-red-300"
                              onClick={() => setPendingDeletePost(post)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  <div className="space-y-8 px-6 py-6 md:px-8 md:py-8">
                    {editingPostId === post.id ? (
                      <div className="space-y-3">
                        <Textarea
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          rows={4}
                          className="border-white/10 bg-white/[0.04] text-slate-100"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => void handleSaveEditPost(post)}>Salvar</Button>
                          <Button size="sm" variant="outline" className="border-white/15 bg-transparent text-slate-200" onClick={() => setEditingPostId(null)}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-slate-200">{post.content}</p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium text-slate-300">
                        {categoryMap.get(post.category_id || "") || "Sem categoria"}
                      </span>
                      {postMentions.map((mention) => (
                        <span
                          key={`${mention.post_id}-${mention.mentioned_user_id}`}
                          className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs text-blue-200/90"
                        >
                          @{displayName(profiles[mention.mentioned_user_id])}
                        </span>
                      ))}
                    </div>
                  </div>

                  {postImages.length > 0 && (
                    <div
                      className={cn(
                        "grid gap-4 px-4 pb-8 pt-2 sm:px-6",
                        postImages.length === 1 ? "sm:grid-cols-1" : "sm:grid-cols-2",
                      )}
                    >
                      {postImages.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "overflow-hidden rounded-2xl border border-white/15 bg-white/[0.07] p-3 shadow-[0_8px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl",
                            postImages.length === 1 && "sm:col-span-2",
                          )}
                        >
                          <img
                            src={item.media_url}
                            alt="Conteúdo visual da publicação"
                            className="block w-full rounded-xl object-contain"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {postVideos.length > 0 && (
                    <div className="grid gap-4 px-4 pb-8 pt-2 sm:px-6 sm:grid-cols-1">
                      {postVideos.map((item) => (
                        <div
                          key={item.id}
                          className="overflow-hidden rounded-2xl border border-white/15 bg-white/[0.07] p-3 backdrop-blur-xl"
                        >
                          <video src={item.media_url} controls className="aspect-video w-full rounded-xl bg-black object-contain" />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-white/10 px-6 py-5 md:px-8">
                    <div className="flex flex-wrap items-center gap-4">
                      <button
                        type="button"
                        onClick={() => void handleToggleLike(post.id)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                          userLiked
                            ? "border-blue-500/40 bg-blue-600/20 text-blue-100"
                            : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/[0.07]",
                        )}
                      >
                        <Heart className={cn("h-4 w-4", userLiked && "fill-current")} />
                        {postLikes.length > 0 ? `${postLikes.length} curtida${postLikes.length !== 1 ? "s" : ""}` : "Curtir"}
                      </button>
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                        <MessageCircle className="h-4 w-4 text-slate-500" />
                        {postComments.length} comentário{postComments.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="mt-6 space-y-3">
                      {postComments.map((comment) => {
                        const commentAuthor = profiles[comment.user_id];
                        const commentAuthorName = displayName(commentAuthor);
                        const canDeleteComment = !!currentUserId && (comment.user_id === currentUserId || isAdminMaster);
                        return (
                          <div key={comment.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-7 w-7">
                                  <AvatarImage src={commentAuthor?.logo_url || undefined} alt={commentAuthorName} />
                                  <AvatarFallback className="bg-slate-800 text-[10px] text-slate-200">{initialsFromName(commentAuthorName)}</AvatarFallback>
                                </Avatar>
                                <p className="text-xs font-medium text-slate-200">{commentAuthorName}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-[11px] text-slate-500">
                                  {new Date(comment.created_at).toLocaleString("pt-BR")}
                                </p>
                                {canDeleteComment && (
                                  <button
                                    type="button"
                                    className="text-xs text-red-400/90 hover:underline"
                                    onClick={() => void handleDeleteComment(comment)}
                                  >
                                    excluir
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{comment.content}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Input
                        placeholder="Escreva um comentário…"
                        value={commentDrafts[post.id] || ""}
                        onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [post.id]: e.target.value }))}
                        className="flex-1 border-white/10 bg-white/[0.04] text-slate-100 placeholder:text-slate-500"
                      />
                      <Button className="shrink-0 sm:min-w-[140px]" onClick={() => void handleAddComment(post.id)}>
                        Comentar
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl shadow-lg">
            <p className="font-semibold tracking-tight text-slate-100 flex items-center gap-2">
              <Tags className="h-4 w-4 text-slate-400" />
              Categorias
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                className={cn(
                  "w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                  activeCategoryId === "all"
                    ? "border-blue-500/40 bg-blue-600/15 text-blue-100"
                    : "border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.06]",
                )}
                onClick={() => setActiveCategoryId("all")}
              >
                Todas as categorias
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={cn(
                    "w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                    activeCategoryId === category.id
                      ? "border-blue-500/40 bg-blue-600/15 text-blue-100"
                      : "border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.06]",
                  )}
                  onClick={() => setActiveCategoryId(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {isAdminMaster && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl shadow-lg">
              <p className="font-semibold tracking-tight text-slate-100">Gerenciar categorias</p>
              <div className="mt-4 space-y-3">
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
                    <div key={category.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
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
                          <p className="text-sm text-slate-200">{category.name}</p>
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
              </div>
            </div>
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

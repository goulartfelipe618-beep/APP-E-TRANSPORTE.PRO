import NetworkCollaborationFeed from "@/components/network/NetworkCollaborationFeed";

export default function NetworkPage() {
  return (
    <NetworkCollaborationFeed
      allowModeratorDelete={false}
      title="Network"
      subtitle="Oportunidades compartilhadas entre motoristas: repasses, parcerias na região e solicitações. O que você publicar fica visível para os demais motoristas do sistema; você também vê as publicações de todos."
    />
  );
}

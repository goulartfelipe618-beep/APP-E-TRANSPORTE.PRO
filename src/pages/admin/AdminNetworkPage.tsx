import NetworkCollaborationFeed from "@/components/network/NetworkCollaborationFeed";

export default function AdminNetworkPage() {
  return (
    <NetworkCollaborationFeed
      allowModeratorDelete
      title="Network — Admin Master"
      subtitle="Canal colaborativo: veja e publique oportunidades de viagens para todos os motoristas executivos da plataforma. As publicações aparecem em tempo real no painel de cada motorista."
    />
  );
}

import ClientProviders from "@/components/ClientProviders";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ClientProviders>{children}</ClientProviders>;
}

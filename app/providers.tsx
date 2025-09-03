import dynamic from "next/dynamic";

// Load the client-only providers as a single client boundary to avoid importing Chakra/system on the server.
const ClientProviders = dynamic(() => import("@/components/ClientProviders"), {
  ssr: false,
});

export default function Providers({ children }: { children: React.ReactNode }) {
  // Server component - renders minimal shell. ClientProviders hydrates client-only UI.
  return <ClientProviders>{children}</ClientProviders>;
}

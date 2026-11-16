import App from "@/components/App";
import { ensureDbSetup } from "@/lib/db-setup";

export const dynamic = "force-dynamic";

export default async function Page() {
  void ensureDbSetup().catch(() => {});
  return <App />;
}

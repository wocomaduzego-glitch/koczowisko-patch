import App from "@/components/App";
import { ensureDbSetup } from "@/lib/db-setup";

export const dynamic = "force-dynamic";
export const metadata = { title: "Koczowisko Web — muzyka w przeglądarce" };

export default async function WebPage() {
  await ensureDbSetup();
  return <App />;
}

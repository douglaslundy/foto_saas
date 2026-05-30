import "dotenv/config"
import { Queue } from "bullmq"
import { connection } from "./src/lib/queues/connection"
import { createAdminClient } from "./src/lib/supabase/admin"

async function main() {
  const supabase = createAdminClient()
  const watermarkQueue = new Queue("watermark", { connection })

  const { data: photos } = await (supabase as any)
    .from("photos")
    .select("id, event_id, tenant_id, original_storage_path")
    .in("status", ["error", "processing"])

  if (!photos || photos.length === 0) {
    console.log("Nenhuma foto para reprocessar")
    await watermarkQueue.close()
    return
  }

  for (const p of photos) {
    await (supabase as any).from("photos").update({ status: "processing" }).eq("id", p.id)
    await watermarkQueue.add("watermark", {
      photo_id: p.id, event_id: p.event_id, tenant_id: p.tenant_id,
      original_storage_path: p.original_storage_path,
    })
    console.log("Reenfileirado:", p.id)
  }
  await watermarkQueue.close()
  console.log("Pronto!")
}

main().catch(console.error)

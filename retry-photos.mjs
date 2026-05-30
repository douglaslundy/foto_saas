import("dotenv/config").then(async () => {
  const { Queue } = await import("bullmq")
  const { connection } = await import("./src/lib/queues/connection.js")
  const { createAdminClient } = await import("./src/lib/supabase/admin.js")

  const supabase = createAdminClient()
  const watermarkQueue = new Queue("watermark", { connection })

  const { data: photos } = await supabase
    .from("photos")
    .select("id, event_id, tenant_id, original_storage_path")
    .in("status", ["error", "processing"])

  if (!photos || photos.length === 0) { console.log("Nenhuma foto para reprocessar"); process.exit(0) }

  for (const p of photos) {
    await supabase.from("photos").update({ status: "processing" }).eq("id", p.id)
    await watermarkQueue.add("watermark", {
      photo_id: p.id, event_id: p.event_id, tenant_id: p.tenant_id,
      original_storage_path: p.original_storage_path,
    })
    console.log("Reenfileirado:", p.id)
  }
  await watermarkQueue.close()
  console.log("Pronto!")
})

import { NewTenantForm } from './_components/new-tenant-form'

export default function NovoFotografoPage() {
  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold">Cadastrar Fotógrafo / Empresa</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cria um novo tenant e conta de acesso para o fotógrafo.
        </p>
      </div>
      <NewTenantForm />
    </div>
  )
}

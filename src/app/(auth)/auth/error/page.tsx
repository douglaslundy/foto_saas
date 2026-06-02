export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Link inválido ou expirado</h1>
        <p className="text-gray-600 text-sm">
          Solicite um novo link ao fotógrafo.
        </p>
      </div>
    </div>
  )
}

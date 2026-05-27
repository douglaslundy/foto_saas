import { CheckoutForm } from '@/components/checkout/checkout-form'

export default function CheckoutPage() {
  return (
    <div className="p-6 max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Finalizar Compra</h1>
      <CheckoutForm />
    </div>
  )
}

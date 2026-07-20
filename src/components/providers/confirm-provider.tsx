"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

type ConfirmOptions = {
  title?: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
}

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void
}

const ConfirmContext = React.createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ConfirmState | null>(null)

  const confirm = React.useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve })
    })
  }, [])

  function handleOpenChange(open: boolean) {
    if (!open && state) {
      state.resolve(false)
      setState(null)
    }
  }

  function handleCancel() {
    state?.resolve(false)
    setState(null)
  }

  function handleConfirm() {
    state?.resolve(true)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!state} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{state?.title ?? "Confirmar ação"}</DialogTitle>
            <DialogDescription>{state?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-sm font-medium hover:bg-[var(--color-surface-alt)] transition-colors"
            >
              {state?.cancelLabel ?? "Cancelar"}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={`px-4 py-2 rounded-[var(--radius-sm)] text-sm font-semibold transition-colors ${
                state?.variant === "destructive"
                  ? "bg-[var(--color-danger)] text-white hover:opacity-90"
                  : "bg-[var(--color-cta)] text-[var(--color-cta-fg)] hover:opacity-90"
              }`}
            >
              {state?.confirmLabel ?? "Confirmar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider")
  return ctx
}

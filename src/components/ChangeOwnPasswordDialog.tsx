import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { useAuth } from '../context/AuthContext'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (next: boolean) => void
}

export default function ChangeOwnPasswordDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation()
  const { changeOwnPassword } = useAuth()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCurrent('')
    setNext('')
    setConfirm('')
    setError(null)
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (next.length < 6) {
      setError(t('profile.changePassword.errors.weak'))
      return
    }
    if (next !== confirm) {
      setError(t('profile.changePassword.errors.mismatch'))
      return
    }

    setIsSubmitting(true)
    try {
      const ok = await changeOwnPassword(current, next)
      if (!ok) {
        setError(t('profile.changePassword.errors.invalidCurrent'))
        return
      }
      toast.success(t('profile.changePassword.success'))
      onOpenChange(false)
    } catch (err) {
      setError(t('profile.changePassword.errors.unknown'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('profile.changePassword.title')}</DialogTitle>
          <DialogDescription>{t('profile.changePassword.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="current">{t('profile.changePassword.current')}</Label>
              <Input id="current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next">{t('profile.changePassword.new')}</Label>
              <Input id="next" type="password" value={next} minLength={6} onChange={(e) => setNext(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">{t('profile.changePassword.confirm')}</Label>
              <Input id="confirm" type="password" value={confirm} minLength={6} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('profile.changePassword.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

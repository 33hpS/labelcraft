import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AppLayout } from '../components/Layout/AppLayout'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { useAuth } from '../context/AuthContext'
import { AuthUser, UserRole, UserSegment } from '../types/auth'
import { Search, UserPlus, Pencil, Trash2, KeyRound, ShieldAlert } from 'lucide-react'

interface FormValues {
  username: string
  displayName: string
  role: UserRole
  segment?: UserSegment
  password?: string
}

type FormMode = 'create' | 'edit'

interface UserFormDialogProps {
  open: boolean
  mode: FormMode
  initialUser?: AuthUser | null
  onOpenChange: (next: boolean) => void
  onSubmit: (values: FormValues) => Promise<void>
  resolveError: (error: unknown) => string
}

function UserFormDialog({ open, mode, initialUser, onOpenChange, onSubmit, resolveError }: UserFormDialogProps) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<UserRole>('assembler')
  const [segment, setSegment] = useState<UserSegment | undefined>()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const segmentEnabled = role === 'assembler'

  // hydrate on open
  useEffect(() => {
    if (!open) {
      setFormError(null)
      return
    }
    if (initialUser) {
      setUsername(initialUser.username)
      setDisplayName(initialUser.displayName)
      setRole(initialUser.role)
      setSegment(initialUser.segment)
    } else {
      setUsername('')
      setDisplayName('')
      setRole('assembler')
      setSegment(undefined)
    }
    setPassword('')
    setConfirmPassword('')
    setFormError(null)
  }, [open, initialUser])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)

    const trimmedUsername = username.trim()
    const trimmedDisplay = displayName.trim()

    if (trimmedUsername.length < 3) {
      setFormError(t('admin.users.errors.usernameInvalid'))
      return
    }

    if (mode === 'create') {
      if (password.length < 6) {
        setFormError(t('admin.users.errors.passwordWeak'))
        return
      }
      if (password !== confirmPassword) {
        setFormError(t('admin.users.errors.passwordMismatch'))
        return
      }
    }

    const payload: FormValues = {
      username: trimmedUsername,
      displayName: trimmedDisplay || trimmedUsername,
      role,
      segment: segmentEnabled ? segment : undefined,
      password: mode === 'create' ? password : undefined,
    }

    setIsSubmitting(true)
    try {
      await onSubmit(payload)
      onOpenChange(false)
    } catch (error) {
      const message = resolveError(error)
      setFormError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? t('admin.users.dialog.createTitle')
              : t('admin.users.dialog.editTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? t('admin.users.dialog.createDescription')
              : t('admin.users.dialog.editDescription', { name: initialUser?.displayName })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t('admin.users.form.username')}</Label>
              <Input
                id="username"
                autoFocus
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="assembler"
                disabled={mode === 'edit'}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">{t('admin.users.form.displayName')}</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Сборщик"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="role">{t('admin.users.form.role')}</Label>
                <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder={t('admin.users.form.rolePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assembler">{t('roles.assembler')}</SelectItem>
                    <SelectItem value="operator">{t('roles.operator')}</SelectItem>
                    <SelectItem value="warehouse">{t('roles.warehouse')}</SelectItem>
                    <SelectItem value="manager">{t('roles.manager')}</SelectItem>
                    <SelectItem value="admin">{t('roles.admin')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="segment">{t('admin.users.form.segment')}</Label>
                <Select
                  value={segmentEnabled ? segment ?? '' : ''}
                  onValueChange={(value) => setSegment(value ? (value as UserSegment) : undefined)}
                  disabled={!segmentEnabled}
                >
                  <SelectTrigger id="segment">
                    <SelectValue placeholder={t('admin.users.form.segmentPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('admin.users.form.segmentNone')}</SelectItem>
                    <SelectItem value="lux">{t('segments.lux')}</SelectItem>
                    <SelectItem value="econom">{t('segments.econom')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {mode === 'create' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">{t('admin.users.form.password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('admin.users.form.confirmPassword')}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : mode === 'create' ? t('common.create') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface ResetPasswordDialogProps {
  open: boolean
  user?: AuthUser | null
  onOpenChange: (next: boolean) => void
  onSubmit: (newPassword: string) => Promise<void>
  resolveError: (error: unknown) => string
}

function ResetPasswordDialog({ open, user, onOpenChange, onSubmit, resolveError }: ResetPasswordDialogProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setPassword('')
    setConfirmPassword('')
    setFormError(null)
  }, [open, user?.id])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)

    if (password.length < 6) {
      setFormError(t('admin.users.errors.passwordWeak'))
      return
    }
    if (password !== confirmPassword) {
      setFormError(t('admin.users.errors.passwordMismatch'))
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(password)
      onOpenChange(false)
    } catch (error) {
      const message = resolveError(error)
      setFormError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('admin.users.resetPassword.title', { name: user?.displayName ?? user?.username })}</DialogTitle>
          <DialogDescription>{t('admin.users.resetPassword.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('admin.users.resetPassword.newPassword')}</Label>
              <Input
                id="newPassword"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">{t('admin.users.resetPassword.confirmPassword')}</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={6}
                required
              />
            </div>
          </div>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('admin.users.resetPassword.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function AdminUsersPage() {
  const { t } = useTranslation()
  const {
    user: currentUser,
    listUsers,
    createUser,
    updateUser,
    deleteUser,
    resetUserPassword,
  } = useAuth()

  const [searchTerm, setSearchTerm] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null)
  const [resetUser, setResetUser] = useState<AuthUser | null>(null)
  const [isResetOpen, setIsResetOpen] = useState(false)

  const users = useMemo(() => listUsers(), [listUsers])

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return users
    return users.filter((item) =>
      [item.username, item.displayName, item.role, item.segment]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(term)
        )
    )
  }, [users, searchTerm])

  const resolveError = useCallback((error: unknown) => {
    if (error instanceof Error) {
      switch (error.message) {
        case 'USERNAME_EXISTS':
          return t('admin.users.errors.usernameExists')
        case 'USERNAME_INVALID':
          return t('admin.users.errors.usernameInvalid')
        case 'PASSWORD_WEAK':
          return t('admin.users.errors.passwordWeak')
        case 'LAST_ADMIN':
          return t('admin.users.errors.lastAdmin')
        case 'NOT_FOUND':
          return t('admin.users.errors.notFound')
        default:
          if (error.message) {
            return error.message
          }
      }
    }
    return t('admin.users.errors.unknown')
  }, [t])

  const openCreateDialog = () => {
    setFormMode('create')
    setEditingUser(null)
    setIsFormOpen(true)
  }

  const openEditDialog = (user: AuthUser) => {
    setFormMode('edit')
    setEditingUser(user)
    setIsFormOpen(true)
  }

  const openResetDialog = (user: AuthUser) => {
    setResetUser(user)
    setIsResetOpen(true)
  }

  const handleCreateUser = useCallback(async (values: FormValues) => {
    try {
      await createUser({
        username: values.username,
        displayName: values.displayName,
        role: values.role,
        segment: values.segment,
        password: values.password ?? '',
      })
      toast.success(t('admin.users.toasts.created', { name: values.displayName || values.username }))
    } catch (error) {
      const message = resolveError(error)
      toast.error(message)
      throw new Error(message)
    }
  }, [createUser, resolveError, t])

  const handleUpdateUser = useCallback(async (values: FormValues) => {
    if (!editingUser) return
    try {
      await updateUser(editingUser.id, {
        username: values.username,
        displayName: values.displayName,
        role: values.role,
        segment: values.role === 'assembler' ? values.segment ?? null : null,
      })
      toast.success(t('admin.users.toasts.updated', { name: values.displayName || values.username }))
    } catch (error) {
      const message = resolveError(error)
      toast.error(message)
      throw new Error(message)
    }
  }, [updateUser, editingUser, resolveError, t])

  const handleResetPassword = useCallback(async (newPassword: string) => {
    if (!resetUser) return
    try {
      await resetUserPassword(resetUser.id, newPassword)
      toast.success(t('admin.users.toasts.passwordReset', { name: resetUser.displayName || resetUser.username }))
    } catch (error) {
      const message = resolveError(error)
      toast.error(message)
      throw new Error(message)
    }
  }, [resetUser, resetUserPassword, resolveError, t])

  const handleDeleteUser = async (user: AuthUser) => {
    try {
      await deleteUser(user.id)
      toast.success(t('admin.users.toasts.deleted', { name: user.displayName || user.username }))
    } catch (error) {
      const message = resolveError(error)
      toast.error(message)
      throw new Error(message)
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-2xl font-semibold">
                <ShieldAlert className="h-5 w-5 text-primary" aria-hidden />
                {t('admin.users.title')}
              </CardTitle>
              <CardDescription>{t('admin.users.subtitle')}</CardDescription>
            </div>
            <Button onClick={openCreateDialog} className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" aria-hidden />
              {t('admin.users.actions.addUser')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('admin.users.searchPlaceholder')}
                className="pl-10"
              />
            </div>

            <div className="overflow-hidden rounded-md border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.users.table.username')}</TableHead>
                    <TableHead>{t('admin.users.table.displayName')}</TableHead>
                    <TableHead>{t('admin.users.table.role')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('admin.users.table.segment')}</TableHead>
                    <TableHead className="text-right">{t('admin.users.table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        {t('admin.users.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((item) => {
                      const isCurrentUser = currentUser?.id === item.id
                      return (
                        <TableRow key={item.id} className={isCurrentUser ? 'bg-primary/10' : undefined}>
                          <TableCell className="font-medium">{item.username}</TableCell>
                          <TableCell>{item.displayName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{t(`roles.${item.role}` as const)}</Badge>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {item.segment ? <Badge variant="outline">{t(`segments.${item.segment}` as const)}</Badge> : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} title={t('common.edit')}>
                                <Pencil className="h-4 w-4" aria-hidden />
                                <span className="sr-only">{t('common.edit')}</span>
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openResetDialog(item)} title={t('admin.users.actions.resetPassword')}>
                                <KeyRound className="h-4 w-4" aria-hidden />
                                <span className="sr-only">{t('admin.users.actions.resetPassword')}</span>
                              </Button>
                              {isCurrentUser ? null : (
                                <ConfirmDialog
                                  title={t('admin.users.deleteDialog.title', { name: item.displayName || item.username })}
                                  description={t('admin.users.deleteDialog.description')}
                                  confirmLabel={t('admin.users.deleteDialog.confirm')}
                                  cancelLabel={t('common.cancel')}
                                  onConfirm={() => handleDeleteUser(item)}
                                  confirmClassName="bg-destructive hover:bg-destructive/90"
                                >
                                  <Button variant="ghost" size="icon" title={t('common.delete')}>
                                    <Trash2 className="h-4 w-4" aria-hidden />
                                    <span className="sr-only">{t('common.delete')}</span>
                                  </Button>
                                </ConfirmDialog>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <UserFormDialog
          open={isFormOpen}
          mode={formMode}
          initialUser={editingUser}
          onOpenChange={setIsFormOpen}
          onSubmit={formMode === 'create' ? handleCreateUser : handleUpdateUser}
          resolveError={resolveError}
        />

        <ResetPasswordDialog
          open={isResetOpen}
          user={resetUser}
          onOpenChange={setIsResetOpen}
          onSubmit={handleResetPassword}
          resolveError={resolveError}
        />
      </div>
    </AppLayout>
  )
}

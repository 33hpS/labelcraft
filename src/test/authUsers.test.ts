import { describe, it, expect, beforeEach, vi } from 'vitest'

// Helper: fresh import of auth module to reset internal state between tests
async function loadAuth() {
  vi.resetModules()
  // Clear any storage before (ensureLoaded will seed defaults when no data)
  localStorage.clear()
  return await import('../lib/auth')
}

describe('auth users store (localStorage-backed)', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('seeds defaults and authenticates admin', async () => {
    const { listUsers, authenticate } = await loadAuth()
    const users = listUsers()
    expect(users.length).toBeGreaterThan(0)
    const admin = users.find(u => u.username === 'admin')
    expect(admin?.role).toBe('admin')

    const ok = await authenticate('admin', 'admin123')
    expect(ok?.username).toBe('admin')
  })

  it('creates user, prevents duplicate usernames and weak passwords', async () => {
    const { createUser, listUsers } = await loadAuth()

    await expect(createUser({
      username: 'john',
      displayName: 'John',
      role: 'operator',
      password: 'secret1',
    })).resolves.toBeTruthy()

    const afterCreate = listUsers()
    expect(afterCreate.some(u => u.username === 'john')).toBe(true)

    // duplicate username
    await expect(createUser({
      username: 'john',
      displayName: 'Johnny',
      role: 'operator',
      password: 'secret2',
    })).rejects.toThrow(/USERNAME_EXISTS/)

    // weak password
    await expect(createUser({
      username: 'weak',
      displayName: 'Weak',
      role: 'assembler',
      password: '123',
    })).rejects.toThrow(/PASSWORD_WEAK/)
  })

  it('updates user fields and enforces last-admin constraint', async () => {
    const { createUser, updateUser, listUsers } = await loadAuth()
    // Create a second admin so we can demote one later safely
    const admin2 = await createUser({
      username: 'admin2',
      displayName: 'Admin Two',
      role: 'admin',
      password: 'admin2123',
    })

    // Update username and display name
    const updated = await updateUser(admin2.id, { username: 'admin-two', displayName: 'Admin 2' })
    expect(updated.username).toBe('admin-two')
    expect(updated.displayName).toBe('Admin 2')

    // Try to demote the only remaining admin if we hypothetically had one
    // Find a non-admin user and attempt to change the built-in admin role => ensure rule works when last admin would be removed
    const users = listUsers()
    const builtInAdmin = users.find(u => u.username === 'admin')!

    // Demote built-in admin should fail because another admin exists? No — we created admin2 so it should succeed now.
    const res = await updateUser(builtInAdmin.id, { role: 'manager' })
    expect(res.role).toBe('manager')

    // Now there is still one admin (admin-two). Attempt to demote the last admin should throw
    await expect(updateUser(updated.id, { role: 'manager' })).rejects.toThrow(/LAST_ADMIN/)
  })

  it('resetUserPassword allows login with new password', async () => {
    const { createUser, resetUserPassword, authenticate } = await loadAuth()
    const u = await createUser({ username: 'kate', displayName: 'Kate', role: 'operator', password: 'pass123' })

    // Old password works
    expect((await authenticate('kate', 'pass123'))?.id).toBe(u.id)

    await resetUserPassword(u.id, 'newpass')

    // Old should fail, new should pass
    expect(await authenticate('kate', 'pass123')).toBeNull()
    expect((await authenticate('kate', 'newpass'))?.id).toBe(u.id)
  })

  it('changePassword validates current and updates hash', async () => {
    const { createUser, changePassword, authenticate } = await loadAuth()
    const u = await createUser({ username: 'ivan', displayName: 'Ivan', role: 'assembler', password: 'oldpass' })

    // wrong current
    await expect(changePassword(u.id, 'badpass', 'newpass')).resolves.toBe(false)

    // short new password
    await expect(changePassword(u.id, 'oldpass', '123')).rejects.toThrow(/PASSWORD_WEAK/)

    // proper change
    await expect(changePassword(u.id, 'oldpass', 'newpass')).resolves.toBe(true)
    expect(await authenticate('ivan', 'oldpass')).toBeNull()
    expect((await authenticate('ivan', 'newpass'))?.id).toBe(u.id)
  })
})

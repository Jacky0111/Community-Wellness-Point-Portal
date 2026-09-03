export class SystemRoleProtectedError extends Error {
  constructor() {
    super('The default system role cannot be modified or deleted.')
    this.name = 'SystemRoleProtectedError'
  }
}

export function assertRoleMutable(role: { isSystemDefault: boolean }): void {
  if (role.isSystemDefault) {
    throw new SystemRoleProtectedError()
  }
}

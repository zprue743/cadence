export type IdentityInput = {
  production: boolean
  secret: string
  presentedSecret: string
  headerEmail: string
  devEmail: string
}

export function resolveEmail(input: IdentityInput): string | null {
  const secret = input.secret.trim()
  if (secret) {
    if (input.presentedSecret !== secret) return null
    const email = input.headerEmail.trim().toLowerCase()
    return email || null
  }
  if (input.production) return null
  const dev = input.devEmail.trim().toLowerCase()
  return dev || null
}

export function identityConfig() {
  return {
    production: process.env.NODE_ENV === 'production',
    secret: process.env.PROXY_IDENTITY_SECRET ?? '',
    emailHeader: process.env.EMAIL_HEADER?.trim() || 'X-Forwarded-Email',
    secretHeader: process.env.PROXY_IDENTITY_HEADER?.trim() || 'X-Cadence-Identity',
    devEmail: process.env.DEV_EMAIL ?? '',
  }
}

export function emailFromHeaders(headers: { get(name: string): string | undefined }): string | null {
  const config = identityConfig()
  return resolveEmail({
    production: config.production,
    secret: config.secret,
    presentedSecret: headers.get(config.secretHeader) ?? '',
    headerEmail: headers.get(config.emailHeader) ?? '',
    devEmail: config.devEmail,
  })
}

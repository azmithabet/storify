import { config } from '@/config/env'

interface EtaTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export class EtaClient {
  private accessToken: string | null = null
  private tokenExpiresAt: number = 0
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly baseURL: string

  constructor(clientId: string, clientSecret: string, isProd = false) {
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.baseURL = isProd ? config.ETA_PROD_BASE_URL : config.ETA_PREPROD_BASE_URL
  }

  private async authenticate(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 30_000) {
      return this.accessToken
    }
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    })
    const res = await fetch(`${this.baseURL}/connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`ETA auth failed: ${res.status} ${text}`)
    }
    const data = (await res.json()) as EtaTokenResponse
    this.accessToken = data.access_token
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000
    return data.access_token
  }

  /**
   * Lightweight credential check used by the Settings wizard. Performs the
   * OAuth client-credentials handshake only — no document is submitted.
   * Throws if authentication fails (bad client id/secret, wrong environment,
   * or ETA unreachable).
   */
  async testConnection(): Promise<void> {
    await this.authenticate()
  }

  async submitDocuments(documents: object[]): Promise<EtaSubmitResponse> {
    const token = await this.authenticate()
    const res = await fetch(`${this.baseURL}/api/v1.0/documentsubmissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ documents }),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`ETA submit failed: ${res.status} ${text}`)
    }
    return (await res.json()) as EtaSubmitResponse
  }

  async getDocumentStatus(uuid: string): Promise<EtaDocumentStatus> {
    const token = await this.authenticate()
    const res = await fetch(`${this.baseURL}/api/v1.0/documents/${uuid}/details`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`ETA status check failed: ${res.status} ${text}`)
    }
    return (await res.json()) as EtaDocumentStatus
  }
}

export interface EtaSubmitResponse {
  submissionId: string
  headerVersion: string
  acceptedDocuments: Array<{ uuid: string; longId: string; internalId: string; hashKey: string }>
  rejectedDocuments: Array<{ uuid?: string; internalId: string; error: { code: string; message: string } }>
}

export interface EtaDocumentStatus {
  uuid: string
  longId: string
  internalId: string
  typeName: string
  typeVersionName: string
  issuerId: string
  receiverId: string
  status: 'Valid' | 'Invalid' | 'Submitted' | 'Cancelled'
  dateTimeReceived: string
  dateTimeIssued: string
  publicUrl: string
}

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { uploadLabExam, type LabExamUploadResult } from '../threadApi'

describe('uploadLabExam', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('uploads lab exam file and parses successful response', async () => {
    const mockResult: LabExamUploadResult = {
      batchId: '123e4567-e89b-12d3-a456-426614174000',
      summary: 'Se detectaron 2 métricas: glucosa y HbA1c.',
      measurementCount: 2,
      detectedMetrics: ['glucose_fasting', 'hba1c'],
      storageKey: 'lab-exams/patient1/batch1/results.pdf',
    }

    let capturedUrl = ''
    let capturedOptions: RequestInit | undefined

    globalThis.fetch = vi.fn().mockImplementation(async (url, options) => {
      capturedUrl = String(url)
      capturedOptions = options
      return {
        ok: true,
        json: async () => mockResult,
      } as Response
    })

    const file = new File(['dummy-content'], 'results.pdf', { type: 'application/pdf' })
    const result = await uploadLabExam(file, 'thread-xyz')

    expect(capturedUrl).toContain('/api/v1/lab-exams')
    expect(capturedOptions?.method).toBe('POST')
    expect(capturedOptions?.body).toBeInstanceOf(FormData)
    const formData = capturedOptions?.body as FormData
    expect(formData.get('file')).toBeTruthy()
    expect(formData.get('threadId')).toBe('thread-xyz')
    expect(result).toEqual(mockResult)
  })

  it('includes Authorization Bearer header when access token is present', async () => {
    localStorage.setItem('copp_access_token', 'mock-jwt-token')

    let capturedHeaders: HeadersInit | undefined
    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      capturedHeaders = options?.headers
      return {
        ok: true,
        json: async () => ({ batchId: 'b1', summary: 'ok', measurementCount: 0, detectedMetrics: [] }),
      } as Response
    })

    const file = new File(['dummy'], 'scan.png', { type: 'image/png' })
    await uploadLabExam(file)

    expect((capturedHeaders as Record<string, string>)?.Authorization).toBe('Bearer mock-jwt-token')
  })

  it('throws user-facing error message on 422 Unprocessable Entity', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 422,
        json: async () => ({
          error: {
            code: 'UNSUPPORTED_FILE_TYPE',
            message: 'Unsupported file type. Please upload a JPEG, PNG, or PDF.',
          },
        }),
      } as Response
    })

    const file = new File(['bad'], 'doc.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    await expect(uploadLabExam(file)).rejects.toThrow('Unsupported file type. Please upload a JPEG, PNG, or PDF.')
  })

  it('throws user-facing error message on 502 Bad Gateway', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 502,
        json: async () => ({
          error: {
            code: 'AI_SERVICE_UNAVAILABLE',
            message: 'El servicio de IA no pudo procesar el examen de laboratorio.',
          },
        }),
      } as Response
    })

    const file = new File(['data'], 'exam.pdf', { type: 'application/pdf' })
    await expect(uploadLabExam(file)).rejects.toThrow('El servicio de IA no pudo procesar el examen de laboratorio.')
  })

  it('throws user-facing error message on 500 Internal Server Error', async () => {
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: false,
        status: 500,
        json: async () => ({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'No fue posible procesar la solicitud.',
          },
        }),
      } as Response
    })

    const file = new File(['data'], 'exam.pdf', { type: 'application/pdf' })
    await expect(uploadLabExam(file)).rejects.toThrow('No fue posible procesar la solicitud.')
  })
})

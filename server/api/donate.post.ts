/**
 * POST /api/donate
 *
 * Creates a dynamic donation bill via ToyyibPay and returns the payment URL.
 * Requires:
 *   - NUXT_TOYYIBPAY_SECRET_KEY
 *   - NUXT_TOYYIBPAY_CATEGORY_CODE
 *
 * ToyyibPay does not offer a simple static "donation link" from the dashboard;
 * bills are created through this API. If you just want a static link, set
 * NUXT_PUBLIC_DONATION_URL instead and the footer will use that directly.
 */

const TOYYIBPAY_CREATE_BILL_URL = 'https://toyyibpay.com/index.php/api/createBill'

interface CreateBillResponse {
  /** ToyyibPay bill code, e.g. "sb3q7h9s" */
  BillCode?: string
  /** Bill URL to redirect the payer to. */
  bill_url?: string
  /** Human-readable status message. */
  status?: string
  /** Error message when the request fails. */
  msg?: string
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const secretKey = config.toyyibpaySecretKey
  const categoryCode = config.toyyibpayCategoryCode

  if (!secretKey || !categoryCode) {
    throw createError({
      statusCode: 503,
      statusMessage:
        'ToyyibPay belum dikonfigurasi. Tetapkan NUXT_TOYYIBPAY_SECRET_KEY dan NUXT_TOYYIBPAY_CATEGORY_CODE.',
    })
  }

  const body = await readBody(event)
  const amountSen = Number(body?.amount)
  if (!amountSen || amountSen < 100) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Jumlah sumbangan mesti sekurang-kurangnya RM 1.00.',
    })
  }

  const form = new URLSearchParams()
  form.append('userSecretKey', secretKey)
  form.append('categoryCode', categoryCode)
  form.append('billName', 'Sumbangan Waktu Solat Malaysia')
  form.append('billDescription', 'Terima kasih atas sokongan anda.')
  // 1 = variable amount (donor can edit), 0 = fixed
  form.append('billPriceSetting', '1')
  // 0 = payor info optional
  form.append('billPayorInfo', '0')
  // Amount in sen. ToyyibPay requires it even for variable-price bills.
  form.append('billAmount', String(amountSen))
  form.append(
    'billReturnUrl',
    getRequestURL(event).origin + '/?donation=success',
  )
  form.append(
    'billCallbackUrl',
    getRequestURL(event).origin + '/api/donate-callback',
  )

  let raw: unknown
  try {
    raw = await $fetch<CreateBillResponse[]>(TOYYIBPAY_CREATE_BILL_URL, {
      method: 'POST',
      body: form,
      timeout: 15000,
    })
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'Gagal menghubungi ToyyibPay. Cuba sebentar lagi.',
    })
  }

  // ToyyibPay returns an array on success.
  const first = Array.isArray(raw) ? raw[0] : (raw as CreateBillResponse)
  const url = first?.bill_url ?? first?.BillCode
    ? `https://toyyibpay.com/${first.BillCode}`
    : null

  if (!url) {
    throw createError({
      statusCode: 502,
      statusMessage: first?.msg || 'Respon ToyyibPay tidak sah.',
    })
  }

  return { url }
})

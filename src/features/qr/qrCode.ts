import QRCode from 'qrcode'
import { buildPublicTaggoUrl } from '../../lib/publicUrl'

const qrOptions = {
  errorCorrectionLevel: 'H' as const,
  margin: 4,
  width: 640,
  color: {
    dark: '#000000',
    light: '#ffffff',
  },
}

export function buildQrTargetUrl(publicId: string): string {
  return buildPublicTaggoUrl(publicId)
}

export function generateQrPng(publicId: string): Promise<string> {
  return QRCode.toDataURL(buildQrTargetUrl(publicId), qrOptions)
}

export function generateQrSvg(publicId: string): Promise<string> {
  return QRCode.toString(buildQrTargetUrl(publicId), {
    ...qrOptions,
    type: 'svg',
  })
}
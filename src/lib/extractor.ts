export type FileType = 'pdf' | 'docx' | 'xlsx' | 'csv' | 'image' | 'txt'

export interface ExtractionResult {
  text: string
  pageCount: number
  fileType: FileType
  isLarge: boolean
}

const LARGE_DOC_THRESHOLD = 80

export function detectFileType(filename: string): FileType {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx' || ext === 'doc') return 'docx'
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx'
  if (ext === 'csv') return 'csv'
  if (['png', 'jpg', 'jpeg', 'webp', 'tiff', 'bmp'].includes(ext)) return 'image'
  return 'txt'
}

export function isLargeDocument(pageCount: number): boolean {
  return pageCount > LARGE_DOC_THRESHOLD
}

export async function extractFromBuffer(
  buffer: Buffer,
  filename: string
): Promise<ExtractionResult> {
  const fileType = detectFileType(filename)

  switch (fileType) {
    case 'pdf':   return extractPdf(buffer)
    case 'docx':  return extractDocx(buffer)
    case 'xlsx':  return extractExcel(buffer)
    case 'csv':   return extractCsv(buffer)
    case 'image': return extractImage(buffer)
    default:      return extractPlainText(buffer)
  }
}
async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  if (typeof global !== 'undefined') {
    if (!('DOMMatrix' in global)) {
      (global as any).DOMMatrix = class DOMMatrix {};
    }
    if (!('ImageData' in global)) {
      (global as any).ImageData = class ImageData {};
    }
    if (!('Path2D' in global)) {
      (global as any).Path2D = class Path2D {};
    }
  }
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs' as string)
  const uint8 = new Uint8Array(buffer)
  const pdf = await getDocument({ data: uint8 }).promise
  const pageCount = pdf.numPages
  const isLarge = isLargeDocument(pageCount)

  const pagesToExtract = isLarge ? Math.min(20, pageCount) : pageCount
  const pageTexts: string[] = []

  for (let i = 1; i <= pagesToExtract; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .filter((item: { str?: string }) => 'str' in item)
      .map((item: { str: string }) => item.str)
      .join(' ')
    pageTexts.push(pageText)
  }

  return {
    text: pageTexts.join('\n\n'),
    pageCount,
    fileType: 'pdf',
    isLarge,
  }
}

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  const text = result.value
  const approxPageCount = Math.ceil(text.split(' ').length / 300)
  return {
    text,
    pageCount: approxPageCount,
    fileType: 'docx',
    isLarge: isLargeDocument(approxPageCount),
  }
}

async function extractExcel(buffer: Buffer): Promise<ExtractionResult> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sections: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet)
    if (csv.trim()) sections.push(`## Sheet: ${sheetName}\n\n${csv}`)
  }

  const text = sections.join('\n\n')
  return { text, pageCount: workbook.SheetNames.length, fileType: 'xlsx', isLarge: false }
}

async function extractCsv(buffer: Buffer): Promise<ExtractionResult> {
  const text = buffer.toString('utf-8')
  return { text, pageCount: 1, fileType: 'csv', isLarge: false }
}

async function extractImage(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const Tesseract = await import('tesseract.js')
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng')
    return { text: text.trim() || '[No text detected in image]', pageCount: 1, fileType: 'image', isLarge: false }
  } catch {
    return { text: '[Image: OCR extraction failed]', pageCount: 1, fileType: 'image', isLarge: false }
  }
}

async function extractPlainText(buffer: Buffer): Promise<ExtractionResult> {
  const text = buffer.toString('utf-8')
  const approxPageCount = Math.ceil(text.split(' ').length / 300)
  return { text, pageCount: approxPageCount, fileType: 'txt', isLarge: isLargeDocument(approxPageCount) }
}

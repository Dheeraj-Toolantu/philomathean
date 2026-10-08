// Builds small PDFs stamped the way PapaCambridge stamps its downloads: a tiled background logo
// form (/FormXob.pcm) under the page, and a faint diagonal overlay, footer and hidden trace text
// over it, each drawn by a ReportLab canvas wrapped in its own q … Q block.
import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib'

const background = `q
q
1 0 0 1 0 0 cm  BT /F1 12 Tf 14.4 TL ET
q
.055 .227 .361 rg
/gRLs0 gs
q
.866025 .5 -0.5 .866025 100 100 cm
/FormXob.pcm Do
Q
Q
Q
`

const overlay = (label) => `
q
0.0 0.0 595.32 841.92 re
W
n
1 0 0 1 0 0 cm
BT
/F1 12 Tf
14.4 TL
ET
q
0.055 0.227 0.361 rg
/gRLs0-0 gs
q
0.866025 0.5 -0.5 0.866025 240 370 cm
n 1.7 0 m 1.7 16.5 l 7 16.5 l h f*
Q
Q
0.78 0.82 0.86 RG
0.4 w
n
36 15 m
559.32 15 l
S
BT
1 0 0 1 36 5 Tm
/F1 6.3 Tf
(PapaCambridge) Tj
(\\267  papacambridge\\056com) Tj
ET
BT
3 Tr
/F1 4 Tf
1 0 0 1 36 1.2 Tm
(Downloaded from PapaCambridge \\055 https\\072\\057\\057papacambridge\\056com\\057 for ${label}) Tj
(Trace ID\\072 PC\\0552347F38462) Tj
ET
Q
Q
`

// The paper itself: text whose strings contain q, Q and brackets, to be kept intact.
const paper = (label) => `Q
q
BT
/F1 14 Tf
72 700 Td
(Question 1 \\(a\\) Q q ) Tj
(${label}) Tj
ET
Q
`

export const watermarkedPdf = async (label = 'paper') => {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([595.32, 841.92])
  const { context } = doc
  const form = context.register(context.flateStream('BT /F1 20 Tf (PapaCambridge) Tj ET', {
    Type: 'XObject', Subtype: 'Form', BBox: [0, -23, 175, 27.6], Resources: { Font: { F1: font.ref } },
  }))
  page.node.set(PDFName.of('Resources'), context.obj({
    Font: { F1: font.ref },
    XObject: { 'FormXob.pcm': form },
    ExtGState: { gRLs0: { ca: 0.055 }, 'gRLs0-0': { ca: 0.03 } },
  }))
  page.node.set(PDFName.of('Contents'), context.register(context.flateStream(`${background}${paper(label)}${overlay(label)}`)))
  doc.setTitle('0452/12 Question Paper June 2023 - PapaCambridge')
  doc.setAuthor('PapaCambridge (papacambridge.com)')
  doc.getInfoDict().set(PDFName.of('PC_TraceID'), context.obj('PC-2347F38462'))
  return Buffer.from(await doc.save())
}

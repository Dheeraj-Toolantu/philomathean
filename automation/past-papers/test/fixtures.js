// Builds small PDFs stamped the way PapaCambridge stamps its downloads: a tiled background logo
// form (/FormXob.pcm) under the page, and a faint diagonal overlay, footer and hidden trace text
// over it, each drawn by a ReportLab canvas wrapped in its own q … Q block.
import { PDFDocument, PDFName, PDFString, StandardFonts, degrees } from 'pdf-lib'
import { PNG } from 'pngjs'

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

// A small PNG: a grey diagonal band on a transparent background, like the corner ribbon.
const ribbonPng = () => {
  const size = 64
  const png = new PNG({ width: size, height: size })
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4
      const band = Math.abs(x - y) < 12
      png.data.set(band ? [150, 150, 150, 255] : [0, 0, 0, 0], index)
    }
  }
  return PNG.sync.write(png)
}

const solidPng = (rgbValues) => {
  const png = new PNG({ width: 4, height: 4 })
  for (let index = 0; index < png.data.length; index += 4) png.data.set([...rgbValues, 255], index)
  return PNG.sync.write(png)
}

// An older-style paper with PapaCambridge's "www.PapaCambridge.com" ribbon in the top-right corner
// of the page as viewed: a ribbon image touching the top and right edges, the ribbon's text drawn
// over a grey band, and a link to papacambridge.com over it. The paper's own logo (near the top
// right, inside the margins), a full-page scan image and its text must all survive.
// With `rotate: 90` the page is stored on its side, so the ribbon sits in the user-space top-left.
export const ribbonPdf = async ({ rotate = 0 } = {}) => {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const ribbon = await doc.embedPng(ribbonPng())
  const logo = await doc.embedPng(solidPng([20, 40, 120]))
  const scan = await doc.embedPng(solidPng([255, 255, 255]))
  const [width, height] = rotate === 90 ? [841.92, 595.32] : [595.32, 841.92]
  const page = doc.addPage([width, height])
  const { context } = doc
  // Corner placement in user space for the viewed top-right corner.
  const ribbonAt = rotate === 90 ? `160 0 0 220 -10 ${height - 210}` : `160 0 0 220 ${width - 150} ${height - 210}`
  const textAt = rotate === 90 ? `0.6 0.8 -0.8 0.6 40 ${height - 170}` : `0.7 -0.7 0.7 0.7 ${width - 170} ${height - 20}`
  const content = `q ${width} 0 0 ${height} 0 0 cm /Scan Do Q
q 150 0 0 40 ${rotate === 90 ? `60 ${height - 300}` : `380 760`} cm /Logo Do Q
q ${ribbonAt} cm /Ribbon Do Q
q
${textAt} cm
0.6 g
0 -8 230 30 re f
BT /F1 14 Tf 0 g 12 0 Td (www.PapaCambridge.com) Tj ET
Q
BT /F1 12 Tf 72 400 Td (CANDIDATE NUMBER) Tj ET
BT /F1 12 Tf 72 360 Td [(Cambridge International ) -20 (Examinations)] TJ ET
`
  page.node.set(PDFName.of('Resources'), context.obj({ Font: { F1: font.ref }, XObject: { Ribbon: ribbon.ref, Logo: logo.ref, Scan: scan.ref } }))
  page.node.set(PDFName.of('Contents'), context.register(context.flateStream(content)))
  if (rotate) page.setRotation(degrees(rotate))
  const link = context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [width - 150, height - 210, width, height], Border: [0, 0, 0], A: { S: 'URI', URI: PDFString.of('http://www.PapaCambridge.com') } })
  const keepLink = context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [72, 72, 200, 90], A: { S: 'URI', URI: PDFString.of('https://www.cambridgeinternational.org') } })
  page.node.set(PDFName.of('Annots'), context.obj([context.register(link), context.register(keepLink)]))
  return Buffer.from(await doc.save())
}

// A mark-scheme graph page with the large diagonal red "PapaCambridge" logo stamped across it,
// drawn in one of the ways such stamps are made:
//   'paths' — letter outlines and the logo mark as red and blue see-through paths at a slant;
//   'text'  — slanted see-through red text in a font whose codes don't spell anything readable;
//   'form'  — the logo as a see-through form drawn at a slant;
//   'inner' — a form placed upright whose own content draws the slanted see-through logo.
// The graph's own drawing must survive: the black grid and curve, a red upright highlight that is
// see-through, a solid red line, a slanted solid black arrow and the axis labels.
export const stampPdf = async (style = 'paths') => {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage([595.32, 841.92])
  const { context } = doc
  const slant = '0.574 0.819 -0.819 0.574 200 250 cm'
  const logo = `0.86 0.2 0.2 rg 0 0 m 40 0 l 40 60 l 0 60 l h f
0.15 0.2 0.45 rg 50 0 m 300 0 l 300 50 l 50 50 l h f
0.86 0.2 0.2 rg 310 0 m 480 0 l 480 50 l 310 50 l h f`
  const graph = `q 0 G 0.3 w 72 300 m 520 300 l S 72 300 m 72 700 l S
1 0 0 1 0 0 cm 0 0 0 RG 1 w 80 320 m 200 690 300 310 500 650 c S Q
q /Half gs 1 0.85 0.85 rg 100 400 80 40 re f Q
q 0.9 0.1 0.1 RG 2 w 100 330 m 300 330 l S Q
q 0.707 0.707 -0.707 0.707 400 400 cm 0 g 0 0 m 60 0 l 50 5 l h f Q
BT /F1 10 Tf 60 290 Td (0) Tj 100 0 Td (1) Tj ET
`
  let stamp
  const xObjects = {}
  if (style === 'paths') {
    stamp = `q /Wm gs ${slant}\n${logo}\nQ`
  } else if (style === 'text') {
    stamp = `q /Wm gs 0.86 0.2 0.2 rg BT /F1 60 Tf 0.574 0.819 -0.819 0.574 200 250 Tm (\\001\\002\\001\\003\\004\\005) Tj ET Q`
  } else {
    const inner = style === 'inner' ? `q /Wm gs ${slant}\n${logo}\nQ` : logo
    const form = context.register(context.flateStream(inner, {
      Type: 'XObject', Subtype: 'Form', BBox: style === 'inner' ? [0, 0, 595.32, 841.92] : [0, 0, 480, 60],
      Resources: { ExtGState: { Wm: { ca: 0.6 } } },
      ...(style === 'form' ? { Group: { S: 'Transparency' } } : {}),
    }))
    xObjects.Stamp = form
    stamp = style === 'inner' ? 'q /Stamp Do Q' : `q /Wm gs ${slant} /Stamp Do Q`
  }
  page.node.set(PDFName.of('Resources'), context.obj({
    Font: { F1: font.ref },
    ExtGState: { Wm: { ca: 0.6 }, Half: { ca: 0.5 } },
    XObject: xObjects,
  }))
  page.node.set(PDFName.of('Contents'), context.register(context.flateStream(`${graph}${stamp}\n`)))
  return Buffer.from(await doc.save())
}

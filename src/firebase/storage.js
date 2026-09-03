import { deleteObject, getDownloadURL, ref, updateMetadata, uploadBytesResumable } from 'firebase/storage'
import { storage } from './config'
import { MAX_PDF_BYTES } from './validation'

export const uploadPdf = (file, resourceId, access, onProgress) => new Promise((resolve, reject) => {
  const upload = uploadBytesResumable(ref(storage, `past-papers/${resourceId}/current.pdf`), file, { contentType: 'application/pdf', customMetadata: { access, published: 'true' } })
  upload.on('state_changed', (snapshot) => onProgress?.(Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)), reject, async () => resolve({ filePath: upload.snapshot.ref.fullPath, fileName: file.name, fileSize: file.size }))
})

export const validatePdfFile = (file) => file && file.type === 'application/pdf' && file.size <= MAX_PDF_BYTES
export const removePdf = (filePath) => filePath ? deleteObject(ref(storage, filePath)) : Promise.resolve()
export const getFreePdfUrl = async (filePath) => `${await getDownloadURL(ref(storage, filePath))}#toolbar=1&navpanes=0&view=FitH`
export const syncPdfPermission = (filePath, access, published) => filePath ? updateMetadata(ref(storage, filePath), { customMetadata: { access, published: String(published) } }) : Promise.resolve()

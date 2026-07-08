import { supabase } from './supabase'

export async function uploadProofFile(approvalId: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
  const path = `${approvalId}/${crypto.randomUUID()}-${safeName}`

  const { error } = await supabase.storage.from('proofs').upload(path, file)
  if (error) throw error

  return path
}

export async function getProofSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from('proofs').createSignedUrl(path, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

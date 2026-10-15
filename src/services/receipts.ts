import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

const OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 };

/** Takes or picks a photo. Returns its temporary uri, or null when cancelled or not allowed. */
export async function pickReceiptPhoto(source: 'camera' | 'library'): Promise<string | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(
      source === 'camera'
        ? 'Allow camera access in Settings to photograph receipts.'
        : 'Allow photo access in Settings to attach receipts.',
    );
  }
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(OPTIONS) : await ImagePicker.launchImageLibraryAsync(OPTIONS);
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

/** Copies a picked photo into the app's own storage, where the system does not clear it. */
export function storeReceiptPhoto(tempUri: string, transactionId: string): string {
  const folder = new Directory(Paths.document, 'receipts');
  if (!folder.exists) {
    folder.create({ intermediates: true });
  }
  const extension = /\.(\w{3,4})$/.exec(tempUri)?.[1] ?? 'jpg';
  const target = new File(folder, `${transactionId}-${Date.now()}.${extension}`);
  new File(tempUri).copySync(target);
  return target.uri;
}

export function deleteReceiptPhoto(uri: string | null): void {
  if (!uri) {
    return;
  }
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}

export function receiptPhotoExists(uri: string): boolean {
  return new File(uri).exists;
}

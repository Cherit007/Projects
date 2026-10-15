import { loadNative } from './loadNative';

const fileSystem = () => loadNative(() => import('expo-file-system'), 'Receipts');
const imagePicker = () => loadNative(() => import('expo-image-picker'), 'Receipts');

/** Takes or picks a photo. Returns its temporary uri, or null when cancelled. */
export async function pickReceiptPhoto(source: 'camera' | 'library'): Promise<string | null> {
  const ImagePicker = await imagePicker();
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
  const options = { mediaTypes: ['images' as const], quality: 0.6 };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

/** Copies a picked photo into the app's own storage, where the system does not clear it. */
export async function storeReceiptPhoto(tempUri: string, transactionId: string): Promise<string> {
  const { Directory, File, Paths } = await fileSystem();
  const folder = new Directory(Paths.document, 'receipts');
  if (!folder.exists) {
    folder.create({ intermediates: true });
  }
  const extension = /\.(\w{3,4})$/.exec(tempUri)?.[1] ?? 'jpg';
  const target = new File(folder, `${transactionId}-${Date.now()}.${extension}`);
  new File(tempUri).copySync(target);
  return target.uri;
}

export async function deleteReceiptPhoto(uri: string | null): Promise<void> {
  if (!uri) {
    return;
  }
  const { File } = await fileSystem();
  const file = new File(uri);
  if (file.exists) {
    file.delete();
  }
}

export async function receiptPhotoExists(uri: string): Promise<boolean> {
  const { File } = await fileSystem();
  return new File(uri).exists;
}

import { env } from '../env';
import { AppError } from '../errors';
import { loadScript } from '../google/loadScript';

const GAPI_SRC = 'https://apis.google.com/js/api.js';
let pickerReady: Promise<void> | null = null;

function loadPicker(): Promise<void> {
  pickerReady ??= loadScript(GAPI_SRC)
    .then(
      () =>
        new Promise<void>((resolve, reject) => {
          gapi.load('picker', { callback: () => resolve(), onerror: () => reject(new Error('picker 로드 실패')) });
        }),
    )
    .catch((err) => {
      pickerReady = null;
      throw new AppError('DRIVE_001', err instanceof Error ? err.message : String(err), { cause: err });
    });
  return pickerReady;
}

export interface PickedFile {
  id: string;
  name: string;
  mimeType: string;
}

function build(token: string, view: google.picker.DocsView, title: string, onPick: (doc: google.picker.PickerDocument | null) => void) {
  return new google.picker.PickerBuilder()
    .addView(view)
    .setOAuthToken(token)
    .setDeveloperKey(env.googleApiKey)
    // drive.file 권한에서는 AppId 가 있어야 선택한 파일에 대한 접근 권한이 이 앱에 부여된다.
    .setAppId(env.googleAppId)
    .setLocale('ko')
    .setTitle(title)
    .enableFeature(google.picker.Feature.SUPPORT_DRIVES)
    .setCallback((data) => {
      if (data.action === google.picker.Action.PICKED) onPick(data.docs?.[0] ?? null);
      else if (data.action === google.picker.Action.CANCEL) onPick(null);
    })
    .build();
}

/**
 * Drive 에서 HWP/HWPX 파일 하나를 고른다 (UC-04, FR-DRIVE-001).
 * Drive 가 HWP 계열 파일에 붙이는 MIME 유형이 일정하지 않아 목록은 거르지 않고,
 * 선택 후 확장자로 확인한다.
 */
export async function pickDocument(token: string): Promise<PickedFile | null> {
  await loadPicker();
  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setMode(google.picker.DocsViewMode.LIST);
    const picker = build(token, view, 'HWP/HWPX 문서 선택', (doc) => {
      picker.dispose();
      resolve(doc ? { id: doc.id, name: doc.name, mimeType: doc.mimeType } : null);
    });
    picker.setVisible(true);
  });
}

/** 새 파일을 저장할 Drive 폴더를 고른다. 취소하면 null (내 드라이브 최상위에 저장). */
export async function pickFolder(token: string): Promise<{ id: string; name: string } | null> {
  await loadPicker();
  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true)
      .setMimeTypes('application/vnd.google-apps.folder');
    const picker = build(token, view, '저장할 폴더 선택', (doc) => {
      picker.dispose();
      resolve(doc ? { id: doc.id, name: doc.name } : null);
    });
    picker.setVisible(true);
  });
}

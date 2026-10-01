import { useEffect, useRef, useState } from 'react';
import type { FeatureFlags } from '../config/flags';
import type { Destination } from '../documents/documentService';
import { pickFolder } from '../drive/picker';
import { toAppError } from '../errors';
import { getDriveAccessToken } from '../google/driveToken';
import type { DocFormat } from '../validation/inspect';

export interface SaveChoice {
  fileName: string;
  format: DocFormat;
  destination: Destination;
  driveFolderId?: string;
}

interface Props {
  initialName: string;
  flags: FeatureFlags;
  driveEnabled: boolean;
  onCancel(): void;
  onSave(choice: SaveChoice): void;
}

export function SaveDialog({ initialName, flags, driveEnabled, onCancel, onSave }: Props) {
  const [fileName, setFileName] = useState(initialName.replace(/\.(hwpx?)$/i, ''));
  const [format, setFormat] = useState<DocFormat>('hwpx');
  const [destination, setDestination] = useState<Destination>(driveEnabled ? 'drive' : 'local');
  const [folder, setFolder] = useState<{ id: string; name: string } | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  const trimmed = fileName.trim();
  const invalidName = trimmed === '' || /[\\/:*?"<>|]/.test(trimmed);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="save-title">
      <form
        className="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          if (invalidName) return;
          onSave({ fileName: `${trimmed}.${format}`, format, destination, driveFolderId: folder?.id });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
      >
        <h2 id="save-title">다른 이름으로 저장</h2>

        <label className="field">
          <span>파일 이름</span>
          <span className="input-with-suffix">
            <input
              ref={nameRef}
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              aria-invalid={invalidName}
              aria-describedby="name-help"
              maxLength={120}
            />
            <span className="suffix">.{format}</span>
          </span>
          <small id="name-help" className={invalidName ? 'form-error' : 'muted'}>
            {invalidName ? '파일 이름을 입력하세요. \\ / : * ? " < > | 는 쓸 수 없습니다.' : ' '}
          </small>
        </label>

        <fieldset className="field">
          <legend>형식</legend>
          <label className="radio">
            <input type="radio" name="format" checked={format === 'hwpx'} onChange={() => setFormat('hwpx')} disabled={!flags.allowHwpxSave} />
            HWPX (권장)
          </label>
          <label className="radio">
            <input type="radio" name="format" checked={format === 'hwp'} onChange={() => setFormat('hwp')} disabled={!flags.allowHwpSave} />
            HWP 호환 저장{!flags.allowHwpSave && ' (관리자가 꺼 둠)'}
          </label>
          {format === 'hwp' && <small className="muted">HWP 저장은 일부 서식이 달라질 수 있습니다. 가능하면 HWPX로 저장하세요.</small>}
        </fieldset>

        <fieldset className="field">
          <legend>저장 위치</legend>
          <label className="radio">
            <input type="radio" name="dest" checked={destination === 'drive'} onChange={() => setDestination('drive')} disabled={!driveEnabled} />
            Google Drive{!driveEnabled && ' (사용할 수 없음)'}
          </label>
          {destination === 'drive' && (
            <div className="folder-row">
              <span className="muted">폴더: {folder ? folder.name : '내 드라이브'}</span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={async () => {
                  setFolderError(null);
                  try {
                    const picked = await pickFolder(await getDriveAccessToken());
                    if (picked) setFolder(picked);
                  } catch (err) {
                    setFolderError(toAppError(err, 'DRIVE_001').userMessage);
                  }
                }}
              >
                폴더 선택…
              </button>
              {folderError && <small className="form-error">{folderError}</small>}
            </div>
          )}
          <label className="radio">
            <input type="radio" name="dest" checked={destination === 'local'} onChange={() => setDestination('local')} />
            이 크롬북 (파일 앱)
          </label>
        </fieldset>

        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onCancel}>
            취소
          </button>
          <button type="submit" className="btn btn-primary" disabled={invalidName}>
            저장
          </button>
        </div>
      </form>
    </div>
  );
}

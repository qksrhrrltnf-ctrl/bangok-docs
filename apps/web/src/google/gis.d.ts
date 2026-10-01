/** Google Identity Services / Picker 중 이 앱이 쓰는 부분만 선언한다. */

declare namespace google.accounts.id {
  interface CredentialResponse {
    credential: string;
    select_by?: string;
  }
  interface IdConfiguration {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    hd?: string;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
    itp_support?: boolean;
    context?: 'signin' | 'signup' | 'use';
    ux_mode?: 'popup' | 'redirect';
  }
  function initialize(config: IdConfiguration): void;
  interface PromptMomentNotification {
    isNotDisplayed?(): boolean;
    isSkippedMoment?(): boolean;
    isDismissedMoment?(): boolean;
    getNotDisplayedReason?(): string;
    getSkippedReason?(): string;
  }
  function prompt(listener?: (n: PromptMomentNotification) => void): void;
  function renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  function disableAutoSelect(): void;
  function cancel(): void;
}

declare namespace google.accounts.oauth2 {
  interface TokenResponse {
    access_token: string;
    expires_in: number;
    scope: string;
    error?: string;
    error_description?: string;
  }
  interface TokenClientConfig {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string; message?: string }) => void;
    hint?: string;
    hosted_domain?: string;
    prompt?: '' | 'none' | 'consent' | 'select_account';
  }
  interface TokenClient {
    requestAccessToken(overrides?: { prompt?: string; hint?: string }): void;
  }
  function initTokenClient(config: TokenClientConfig): TokenClient;
  function revoke(accessToken: string, done?: () => void): void;
}

declare namespace google.picker {
  const ViewId: { DOCS: string; FOLDERS: string };
  const Action: { PICKED: string; CANCEL: string };
  const Feature: { SUPPORT_DRIVES: string; NAV_HIDDEN: string };
  const DocsViewMode: { LIST: string; GRID: string };
  class DocsView {
    constructor(viewId?: string);
    setIncludeFolders(v: boolean): DocsView;
    setSelectFolderEnabled(v: boolean): DocsView;
    setMimeTypes(types: string): DocsView;
    setMode(mode: string): DocsView;
    setOwnedByMe(v: boolean): DocsView;
    setEnableDrives(v: boolean): DocsView;
    setQuery(q: string): DocsView;
  }
  interface PickerDocument {
    id: string;
    name: string;
    mimeType: string;
    sizeBytes?: number;
    parentId?: string;
  }
  interface ResponseObject {
    action: string;
    docs?: PickerDocument[];
  }
  class PickerBuilder {
    addView(view: DocsView | string): PickerBuilder;
    setOAuthToken(token: string): PickerBuilder;
    setDeveloperKey(key: string): PickerBuilder;
    setAppId(appId: string): PickerBuilder;
    setLocale(locale: string): PickerBuilder;
    setTitle(title: string): PickerBuilder;
    enableFeature(feature: string): PickerBuilder;
    setCallback(cb: (data: ResponseObject) => void): PickerBuilder;
    build(): { setVisible(v: boolean): void; dispose(): void };
  }
}

declare namespace gapi {
  function load(api: string, options: { callback: () => void; onerror?: () => void }): void;
}
